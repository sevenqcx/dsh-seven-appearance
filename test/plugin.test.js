import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

import {
  createHostHandlers,
  deleteWallpaper,
  getDataDirs,
  listWallpapers,
  readHostSettings,
  saveWallpaperBuffer,
  serveWallpaperMedia,
  writeHostSettings,
} from '../index.js';
import {
  BACKUP_SCHEMA_ID,
  DEFAULT_SETTINGS,
  SCENE_PRESETS,
  detectActiveScenePreset,
  exportSettingsBackup,
  getScenePresetPatch,
  parseSettingsBackup,
  sanitizeSettings,
} from '../src/settings-store.js';
import { buildStylesheet } from '../src/theme-css.js';
import { isZhUi, resolveUiLang } from '../src/i18n.js';
import { formatSelectionQuote } from '../src/selection-ask-controller.js';

test('right-click selection opens a sidebar branch with an editable draft', async () => {
  const { openSelectionInSidebar } = await import('../src/side-question.js');
  const calls = [];
  const sidebarRight = {
    commandTarget: () => ({ sessionId: 'main' }),
    openResource: (...args) => calls.push(args),
  };
  const sessions = { async fork(options) {
    assert.deepEqual(options, { sessionId: 'main', increaseTitle: true });
    return 'branch';
  } };
  await openSelectionInSidebar({ sidebarRight, sessions }, 'main', '选中的文字', 'explain', true);
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /^dsh-resource:\/\/obsidian-prism-question\/session\/branch$/);
  assert.equal(calls[0][1].destination, 'sidebar');
  assert.equal(calls[0][1].params.prompt, formatSelectionQuote('选中的文字', 'explain', true));
  sidebarRight.commandTarget = () => ({ sessionId: 'other' });
  await assert.rejects(openSelectionInSidebar({ sidebarRight, sessions }, 'main', '选中的文字', 'quote', true));
  assert.equal(calls.length, 1);
});

test('selection quick-ask pill and context menu share one toggle and both open the sidebar', async () => {
  const { createSelectionAskController } = await import('../src/selection-ask-controller.js');
  const { createContextMenuController } = await import('../src/context-menu-controller.js');

  assert.equal('contextMenuEnabled' in DEFAULT_SETTINGS, false);
  assert.equal('contextMenuEnabled' in sanitizeSettings({ contextMenuEnabled: false }), false);

  class FakeElement {
    constructor(tag = 'div', attrs = {}, parent = null) {
      this.tagName = tag.toUpperCase();
      this.nodeType = 1;
      this.attrs = { ...attrs };
      this.className = '';
      this.style = {};
      this.children = [];
      this.listeners = new Map();
      this.parentNode = parent;
      this.textContent = '';
      this.isConnected = false;
      this.href = attrs.href || '';
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    appendChild(child) {
      child.parentNode = this;
      child.isConnected = this.isConnected;
      this.children.push(child);
      return child;
    }
    removeChild(child) {
      this.children = this.children.filter((c) => c !== child);
      child.parentNode = null;
      child.isConnected = false;
    }
    remove() { this.parentNode?.removeChild(this); }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    dispatch(type, ev = {}) {
      for (const fn of this.listeners.get(type) || []) fn(ev);
    }
    contains(node) {
      let cur = node;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentNode;
      }
      return false;
    }
    closest(selector) {
      const parts = selector.split(',').map((s) => s.trim());
      let cur = this;
      while (cur) {
        for (const p of parts) {
          if (p === '[data-conversation-session]' && cur.getAttribute('data-conversation-session')) return cur;
          if (p === '[data-chat-flow]' && cur.getAttribute('data-chat-flow') != null) return cur;
          if (p === 'a[href]' && cur.tagName === 'A' && cur.href) return cur;
          if (p === '.op-side-question' && cur.className.includes('op-side-question')) return cur;
          if (p === '.op-selection-pill' && cur.className.includes('op-selection-pill')) return cur;
        }
        cur = cur.parentNode;
      }
      return null;
    }
    querySelector(sel) {
      if (sel === 'button') return this.children.find((c) => c.tagName === 'BUTTON') || null;
      return null;
    }
    getBoundingClientRect() { return { left: 100, top: 100, right: 240, bottom: 134, width: 140, height: 34 }; }
    focus() {}
  }

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevEl = globalThis.Element;
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCaf = globalThis.cancelAnimationFrame;

  const docListeners = new Map();
  const winListeners = new Map();
  const body = new FakeElement('body');
  body.isConnected = true;

  const conversation = new FakeElement('div', { 'data-conversation-session': 'sess-1', 'data-chat-flow': '1' }, body);
  const textNode = new FakeElement('p', {}, conversation);
  const linkNode = new FakeElement('a', { href: 'https://example.com' }, conversation);

  let currentSelection = null;
  globalThis.Element = FakeElement;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.document = {
    body,
    activeElement: null,
    createElement: (tag) => new FakeElement(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (type, fn) => {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    removeEventListener: (type, fn) => {
      docListeners.set(type, (docListeners.get(type) || []).filter((f) => f !== fn));
    },
  };
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 800,
    getSelection: () => currentSelection,
    addEventListener: (type, fn) => {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    removeEventListener: (type, fn) => {
      winListeners.set(type, (winListeners.get(type) || []).filter((f) => f !== fn));
    },
  };

  let settings = sanitizeSettings({ enabled: true, selectionAskEnabled: true, uiLanguage: 'zh' });
  const sideCalls = [];
  const openSideQuestion = async (...args) => { sideCalls.push(args); };
  const pillCtrl = createSelectionAskController({ getSettings: () => settings, openSideQuestion });
  const menuCtrl = createContextMenuController({ getSettings: () => settings, openSideQuestion });

  try {
    pillCtrl.start();
    menuCtrl.start();

    let cleared = 0;
    currentSelection = {
      rangeCount: 1,
      isCollapsed: false,
      anchorNode: textNode,
      focusNode: textNode,
      toString: () => '核心结论',
      getRangeAt: () => ({
        startContainer: textNode,
        endContainer: textNode,
        commonAncestorContainer: textNode,
        getClientRects: () => [{ left: 100, top: 200, right: 200, bottom: 220, width: 100, height: 20 }],
      }),
      removeAllRanges: () => { cleared += 1; },
    };

    // Trigger selection pill and click "侧边追问"
    for (const fn of docListeners.get('pointerup') || []) fn({ target: textNode });
    await new Promise((r) => setTimeout(r, 60));
    const pill = body.children.find((c) => c.className === 'op-selection-pill');
    assert.ok(pill);
    const pillLabels = pill.children.map((b) => b.textContent);
    assert.deepEqual(pillLabels, ['侧边追问', '侧边解释', '复制']);
    pill.children[0].dispatch('click', { preventDefault() {}, stopPropagation() {} });
    await Promise.resolve();
    assert.deepEqual(sideCalls[0], ['sess-1', '核心结论', 'quote', true]);
    assert.equal(cleared, 1);

    // Trigger right-click menu with selectionAskEnabled = true
    for (const fn of docListeners.get('contextmenu') || []) {
      fn({ target: textNode, clientX: 120, clientY: 160, shiftKey: false, preventDefault() {}, stopPropagation() {} });
    }
    let menu = body.children.find((c) => c.className === 'op-context-menu');
    assert.ok(menu);
    assert.deepEqual(
      menu.children.filter((c) => c.tagName === 'BUTTON').map((b) => b.textContent),
      ['复制选中内容', '在侧边栏追问', '在侧边栏解释'],
    );
    menu.children.find((b) => b.textContent === '在侧边栏解释').dispatch('click', { preventDefault() {}, stopPropagation() {} });
    await Promise.resolve();
    assert.deepEqual(sideCalls[1], ['sess-1', '核心结论', 'explain', true]);

    // Turn off selectionAskEnabled: pill disappears, right-click hides side-ask but keeps regular actions
    settings = sanitizeSettings({ enabled: true, selectionAskEnabled: false, uiLanguage: 'zh' });
    pillCtrl.refresh();
    menuCtrl.refresh();
    for (const fn of docListeners.get('pointerup') || []) fn({ target: textNode });
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(body.children.find((c) => c.className === 'op-selection-pill'), undefined);

    for (const fn of docListeners.get('contextmenu') || []) {
      fn({ target: linkNode, clientX: 120, clientY: 160, shiftKey: false, preventDefault() {}, stopPropagation() {} });
    }
    menu = body.children.find((c) => c.className === 'op-context-menu');
    assert.ok(menu);
    assert.deepEqual(
      menu.children.filter((c) => c.tagName === 'BUTTON').map((b) => b.textContent),
      ['复制选中内容', '复制链接'],
    );
  } finally {
    pillCtrl.dispose();
    menuCtrl.dispose();
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.Element = prevEl;
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame = prevCaf;
  }
});

test('prompt suggestions use the completed main turn and the selected Magpie model', async (t) => {
  const { collectTurnContext } = await import('../src/prompt-suggest-controller.js');
  const row = (kind, turn, text, part = null) => ({
    innerText: text,
    getAttribute: (name) => ({ 'data-chat-flow-kind': kind, 'data-chat-turn': turn, 'data-chat-group-part': part })[name],
    querySelector: () => null,
  });
  const conversation = {
    querySelectorAll: (selector) => selector === '[data-turn-tail]'
      ? [{ getAttribute: () => '2' }]
      : [row('user', '2', '前一句'), row('assistant-step', '1', '上一轮'), row('assistant-step', '2', '推理过程', 'reasoning'), row('assistant-step', '2', '实际回复', 'response')],
  };
  assert.deepEqual(collectTurnContext(conversation), { user: '前一句', assistant: '实际回复', sig: '2' });
  assert.equal(sanitizeSettings({ promptSuggestModel: 'codex/example' }).promptSuggestModel, 'codex/example');

  const route = createHostHandlers().find(({ path }) => path.endsWith('/prompt-suggest'));
  const catalog = [{ id: 'codex/example', display_name: 'Example' }, { id: 'images/example', modalities: { output: ['image'] } }];
  const completion = t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/models')) return Response.json({ data: catalog });
    assert.equal(JSON.parse(options.body).model, 'codex/example');
    return Response.json({ choices: [{ message: { content: '请继续' } }] });
  });
  const req = (model) => new Request('http://localhost', { method: 'POST', body: JSON.stringify({ assistant: '实际回复', model }) });
  const listed = await (await route.fetch(new Request('http://localhost'))).json();
  assert.deepEqual(listed.models, [{ id: 'codex/example', label: 'Example' }]);
  const oneShot = await (await route.fetch(req('codex/example'))).json();
  assert.equal(oneShot.ok, true);
  assert.equal(oneShot.text, '请继续');
  assert.deepEqual(oneShot.texts, ['请继续']);
  assert.equal((await route.fetch(req('unknown/model'))).status, 400);
  assert.equal(completion.mock.calls.filter(({ arguments: [url] }) => url.endsWith('/chat/completions')).length, 1);

  // 系统提示必须写清「用户口吻、不客套、默认已做完交回给他的动作」
  const chatCall = completion.mock.calls.find(({ arguments: [url] }) => String(url).endsWith('/chat/completions'));
  const sentSystem = JSON.parse(chatCall.arguments[1].body).messages[0].content;
  assert.match(sentSystem, /不客套|客套/);
  assert.match(sentSystem, /3 条|3 lines/);
  assert.match(sentSystem, /角度|angles/);
  assert.match(sentSystem, /20 字|20 characters|12 words/);
  // 只在交回动作时才追加那条补充说明
  assert.doesNotMatch(sentSystem, /早就做完了/);
});

test('prompt suggestion renders inline ghost inside composer, cycles on Shift+Tab, and accepts on Tab', async (t) => {
  const { createPromptSuggestController } = await import('../src/prompt-suggest-controller.js');
  const css = buildStylesheet();
  assert.match(css, /\[data-op-prompt-ghost="1"\] \[data-composer-placeholder\]/);
  assert.match(css, /\.op-prompt-suggest-kbd/);

  class FakeEl {
    constructor(tag = 'div', attrs = {}, parent = null) {
      this.tagName = tag.toUpperCase();
      this.attrs = { ...attrs };
      this.className = '';
      this.id = '';
      this.children = [];
      this.listeners = new Map();
      this.parentElement = parent;
      this._text = '';
      this.value = '';
      this.isContentEditable = attrs.contenteditable === 'true';
      if (parent) parent.children.push(this);
    }
    get textContent() { return this._text; }
    set textContent(v) {
      this._text = String(v ?? '');
      if (this._text === '') this.children = [];
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    }
    append(...nodes) { for (const n of nodes) this.appendChild(n); }
    remove() {
      if (!this.parentElement) return;
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      this.parentElement = null;
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    dispatchEvent() { return true; }
    focus() {}
    scrollIntoView() {}
    contains(node) {
      let cur = node;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentElement;
      }
      return false;
    }
    closest(sel) {
      let cur = this;
      while (cur) {
        if (sel === '[data-composer-card]' && cur.getAttribute('data-composer-card') != null) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    querySelector(sel) {
      if (sel === '[contenteditable="true"]' || sel === '[data-composer-card] [contenteditable="true"]') {
        const stack = [...this.children];
        while (stack.length) {
          const n = stack.shift();
          if (n.getAttribute('contenteditable') === 'true') return n;
          stack.push(...n.children);
        }
      }
      if (sel === '[data-composer-card]') {
        const stack = [...this.children];
        while (stack.length) {
          const n = stack.shift();
          if (n.getAttribute('data-composer-card') != null) return n;
          stack.push(...n.children);
        }
      }
      return null;
    }
    querySelectorAll(sel) {
      const out = [];
      const stack = [...this.children];
      while (stack.length) {
        const n = stack.shift();
        if (sel === '[data-turn-tail]' && n.getAttribute('data-turn-tail') != null) out.push(n);
        if (sel === '[data-chat-flow-kind][data-chat-turn]' && n.getAttribute('data-chat-flow-kind') && n.getAttribute('data-chat-turn')) out.push(n);
        if (sel === '[data-conversation-session]' && n.getAttribute('data-conversation-session')) out.push(n);
        if (sel === '[data-op-prompt-ghost]' && n.getAttribute('data-op-prompt-ghost') != null) out.push(n);
        stack.push(...n.children);
      }
      return out;
    }
  }

  const root = new FakeEl('div');
  const conv = new FakeEl('div', { 'data-conversation-session': 'main' }, root);
  const tail = new FakeEl('div', { 'data-turn-tail': '3' }, conv);
  const userRow = new FakeEl('div', { 'data-chat-flow-kind': 'user', 'data-chat-turn': '3' }, conv);
  userRow.innerText = '改成半透明放输入框里';
  const asstRow = new FakeEl('div', { 'data-chat-flow-kind': 'assistant-step', 'data-chat-turn': '3', 'data-chat-group-part': 'response' }, conv);
  asstRow.innerText = '已改成输入框内半透明提示。';
  const card = new FakeEl('div', { 'data-composer-card': '1' }, conv);
  const inputHost = new FakeEl('div', {}, card);
  const editor = new FakeEl('div', { contenteditable: 'true' }, inputHost);
  new FakeEl('div', { 'data-composer-placeholder': 'true' }, inputHost);
  assert.ok(tail);

  const docListeners = new Map();
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevSetTimeout = globalThis.setTimeout;
  const prevClearTimeout = globalThis.clearTimeout;
  const scheduled = [];

  globalThis.document = {
    createElement: (tag) => new FakeEl(tag),
    getElementById: (id) => {
      const stack = [...root.children];
      while (stack.length) {
        const n = stack.shift();
        if (n.id === id) return n;
        stack.push(...n.children);
      }
      return null;
    },
    querySelector: (sel) => root.querySelector(sel),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    addEventListener: (type, fn) => {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    removeEventListener: (type, fn) => {
      docListeners.set(type, (docListeners.get(type) || []).filter((f) => f !== fn));
    },
  };
  globalThis.window = { getSelection: () => null };
  globalThis.setTimeout = (fn) => { scheduled.push(fn); return scheduled.length; };
  globalThis.clearTimeout = () => {};

  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (String(_url).includes('/suggest-event')) return Response.json({ ok: true });
    const body = JSON.parse(options.body);
    bodies.push(body);
    if (bodies.length === 1) {
      return Response.json({ ok: true, text: '第一条建议', texts: ['第一条建议', '第二视角', '第三视角'] });
    }
    return Response.json({ ok: true, text: '新一批建议', texts: ['新一批建议'] });
  });

  const ctrl = createPromptSuggestController({
    getSettings: () => sanitizeSettings({ enabled: true, promptSuggestEnabled: true, uiLanguage: 'zh' }),
  });

  try {
    ctrl.start();
    ctrl.notifyStreamingChange(false);
    assert.equal(scheduled.length, 1);
    scheduled[0]();
    await new Promise((r) => prevSetTimeout(r, 15));

    // Ghost sits inside inputHost, never above composer card
    const ghost = inputHost.children.find((c) => c.id === 'op-prompt-suggest');
    assert.ok(ghost);
    assert.equal(inputHost.getAttribute('data-op-prompt-ghost'), '1');
    assert.equal(conv.children.find((c) => c.id === 'op-prompt-suggest'), undefined);
    assert.equal(ghost.children[0].textContent, '第一条建议');

    // Shift+Tab 先在本批里瞬间切换，不额外请求
    for (const fn of docListeners.get('keydown') || []) {
      fn({ key: 'Tab', shiftKey: true, target: editor, preventDefault() {}, stopPropagation() {} });
    }
    assert.equal(ghost.children[0].textContent, '第二视角');
    for (const fn of docListeners.get('keydown') || []) {
      fn({ key: 'Tab', shiftKey: true, target: editor, preventDefault() {}, stopPropagation() {} });
    }
    assert.equal(ghost.children[0].textContent, '第三视角');
    assert.equal(bodies.length, 1, '批内切换不该发请求');

    // 这批看完后再换，才去要新的一批，并带上不要重复的候选
    for (const fn of docListeners.get('keydown') || []) {
      fn({ key: 'Tab', shiftKey: true, target: editor, preventDefault() {}, stopPropagation() {} });
    }
    await new Promise((r) => prevSetTimeout(r, 15));
    assert.equal(bodies.length, 2);
    assert.deepEqual(bodies[1].exclude, ['第一条建议', '第二视角', '第三视角']);
    assert.equal(ghost.children[0].textContent, '新一批建议');

    // Tab accepts into composer and clears ghost + host attribute
    for (const fn of docListeners.get('keydown') || []) {
      fn({ key: 'Tab', shiftKey: false, target: editor, preventDefault() {}, stopPropagation() {} });
    }
    assert.equal(editor.textContent, '新一批建议');
    assert.equal(inputHost.getAttribute('data-op-prompt-ghost'), null);
    assert.equal(inputHost.children.find((c) => c.id === 'op-prompt-suggest'), undefined);
  } finally {
    ctrl.dispose();
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.setTimeout = prevSetTimeout;
    globalThis.clearTimeout = prevClearTimeout;
  }
});

test('prompt suggestion prefetches during streaming for 0ms instant display and caches /v1/models', async (t) => {
  const { createPromptSuggestController } = await import('../src/prompt-suggest-controller.js');

  // 1. Verify /v1/models cache avoids extra serial model fetches across POSTs
  const route = createHostHandlers().find(({ path }) => path.endsWith('/prompt-suggest'));
  let modelFetchCount = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('/suggest-event')) return Response.json({ ok: true });
    if (url.endsWith('/models')) {
      modelFetchCount += 1;
      return Response.json({ data: [{ id: 'codex/fast', display_name: 'Fast' }] });
    }
    return Response.json({ choices: [{ message: { content: '下一步建议' } }] });
  });
  const postReq = () => new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ assistant: '已经完成修改。', model: 'codex/fast' }),
  });
  const cacheRes1 = await (await route.fetch(postReq())).json();
  assert.equal(cacheRes1.text, '下一步建议');
  assert.deepEqual(cacheRes1.texts, ['下一步建议']);
  assert.equal((await (await route.fetch(postReq())).json()).text, '下一步建议');
  assert.equal(modelFetchCount, 1);

  // 2. Verify streaming prefetch shows ghost synchronously at 0ms when streaming stops
  class MiniEl {
    constructor(tag = 'div', attrs = {}, parent = null) {
      this.tagName = tag.toUpperCase();
      this.attrs = { ...attrs };
      this.className = '';
      this.id = '';
      this.children = [];
      this.parentElement = parent;
      this._text = '';
      this.isContentEditable = attrs.contenteditable === 'true';
      if (parent) parent.children.push(this);
    }
    get textContent() { return this._text; }
    set textContent(v) {
      this._text = String(v ?? '');
      if (this._text === '') this.children = [];
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; }
    append(...ns) { for (const n of ns) this.appendChild(n); }
    remove() {
      if (!this.parentElement) return;
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      this.parentElement = null;
    }
    addEventListener() {}
    querySelector(sel) {
      const stack = [...this.children];
      while (stack.length) {
        const n = stack.shift();
        if (sel === '[contenteditable="true"]' && n.getAttribute('contenteditable') === 'true') return n;
        if (sel === '[data-composer-card]' && n.getAttribute('data-composer-card') != null) return n;
        stack.push(...n.children);
      }
      return null;
    }
    querySelectorAll(sel) {
      const out = [];
      const stack = [...this.children];
      while (stack.length) {
        const n = stack.shift();
        if (sel === '[data-turn-tail]' && n.getAttribute('data-turn-tail') != null) out.push(n);
        if (sel === '[data-chat-flow-kind][data-chat-turn]' && n.getAttribute('data-chat-flow-kind') && n.getAttribute('data-chat-turn')) out.push(n);
        if (sel === '[data-conversation-session]' && n.getAttribute('data-conversation-session')) out.push(n);
        if (sel === '[data-op-prompt-ghost]' && n.getAttribute('data-op-prompt-ghost') != null) out.push(n);
        stack.push(...n.children);
      }
      return out;
    }
  }

  const root = new MiniEl('div');
  const conv = new MiniEl('div', { 'data-conversation-session': 'main' }, root);
  const userRow = new MiniEl('div', { 'data-chat-flow-kind': 'user', 'data-chat-turn': '4' }, conv);
  userRow.innerText = '能回复的瞬间就有吗？';
  const respRow = new MiniEl('div', { 'data-chat-flow-kind': 'assistant-step', 'data-chat-turn': '4', 'data-chat-group-part': 'response' }, conv);
  respRow.innerText = '可以通过流式尾段提前预取并缓存模型列表，在回复停住的那一帧立刻把建议亮出来。';
  const card = new MiniEl('div', { 'data-composer-card': '1' }, conv);
  const inputHost = new MiniEl('div', {}, card);
  new MiniEl('div', { contenteditable: 'true' }, inputHost);

  const prevDoc = globalThis.document;
  const prevSetInterval = globalThis.setInterval;
  const prevClearInterval = globalThis.clearInterval;
  const prevSetTimeout = globalThis.setTimeout;
  const prevClearTimeout = globalThis.clearTimeout;
  let pollFn = null;
  let settleFn = null;

  globalThis.document = {
    createElement: (tag) => new MiniEl(tag),
    getElementById: (id) => {
      const stack = [...root.children];
      while (stack.length) {
        const n = stack.shift();
        if (n.id === id) return n;
        stack.push(...n.children);
      }
      return null;
    },
    querySelector: (sel) => root.querySelector(sel),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.setInterval = (fn) => { pollFn = fn; return 1; };
  globalThis.clearInterval = () => { pollFn = null; };
  globalThis.setTimeout = (fn) => { settleFn = fn; return 2; };
  globalThis.clearTimeout = () => { settleFn = null; };

  let suggestFetches = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('/suggest-event')) return Response.json({ ok: true });
    suggestFetches += 1;
    return Response.json({ ok: true, text: '瞬间预取建议' });
  });

  const ctrl = createPromptSuggestController({
    getSettings: () => sanitizeSettings({ enabled: true, promptSuggestEnabled: true, uiLanguage: 'zh' }),
  });

  try {
    ctrl.start();
    ctrl.notifyStreamingChange(true);
    assert.equal(typeof pollFn, 'function');
    pollFn();
    await new Promise((r) => prevSetTimeout(r, 15));
    assert.equal(suggestFetches, 1);
    // Still streaming: must NOT display yet
    assert.equal(inputHost.children.find((c) => c.id === 'op-prompt-suggest'), undefined);

    // Streaming stops: ghost must appear synchronously at 0ms
    new MiniEl('div', { 'data-turn-tail': '4' }, conv);
    ctrl.notifyStreamingChange(false);
    const ghost = inputHost.children.find((c) => c.id === 'op-prompt-suggest');
    assert.ok(ghost);
    assert.equal(ghost.children[0].textContent, '瞬间预取建议');

    // Final settle check sees no large tail delta, so no extra request is fired
    assert.equal(typeof settleFn, 'function');
    settleFn();
    assert.equal(suggestFetches, 1);
  } finally {
    ctrl.dispose();
    globalThis.document = prevDoc;
    globalThis.setInterval = prevSetInterval;
    globalThis.clearInterval = prevClearInterval;
    globalThis.setTimeout = prevSetTimeout;
    globalThis.clearTimeout = prevClearTimeout;
  }
});

test('prompt suggestion persists across session switch and composer remount until user types, and ignores holding/sidebar streaming', async (t) => {
  const { createPromptSuggestController } = await import('../src/prompt-suggest-controller.js');
  const { detectStreamingActive } = await import('../src/mascot-controller.js');

  class NodeEl {
    constructor(tag = 'div', attrs = {}, parent = null) {
      this.tagName = tag.toUpperCase();
      this.attrs = { ...attrs };
      this.className = '';
      this.id = '';
      this.hidden = Boolean(attrs.hidden);
      this.children = [];
      this.parentElement = parent;
      this._text = '';
      this.isContentEditable = attrs.contenteditable === 'true';
      if (parent) parent.children.push(this);
    }
    get textContent() { return this._text; }
    set textContent(v) {
      this._text = String(v ?? '');
      if (this._text === '') this.children = [];
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; }
    append(...ns) { for (const n of ns) this.appendChild(n); }
    remove() {
      if (!this.parentElement) return;
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      this.parentElement = null;
    }
    addEventListener() {}
    contains(node) {
      let cur = node;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentElement;
      }
      return false;
    }
    closest(sel) {
      let cur = this;
      while (cur) {
        if (sel.includes('[data-sidebar-right-session]') && cur.getAttribute('data-sidebar-right-session') != null) return cur;
        if (sel.includes('[data-composer-card]') && cur.getAttribute('data-composer-card') != null) return cur;
        if (sel.includes('[hidden]') && (cur.hidden || cur.getAttribute('hidden') != null)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    matchesRunning(sel) {
      if (sel.includes('[data-streaming="true"]') && this.getAttribute('data-streaming') === 'true') return true;
      if (sel.includes('[data-chat-running]:not([data-holding])') && this.getAttribute('data-chat-running') != null && this.getAttribute('data-holding') == null) return true;
      return false;
    }
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    }
    querySelectorAll(sel) {
      const out = [];
      const stack = [...this.children];
      while (stack.length) {
        const n = stack.shift();
        if (sel === '[contenteditable="true"]' && n.getAttribute('contenteditable') === 'true') out.push(n);
        else if (sel === '[data-composer-card]' && n.getAttribute('data-composer-card') != null) out.push(n);
        else if (sel === '[data-turn-tail]' && n.getAttribute('data-turn-tail') != null) out.push(n);
        else if (sel === '[data-chat-flow-kind][data-chat-turn]' && n.getAttribute('data-chat-flow-kind') && n.getAttribute('data-chat-turn')) out.push(n);
        else if (sel === '[data-conversation-session]' && n.getAttribute('data-conversation-session')) out.push(n);
        else if (sel === '[data-op-prompt-ghost]' && n.getAttribute('data-op-prompt-ghost') != null) out.push(n);
        else if (n.matchesRunning(sel)) out.push(n);
        stack.push(...n.children);
      }
      return out;
    }
  }

  // 1. Holding indicator and sidebar streaming must NOT falsely mark main conversation as streaming
  const streamRoot = new NodeEl('div');
  const mainSess = new NodeEl('div', { 'data-conversation-session': 'main-s' }, streamRoot);
  new NodeEl('div', { 'data-chat-running': 'true', 'data-holding': '' }, mainSess);
  const sideWrap = new NodeEl('div', { 'data-sidebar-right-session': '1' }, streamRoot);
  new NodeEl('div', { 'data-chat-running': 'true' }, sideWrap);
  assert.equal(detectStreamingActive(streamRoot), false);
  const liveRun = new NodeEl('div', { 'data-chat-running': 'true' }, mainSess);
  assert.equal(detectStreamingActive(streamRoot), true);
  liveRun.remove();
  assert.equal(detectStreamingActive(streamRoot), false);

  // 2. Suggestion persists across composer remount and session switch, hides only when user types
  const root = new NodeEl('div');
  const buildSessionA = () => {
    const conv = new NodeEl('div', { 'data-conversation-session': 'sess-A' }, root);
    new NodeEl('div', { 'data-turn-tail': '7' }, conv);
    const u = new NodeEl('div', { 'data-chat-flow-kind': 'user', 'data-chat-turn': '7' }, conv);
    u.innerText = '测一下持久显示';
    const a = new NodeEl('div', { 'data-chat-flow-kind': 'assistant-step', 'data-chat-turn': '7', 'data-chat-group-part': 'response' }, conv);
    a.innerText = '已改为持久显示，只有你打字才消失。';
    const card = new NodeEl('div', { 'data-composer-card': '1' }, conv);
    const host = new NodeEl('div', {}, card);
    const editor = new NodeEl('div', { contenteditable: 'true' }, host);
    return { conv, host, editor };
  };
  let sessA = buildSessionA();

  const docListeners = new Map();
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  globalThis.document = {
    documentElement: { getAttribute: () => '0' },
    createElement: (tag) => new NodeEl(tag),
    getElementById: (id) => {
      const stack = [...root.children];
      while (stack.length) {
        const n = stack.shift();
        if (n.id === id) return n;
        stack.push(...n.children);
      }
      return null;
    },
    querySelector: (sel) => root.querySelector(sel),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    addEventListener: (type, fn) => {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    removeEventListener: (type, fn) => {
      docListeners.set(type, (docListeners.get(type) || []).filter((f) => f !== fn));
    },
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };

  let fetchCount = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('/suggest-event')) return Response.json({ ok: true });
    if (String(url).includes('/speech-sample')) return Response.json({ ok: true, count: 1 });
    fetchCount += 1;
    return Response.json({ ok: true, text: '持久建议内容' });
  });

  const ctrl = createPromptSuggestController({
    getSettings: () => sanitizeSettings({ enabled: true, promptSuggestEnabled: true, uiLanguage: 'zh' }),
  });

  try {
    ctrl.start();
    // Initial sync on idle finished conversation fetches and displays ghost
    ctrl.sync();
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(fetchCount, 1);
    assert.equal(sessA.host.children.find((c) => c.id === 'op-prompt-suggest')?.children[0]?.textContent, '持久建议内容');

    // Escape outside composer must NOT dismiss ghost
    for (const fn of docListeners.get('keydown') || []) {
      fn({ key: 'Escape', target: root });
    }
    assert.ok(sessA.host.children.find((c) => c.id === 'op-prompt-suggest'));

    // Switch away to session B (unmounts session A's composer) and switch back to session A
    sessA.conv.remove();
    const sessB = new NodeEl('div', { 'data-conversation-session': 'sess-B' }, root);
    const cardB = new NodeEl('div', { 'data-composer-card': '1' }, sessB);
    const hostB = new NodeEl('div', {}, cardB);
    new NodeEl('div', { contenteditable: 'true' }, hostB);
    ctrl.sync();
    assert.equal(hostB.children.find((c) => c.id === 'op-prompt-suggest'), undefined);

    // Return to session A with freshly remounted composer: restores immediately from cache with 0 extra fetches
    sessB.remove();
    sessA = buildSessionA();
    ctrl.sync();
    assert.equal(fetchCount, 1);
    assert.equal(sessA.host.children.find((c) => c.id === 'op-prompt-suggest')?.children[0]?.textContent, '持久建议内容');

    // User starts typing: hides immediately; deleting all text restores cached suggestion with 0 extra fetches
    sessA.editor.textContent = '我自己写';
    for (const fn of docListeners.get('input') || []) {
      fn({ target: sessA.editor });
    }
    assert.equal(sessA.host.children.find((c) => c.id === 'op-prompt-suggest'), undefined);
    sessA.editor.textContent = '';
    for (const fn of docListeners.get('input') || []) {
      fn({ target: sessA.editor });
    }
    assert.equal(fetchCount, 1);
    assert.equal(sessA.host.children.find((c) => c.id === 'op-prompt-suggest')?.children[0]?.textContent, '持久建议内容');

    // IME composition hides while composing and restores when cancelled back to empty
    for (const fn of docListeners.get('compositionstart') || []) {
      fn({ target: sessA.editor });
    }
    assert.equal(sessA.host.children.find((c) => c.id === 'op-prompt-suggest'), undefined);
    for (const fn of docListeners.get('compositionend') || []) {
      fn({ target: sessA.editor });
    }
    assert.equal(sessA.host.children.find((c) => c.id === 'op-prompt-suggest')?.children[0]?.textContent, '持久建议内容');

    // Explicit Escape inside composer dismisses for this turn
    for (const fn of docListeners.get('keydown') || []) {
      fn({ key: 'Escape', target: sessA.editor });
    }
    assert.equal(sessA.host.children.find((c) => c.id === 'op-prompt-suggest'), undefined);
    ctrl.sync();
    assert.equal(sessA.host.children.find((c) => c.id === 'op-prompt-suggest'), undefined);
  } finally {
    ctrl.dispose();
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});

test('prompt suggestion shows 0ms local fallback with fast-model upgrade, supports pure-local 0-fetch mode, and prefers fast default model', async (t) => {
  const { buildLocalSuggestions, createPromptSuggestController, LOCAL_ONLY_MODEL } = await import('../src/prompt-suggest-controller.js');

  // 1. Local heuristic produces context-aware candidates in zh and en
  const choiceList = buildLocalSuggestions({ assistant: '有两种改法：1. 本地瞬出 2. 纯本地，选哪种？', zh: true });
  assert.ok(choiceList.length >= 4);
  assert.match(choiceList[0], /推荐|选第一个/);
  const enList = buildLocalSuggestions({ assistant: 'All tests passed and ready to verify.', zh: false });
  assert.ok(enList.length >= 4);
  assert.match(enList[0], /Tested|fine|continue/i);

  // 跟着用户本人的说话习惯：短、直接、不客套（不能出现「好的／我这就／麻烦你」这类客服腔）
  const handoff = buildLocalSuggestions({
    assistant: '浏览器里已经打开授权页，验证码 0969-0567 也复制到剪贴板了，你在输入框粘贴后点继续。',
    zh: true,
  });
  assert.match(handoff[0], /已经弄好了|授权完了|好了/);
  assert.ok(handoff.every((s) => s.length <= 12), handoff.join(' / '));
  const flat = buildLocalSuggestions({ assistant: '已经改好了，可以刷新试一下。', zh: true });
  for (const pool of [handoff, flat, choiceList]) {
    for (const s of pool) {
      assert.doesNotMatch(s, /好的|我这就|我这就去|麻烦你|辛苦|你等我|稍等/);
    }
  }

  // 他本人口吻：极短的『继续 / 可以 / 行』和「这是什么意思／有什么影响／要多少钱」优先
  assert.ok(flat.includes('继续') && flat.includes('可以'), flat.join(' / '));
  const plain = buildLocalSuggestions({ assistant: '这段代码的作用是给输入框加一圈光。', zh: true });
  assert.ok(plain.some((s) => /这是什么意思|有什么影响|要花多少钱/.test(s)), plain.join(' / '));
  const problem = buildLocalSuggestions({ assistant: '刚才那个报错还没修好，失败了。', zh: true });
  assert.ok(problem.some((s) => /这是什么意思|为什么会这样|直接修掉/.test(s)), problem.join(' / '));

  // 2. Host route defaultModel prefers non-reasoning flash model over group/fastest-first
  const route = createHostHandlers().find(({ path }) => path.endsWith('/prompt-suggest'));
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    data: [
      { id: 'group/fastest-first', display_name: 'Fastest First' },
      { id: 'qwen-cn/qwen-flash-2025-07-28', display_name: 'Qwen Flash' },
    ],
  }));
  const listed = await (await route.fetch(new Request('http://localhost'))).json();
  assert.equal(listed.defaultModel, 'qwen-cn/qwen-flash-2025-07-28');

  // 3. Pure-local mode makes ZERO fetches and cycles locally at 0ms
  class El {
    constructor(tag = 'div', attrs = {}, parent = null) {
      this.tagName = tag.toUpperCase();
      this.attrs = { ...attrs };
      this.className = '';
      this.id = '';
      this.children = [];
      this.parentElement = parent;
      this._text = '';
      this.isContentEditable = attrs.contenteditable === 'true';
      if (parent) parent.children.push(this);
    }
    get textContent() { return this._text; }
    set textContent(v) {
      this._text = String(v ?? '');
      if (this._text === '') this.children = [];
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; }
    append(...ns) { for (const n of ns) this.appendChild(n); }
    remove() {
      if (!this.parentElement) return;
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      this.parentElement = null;
    }
    addEventListener() {}
    contains(node) {
      let cur = node;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentElement;
      }
      return false;
    }
    closest(sel) {
      let cur = this;
      while (cur) {
        if (sel.includes('[data-composer-card]') && cur.getAttribute('data-composer-card') != null) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      const out = [];
      const stack = [...this.children];
      while (stack.length) {
        const n = stack.shift();
        if (sel === '[contenteditable="true"]' && n.getAttribute('contenteditable') === 'true') out.push(n);
        else if (sel === '[data-composer-card]' && n.getAttribute('data-composer-card') != null) out.push(n);
        else if (sel === '[data-turn-tail]' && n.getAttribute('data-turn-tail') != null) out.push(n);
        else if (sel === '[data-chat-flow-kind][data-chat-turn]' && n.getAttribute('data-chat-flow-kind') && n.getAttribute('data-chat-turn')) out.push(n);
        else if (sel === '[data-conversation-session]' && n.getAttribute('data-conversation-session')) out.push(n);
        else if (sel === '[data-op-prompt-ghost]' && n.getAttribute('data-op-prompt-ghost') != null) out.push(n);
        stack.push(...n.children);
      }
      return out;
    }
  }

  const root = new El('div');
  const conv = new El('div', { 'data-conversation-session': 'local-sess' }, root);
  new El('div', { 'data-turn-tail': '9' }, conv);
  const asst = new El('div', { 'data-chat-flow-kind': 'assistant-step', 'data-chat-turn': '9', 'data-chat-group-part': 'response' }, conv);
  asst.innerText = '有两种改法，选第一种还是第二种？';
  const card = new El('div', { 'data-composer-card': '1' }, conv);
  const host = new El('div', {}, card);
  const editor = new El('div', { contenteditable: 'true' }, host);

  const docListeners = new Map();
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  globalThis.document = {
    documentElement: { getAttribute: () => '0' },
    createElement: (tag) => new El(tag),
    getElementById: (id) => {
      const stack = [...root.children];
      while (stack.length) {
        const n = stack.shift();
        if (n.id === id) return n;
        stack.push(...n.children);
      }
      return null;
    },
    querySelector: (sel) => root.querySelector(sel),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    addEventListener: (type, fn) => {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    removeEventListener: (type, fn) => {
      docListeners.set(type, (docListeners.get(type) || []).filter((f) => f !== fn));
    },
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };

  let fetchCalls = 0;
  let resolveModel = null;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('/suggest-event')) return Response.json({ ok: true });
    fetchCalls += 1;
    return new Promise((resolve) => {
      resolveModel = () => resolve(Response.json({ ok: true, text: '快模型升级后的精准建议' }));
    });
  });

  // 3a. Pure-local mode: 0ms instant + 0ms Shift+Tab cycle + 0 fetches
  const localCtrl = createPromptSuggestController({
    getSettings: () => sanitizeSettings({ enabled: true, promptSuggestEnabled: true, promptSuggestModel: LOCAL_ONLY_MODEL, uiLanguage: 'zh' }),
  });
  try {
    localCtrl.start();
    localCtrl.notifyStreamingChange(true);
    localCtrl.notifyStreamingChange(false);
    const first = host.children.find((c) => c.id === 'op-prompt-suggest')?.children[0]?.textContent;
    assert.ok(first);
    assert.equal(fetchCalls, 0);

    for (const fn of docListeners.get('keydown') || []) {
      fn({ key: 'Tab', shiftKey: true, target: editor, preventDefault() {}, stopPropagation() {} });
    }
    const second = host.children.find((c) => c.id === 'op-prompt-suggest')?.children[0]?.textContent;
    assert.ok(second && second !== first);
    assert.equal(fetchCalls, 0);
  } finally {
    localCtrl.dispose();
  }

  // 3b. Model mode is one model only: nothing shows before the model answers, no local placeholder to upgrade
  const hybridCtrl = createPromptSuggestController({
    getSettings: () => sanitizeSettings({ enabled: true, promptSuggestEnabled: true, promptSuggestModel: 'qwen-cn/qwen-flash-2025-07-28', uiLanguage: 'zh' }),
  });
  try {
    hybridCtrl.start();
    hybridCtrl.sync();
    // No transitional local suggestion while the model is still thinking
    assert.equal(host.children.find((c) => c.id === 'op-prompt-suggest'), undefined);
    assert.equal(fetchCalls, 1);

    // Model answers once, and that single answer is what shows
    resolveModel();
    await new Promise((r) => setTimeout(r, 15));
    const upgraded = host.children.find((c) => c.id === 'op-prompt-suggest')?.children[0]?.textContent;
    assert.equal(upgraded, '快模型升级后的精准建议');
    assert.equal(fetchCalls, 1);

    // Tab works even when user has NOT clicked the composer (e.g., focus on chat/body),
    // while yielding when focus is inside a modal/drawer/other input.
    let focused = false;
    editor.focus = () => { focused = true; };
    const otherInput = new El('input', {}, root);
    otherInput.closest = (sel) => (sel.includes('input') ? otherInput : null);
    let prevented = false;
    for (const fn of docListeners.get('keydown') || []) {
      fn({ key: 'Tab', shiftKey: false, target: otherInput, preventDefault() { prevented = true; }, stopPropagation() {} });
    }
    assert.equal(prevented, false);
    assert.equal(editor.textContent, '');

    // Pressing Tab from general page/conversation area focuses composer and accepts suggestion
    for (const fn of docListeners.get('keydown') || []) {
      fn({ key: 'Tab', shiftKey: false, target: conv, preventDefault() { prevented = true; }, stopPropagation() {} });
    }
    assert.equal(prevented, true);
    assert.equal(focused, true);
    assert.equal(editor.textContent, '快模型升级后的精准建议');
    assert.equal(host.children.find((c) => c.id === 'op-prompt-suggest'), undefined);
  } finally {
    hybridCtrl.dispose();
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'dsh-op-test-'));
}

test('host settings read/write round-trip', async () => {
  const dir = makeTempDir();
  try {
    const dirs = getDataDirs(dir);
    assert.equal(await readHostSettings(dirs), null);

    const saved = await writeHostSettings(dirs, { darkPreset: 'warm', mascotSpec: 'quad' });
    assert.equal(saved.darkPreset, 'warm');

    const loaded = await readHostSettings(dirs);
    assert.deepEqual(loaded, { darkPreset: 'warm', mascotSpec: 'quad' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wallpaper save, list, full & Range 206 streaming, path traversal block, and delete', async () => {
  const dir = makeTempDir();
  try {
    const dirs = getDataDirs(dir);
    const payload = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
    const saved = await saveWallpaperBuffer(dirs, {
      buffer: payload,
      filename: 'nebula.mp4',
      mimeType: 'video/mp4',
    });
    assert.equal(saved.kind, 'video');
    assert.equal(saved.mime, 'video/mp4');
    assert.equal(saved.size, payload.length);

    const list = await listWallpapers(dirs);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, saved.id);

    // Full 200 response
    const fullRes = await serveWallpaperMedia(
      dirs,
      new Request(`http://localhost/api/dsh-obsidian-prism/wallpaper-media?id=${encodeURIComponent(saved.id)}`),
    );
    assert.equal(fullRes.status, 200);
    assert.equal(fullRes.headers.get('accept-ranges'), 'bytes');
    assert.equal(Buffer.from(await fullRes.arrayBuffer()).toString(), payload.toString());

    // Partial 206 Range response
    const rangeRes = await serveWallpaperMedia(
      dirs,
      new Request(`http://localhost/api/dsh-obsidian-prism/wallpaper-media?id=${encodeURIComponent(saved.id)}`, {
        headers: { range: 'bytes=4-9' },
      }),
    );
    assert.equal(rangeRes.status, 206);
    assert.equal(rangeRes.headers.get('content-range'), `bytes 4-9/${payload.length}`);
    assert.equal(Buffer.from(await rangeRes.arrayBuffer()).toString(), '456789');

    // Path traversal rejected
    const badRes = await serveWallpaperMedia(
      dirs,
      new Request('http://localhost/api/dsh-obsidian-prism/wallpaper-media?id=../settings.json'),
    );
    assert.equal(badRes.status, 400);

    // Delete
    await deleteWallpaper(dirs, saved.id);
    assert.equal((await listWallpapers(dirs)).length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('host HTTP handlers respond correctly', async () => {
  const dir = makeTempDir();
  try {
    const handlers = createHostHandlers(dir);
    const settingsHandler = handlers.find((h) => h.path === '/api/dsh-obsidian-prism/settings');
    assert.ok(settingsHandler);

    const postRes = await settingsHandler.fetch(
      new Request('http://localhost/api/dsh-obsidian-prism/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings: { accent: 'prism', enabled: true } }),
      }),
    );
    const postJson = await postRes.json();
    assert.equal(postJson.ok, true);
    assert.equal(postJson.value.accent, 'prism');

    const getRes = await settingsHandler.fetch(new Request('http://localhost/api/dsh-obsidian-prism/settings'));
    const getJson = await getRes.json();
    assert.equal(getJson.ok, true);
    assert.equal(getJson.value.accent, 'prism');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sanitizeSettings clamps bounds and rejects invalid values', () => {
  const s = sanitizeSettings({
    darkPreset: 'invalid',
    accent: 'amethyst',
    mascotSpec: 'r:w1',
    homeRipple: false,
    convRipple: 'medium',
    smokedFacets: false,
    wallpaperOpacity: 99,
    wallpaperBlur: -10,
    codeFoldThreshold: 999,
  });
  assert.equal(s.darkPreset, DEFAULT_SETTINGS.darkPreset);
  assert.equal(s.accent, 'amethyst');
  assert.equal(s.mascotSpec, 'r:w1');
  assert.equal(s.homeRipple, false);
  assert.equal(s.convRipple, 'medium');
  assert.equal(s.smokedFacets, false);
  assert.equal(s.wallpaperOpacity, 0.65);
  assert.equal(s.wallpaperBlur, 0);
  assert.equal(s.codeFoldThreshold, 80);

  const fallback = sanitizeSettings({ convRipple: 'bogus' });
  assert.equal(fallback.convRipple, 'off');
  assert.equal(fallback.homeRipple, true);
  assert.equal(fallback.smokedFacets, true);
});

test('scene presets apply and detect cleanly while preserving palette and wallpaper', () => {
  const presetIds = Object.keys(SCENE_PRESETS);
  assert.deepEqual(presetIds, ['ultra', 'focus', 'eco']);
  const base = sanitizeSettings({
    darkPreset: 'warm',
    accent: 'terracotta',
    wallpaperId: 'wp-local.png',
    wallpaperKind: 'image',
  });

  for (const presetId of presetIds) {
    const patch = getScenePresetPatch(presetId, base);
    assert.ok(patch);
    const merged = sanitizeSettings({ ...base, ...patch });
    assert.equal(detectActiveScenePreset(merged), presetId);
    assert.equal(merged.darkPreset, 'warm');
    assert.equal(merged.accent, 'terracotta');
    assert.equal(merged.wallpaperId, 'wp-local.png');
  }

  const custom = sanitizeSettings({ ...base, ...getScenePresetPatch('ultra', base), homeRipple: false });
  assert.equal(detectActiveScenePreset(custom), null);
});

test('settings JSON backup export/import round-trips and preserves local wallpaper', () => {
  const current = sanitizeSettings({
    darkPreset: 'warm',
    accent: 'prism',
    homeRipple: true,
    convRipple: 'subtle',
    smokedFacets: true,
    wallpaperId: 'wp-my-local.mp4',
    wallpaperKind: 'video',
  });

  const exportedText = exportSettingsBackup(current);
  const parsedRaw = JSON.parse(exportedText);
  assert.equal(parsedRaw.schema, BACKUP_SCHEMA_ID);
  assert.equal('wallpaperId' in parsedRaw.settings, false);
  assert.equal('wallpaperKind' in parsedRaw.settings, false);

  const receiverCurrent = sanitizeSettings({
    wallpaperId: 'wp-host-existing.png',
    wallpaperKind: 'image',
  });
  const imported = parseSettingsBackup(exportedText, receiverCurrent);
  assert.equal(imported.ok, true);
  assert.equal(imported.settings.darkPreset, 'warm');
  assert.equal(imported.settings.convRipple, 'subtle');
  assert.equal(imported.settings.wallpaperId, 'wp-host-existing.png');
  assert.equal(imported.settings.wallpaperKind, 'image');

  const bad = parseSettingsBackup('{not-json', receiverCurrent);
  assert.equal(bad.ok, false);
});

test('theme stylesheet contains all 4 palettes, ripple host, Smoked Obsidian facets, and studio presets', () => {
  const css = buildStylesheet();
  assert.match(css, /data-op-dark-preset="obsidian"/);
  assert.match(css, /data-op-dark-preset="warm"/);
  assert.match(css, /data-op-light-preset="crystal"/);
  assert.match(css, /data-op-light-preset="alabaster"/);
  assert.match(css, /\.ag-cs-dual-stage/);
  assert.match(css, /--dsw-alias-bg-base/);
  assert.match(css, /\.op-ripple-host/);
  assert.match(css, /\.op-brand-glow/);
  assert.match(css, /\.op-ripple-canvas/);
  assert.match(css, /data-op-facets="1"/);
  assert.match(css, /\[data-message-bubble\]/);
  assert.match(css, /\[data-presented-file\]/);
  assert.match(css, /\.op-preset-grid/);
});

test('built client.js loads cleanly via window.__ModuleLoader__', () => {
  const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  let registered = null;
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(mod) {
          registered = mod;
        },
      },
    },
    globalThis: {},
    console,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  assert.ok(registered);
  assert.equal(registered.id, 'dsh-seven-appearance');
  const plugin = registered.factory((name) => {
    if (name === 'react') return { createElement: () => null, useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), Fragment: Symbol('Fragment') };
    if (name === 'react-dom') return { createPortal: (x) => x };
    throw new Error(`Unexpected require: ${name}`);
  });
  assert.equal(typeof plugin.apply, 'function');
  assert.deepEqual(Array.from(plugin.inject), ['slots']);
  const listeners = new Map();
  const root = new EventTarget();
  sandbox.window.addEventListener = root.addEventListener.bind(root);
  sandbox.window.removeEventListener = root.removeEventListener.bind(root);
  sandbox.localStorage = { getItem: () => '{"enabled":false,"themeMode":"dark"}' };
  const element = {
    setAttribute() {},
    removeAttribute() {},
    getAttribute: () => null,
    style: { setProperty() {}, removeProperty() {} },
  };
  sandbox.document = {
    documentElement: element,
    body: { prepend() {}, appendChild() {} },
    createElement: () => ({ ...element, remove() {} }),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener(type, listener) { listeners.set(listener, type); },
    removeEventListener(_type, listener) { listeners.delete(listener); },
  };
  sandbox.MutationObserver = class { observe() {} disconnect() {} };
  sandbox.requestAnimationFrame = () => 1;
  sandbox.cancelAnimationFrame = () => {};
  sandbox.setTimeout = () => 1;
  sandbox.clearTimeout = () => {};
  sandbox.setInterval = () => 1;
  sandbox.clearInterval = () => {};
  const context = { inject() {}, slots: { inject() {} }, effect(run, label) {
    if (label === 'dsh-obsidian-prism: runtime') this.stop = run();
  } };
  plugin.apply(context);
  assert.ok([...listeners.values()].includes('contextmenu'));
  context.stop();
  assert.ok(![...listeners.values()].includes('contextmenu'));
  assert.match(code, /createRippleController/);
  assert.match(code, /mountBrandHorizonGlow/);
  assert.match(code, /createSelectionAskController/);
  assert.match(code, /createChoreographyController/);
  assert.match(code, /createPrismRimController/);
  assert.match(code, /createStatusVialController/);
  assert.match(code, /resolveUiLang/);
});

test('v0.3.0 i18n resolver handles auto, zh, and en modes', () => {
  assert.equal(resolveUiLang({ uiLanguage: 'zh' }), 'zh');
  assert.equal(resolveUiLang({ uiLanguage: 'en' }), 'en');
  assert.equal(isZhUi({ uiLanguage: 'zh' }), true);
  assert.equal(isZhUi({ uiLanguage: 'en' }), false);
  const autoLang = resolveUiLang({ uiLanguage: 'auto' });
  assert.ok(autoLang === 'zh' || autoLang === 'en');
});

test('v0.3.0 settings defaults, sanitization, and scene presets include new optics & interaction fields', () => {
  assert.equal(DEFAULT_SETTINGS.uiLanguage, 'auto');
  assert.equal(DEFAULT_SETTINGS.prismRimEnabled, true);
  assert.equal(DEFAULT_SETTINGS.streamChoreography, true);
  assert.equal(DEFAULT_SETTINGS.statusVialEnabled, false);
  assert.equal(DEFAULT_SETTINGS.selectionAskEnabled, true);

  const sanitized = sanitizeSettings({
    uiLanguage: 'invalid-lang',
    prismRimEnabled: false,
    streamChoreography: false,
    statusVialEnabled: true,
    selectionAskEnabled: false,
  });
  assert.equal(sanitized.uiLanguage, 'auto');
  assert.equal(sanitized.prismRimEnabled, false);
  assert.equal(sanitized.streamChoreography, false);
  assert.equal(sanitized.statusVialEnabled, false);
  assert.equal(sanitized.selectionAskEnabled, false);

  const ultra = getScenePresetPatch('ultra');
  assert.equal(ultra.prismRimEnabled, true);
  assert.equal(ultra.streamChoreography, true);
  assert.equal(ultra.statusVialEnabled, false);
  assert.equal('selectionAskEnabled' in ultra, false);

  const focus = getScenePresetPatch('focus');
  assert.equal(focus.prismRimEnabled, true);
  assert.equal(focus.streamChoreography, true);
  assert.equal(focus.statusVialEnabled, false);

  const eco = getScenePresetPatch('eco');
  assert.equal(eco.prismRimEnabled, false);
  assert.equal(eco.streamChoreography, false);
  assert.equal(eco.statusVialEnabled, false);
});

test('v0.3.0 selection quote formatter handles quote & explain modes in zh/en', () => {
  const quoteEn = formatSelectionQuote('const x = 1;\nconst y = 2;', 'quote', false);
  assert.match(quoteEn, /^> const x = 1;\n> const y = 2;\n\n$/);

  const explainZh = formatSelectionQuote('WebGL2 shader', 'explain', true);
  assert.match(explainZh, /详细解释.*> WebGL2 shader/s);

  const explainEn = formatSelectionQuote('WebGL2 shader', 'explain', false);
  assert.match(explainEn, /Please explain.*> WebGL2 shader/s);

  const longText = 'a'.repeat(2100);
  assert.equal(formatSelectionQuote(longText, 'quote', false), `> ${longText}\n\n`);
});

test('v0.3.0 stylesheet includes selection pill, choreography, prism rim, status vial, searchable outline, and lang toggle', () => {
  const css = buildStylesheet();
  assert.match(css, /\.op-selection-pill/);
  assert.match(css, /\.op-selection-toast/);
  assert.match(css, /data-op-choreography="1"/);
  assert.match(css, /@keyframes op-block-arrive/);
  assert.match(css, /@keyframes op-details-unfold/);
  assert.match(css, /\.op-prism-rim-canvas/);
  assert.match(css, /\.op-status-vial/);
  assert.match(css, /\.op-status-vial\[data-vial-docked="1"\]/);
  assert.match(css, /\.op-vial-close/);
  assert.match(css, /:not\(\.op-selection-pill\):not\(\.op-selection-toast\)/);
  assert.match(css, /html\[data-op-enabled="1"\]\[data-op-choreography="1"\]\[data-op-complete-pulse="1"\] \[data-composer-card\]/);
  assert.match(css, /\.op-outline-search/);
  assert.match(css, /\.op-outline-tabs/);
  assert.match(css, /\.op-lang-btn/);
});

test('v0.3.0 regression: prism-rim exports notifyStreamingChange and selection-ask dispatches Lexical paste', async () => {
  const { createPrismRimController } = await import('../src/prism-rim-controller.js');
  const { insertTextIntoComposer } = await import('../src/selection-ask-controller.js');

  const rim = createPrismRimController({ getSettings: () => ({ ...DEFAULT_SETTINGS }) });
  assert.equal(typeof rim.notifyStreamingChange, 'function');

  // Verify insertTextIntoComposer dispatches synthetic ClipboardEvent('paste') for Lexical contenteditable
  let pastedText = null;
  let focused = false;
  const fakeComposer = {
    tagName: 'DIV',
    isConnected: true,
    textContent: '',
    getAttribute(attr) {
      return attr === 'contenteditable' ? 'true' : null;
    },
    focus() {
      focused = true;
    },
    dispatchEvent(ev) {
      if (ev.type === 'paste' && ev.clipboardData) {
        pastedText = ev.clipboardData.getData('text/plain');
        ev.preventDefault();
        return false;
      }
      return true;
    },
  };
  const prevDocument = globalThis.document;
  const prevWindow = globalThis.window;
  const prevClipboardEvent = globalThis.ClipboardEvent;
  const prevDataTransfer = globalThis.DataTransfer;
  try {
    globalThis.document = {
      createRange() {
        return { selectNodeContents() {}, collapse() {} };
      },
      execCommand() {
        return false;
      },
    };
    globalThis.window = {
      getSelection() {
        return { removeAllRanges() {}, addRange() {} };
      },
    };
    globalThis.DataTransfer = class FakeDataTransfer {
      constructor() {
        this._map = new Map();
      }
      setData(type, val) {
        this._map.set(type, String(val));
      }
      getData(type) {
        return this._map.get(type) || '';
      }
    };
    globalThis.ClipboardEvent = class FakeClipboardEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.bubbles = Boolean(init.bubbles);
        this.cancelable = Boolean(init.cancelable);
        this.clipboardData = init.clipboardData || null;
        this.defaultPrevented = false;
      }
      preventDefault() {
        this.defaultPrevented = true;
      }
    };

    const ok = insertTextIntoComposer(fakeComposer, '> hello world\n\n');
    assert.equal(ok, true);
    assert.equal(focused, true);
    assert.equal(pastedText, '> hello world\n\n');

    // Verify textarea path still works cleanly
    const events = [];
    const fakeTextarea = {
      tagName: 'TEXTAREA',
      value: 'existing',
      focus() {},
      setSelectionRange() {},
      dispatchEvent(ev) {
        events.push(ev.type);
      },
    };
    assert.equal(insertTextIntoComposer(fakeTextarea, '> quoted\n\n'), true);
    assert.equal(fakeTextarea.value, 'existing\n\n> quoted\n\n');
    assert.deepEqual(events, ['input', 'change']);
  } finally {
    globalThis.document = prevDocument;
    globalThis.window = prevWindow;
    globalThis.ClipboardEvent = prevClipboardEvent;
    globalThis.DataTransfer = prevDataTransfer;
  }
});

test('vendored vendor/ripple-core.js exports WebGL2 glyph field and horizon glow APIs', () => {
  const rippleCode = readFileSync(new URL('../vendor/ripple-core.js', import.meta.url), 'utf8');
  const mod = { exports: {} };
  const sandbox = { module: mod, exports: mod.exports, globalThis: {}, console, Math };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(rippleCode, sandbox);
  assert.equal(typeof mod.exports.createWaveField, 'function');
  assert.equal(typeof mod.exports.createGlyphField, 'function');
  assert.equal(typeof mod.exports.mountBrandHorizonGlow, 'function');
  assert.equal(typeof mod.exports.parseCssColorToRgb, 'function');
  assert.deepEqual(Array.from(mod.exports.parseCssColorToRgb('#669DF6')), [102, 157, 246]);
});

test('vendored vendor/crystal-prism-core.js exports Cut-Crystal refraction APIs', () => {
  const code = readFileSync(new URL('../vendor/crystal-prism-core.js', import.meta.url), 'utf8');
  const mod = { exports: {} };
  const sandbox = { module: mod, exports: mod.exports, globalThis: {}, console, Math };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  assert.equal(typeof mod.exports.mountCrystalPrismBar, 'function');
  assert.equal(typeof mod.exports.resolveCrystalAccentCode, 'function');
  assert.equal(typeof mod.exports.computeProximityFactor, 'function');
  assert.equal(typeof mod.exports.evaluateDeterministicGlints, 'function');
  assert.equal(mod.exports.resolveCrystalAccentCode('default'), 0);
  assert.equal(mod.exports.resolveCrystalAccentCode('warm'), 1);
  assert.equal(mod.exports.resolveCrystalAccentCode('cobalt'), 2);
  assert.equal(mod.exports.resolveCrystalAccentCode('iris'), 3);
  assert.equal(mod.exports.resolveCrystalAccentCode('amber'), 4);
  assert.equal(mod.exports.resolveCrystalAccentCode('mono'), 5);
});

test('unified model picker & reasoning effort slider: localization, search scoring, fixed width & theme CSS', async () => {
  const {
    buildEffortLevels,
    localizeEffortLabel,
    computeEffortVisualState,
    computeKnobFillRatio,
    resolveCrystalAccentForSettings,
    scoreModelRow,
  } = await import('../src/effort-slider-controller.js');

  assert.equal(DEFAULT_SETTINGS.effortSliderEnabled, true);
  assert.equal(DEFAULT_SETTINGS.effortSliderCrystal, true);
  assert.equal(getScenePresetPatch('eco').effortSliderCrystal, false);
  assert.equal(getScenePresetPatch('ultra').effortSliderCrystal, true);

  // ZH / EN localization for standard effort levels
  assert.equal(localizeEffortLabel('off', true), '关闭');
  assert.equal(localizeEffortLabel('low', true), '低');
  assert.equal(localizeEffortLabel('medium', true), '中');
  assert.equal(localizeEffortLabel('high', true), '高');
  assert.equal(localizeEffortLabel('xhigh', true), '极高');
  assert.equal(localizeEffortLabel('max', true), '最高');
  assert.equal(localizeEffortLabel({ isDefault: true }, true), '默认');
  assert.equal(localizeEffortLabel('xhigh', false), 'XHigh');
  assert.equal(localizeEffortLabel({ isDefault: true }, false), 'Default');

  // Model with 4 explicit efforts and defaultEffort defined
  const snap4 = {
    current: { provider: 'openai', model: 'o3', reasoningEffort: 'high' },
    groups: [
      {
        id: 'openai',
        models: [
          {
            id: 'o3',
            reasoning: {
              defaultEffort: 'medium',
              efforts: [
                { id: 'low', name: 'Low' },
                { id: 'medium', name: 'Medium' },
                { id: 'high', name: 'High' },
                { id: 'max', name: 'Max' },
              ],
            },
          },
        ],
      },
    ],
  };
  const parsed4 = buildEffortLevels(snap4);
  assert.equal(parsed4.levels.length, 4);
  assert.deepEqual(parsed4.levels.map((l) => l.label), ['Low', 'Medium', 'High', 'Max']);
  assert.equal(parsed4.activeIndex, 2);

  const parsed4Zh = buildEffortLevels(snap4, { zh: true });
  assert.deepEqual(parsed4Zh.levels.map((l) => l.label), ['低', '中', '高', '最高']);
  assert.equal(parsed4Zh.activeIndex, 2);

  // Model without reasoning efforts yields empty levels
  const snapNone = {
    current: { provider: 'p', model: 'plain' },
    groups: [{ id: 'p', models: [{ id: 'plain' }] }],
  };
  assert.equal(buildEffortLevels(snapNone).levels.length, 0);

  // Search scoring ranks exact/prefix ahead of substring and boosts favorites
  const rowA = { provider: 'anthropic', providerName: 'Anthropic', model: { id: 'claude-opus-4-7', name: 'Claude Opus 4.7' }, favorite: false };
  const rowB = { provider: 'anthropic', providerName: 'Anthropic', model: { id: 'claude-opus-4-7', name: 'Claude Opus 4.7' }, favorite: true };
  assert.ok(scoreModelRow(rowA, 'opus') !== null);
  assert.ok(scoreModelRow(rowB, 'opus') < scoreModelRow(rowA, 'opus'));
  assert.equal(scoreModelRow(rowA, 'nonexistent-xyz'), null);

  // Visual state escalates stars, energy, speed, and tier with level ratio
  const lowVis = computeEffortVisualState(0, 4, 'low');
  const maxVis = computeEffortVisualState(3, 4, 'max');
  const offVis = computeEffortVisualState(0, 4, 'off');
  assert.equal(offVis.tier, 'off');
  assert.equal(offVis.starCount, 0);
  assert.equal(lowVis.tier, 'low');
  assert.equal(maxVis.tier, 'max');
  assert.ok(maxVis.starCount > lowVis.starCount);
  assert.ok(maxVis.energy > lowVis.energy);
  assert.ok(maxVis.speedFactor > lowVis.speedFactor);

  assert.ok(computeKnobFillRatio(0, 328, 24) > 0 && computeKnobFillRatio(0, 328, 24) < 0.15);
  assert.ok(computeKnobFillRatio(1, 328, 24) > 0.85 && computeKnobFillRatio(1, 328, 24) < 1);
  assert.equal(resolveCrystalAccentForSettings({ accent: 'amethyst' }, 'low', true), 'iris');
  assert.equal(resolveCrystalAccentForSettings({ accent: 'follow', darkPreset: 'warm' }, 'high', true), 'warm');
  assert.equal(resolveCrystalAccentForSettings({ accent: 'follow', darkPreset: 'warm' }, 'max', true), 'amber');
  assert.equal(resolveCrystalAccentForSettings({ accent: 'follow', darkPreset: 'obsidian' }, 'max', true), 'default');

  const css = buildStylesheet();
  assert.match(css, /\.op-mp-panel[\s\S]*width:\s*356px;/);
  assert.match(css, /\.op-mp-effort-dock/);
  assert.match(css, /\.op-effort-crystal-cv/);
  assert.match(css, /\.op-effort-stars/);
  assert.match(css, /\.op-effort-stop\[data-active="1"\]/);

  const builtClient = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  assert.match(builtClient, /conversation\.input\.model/);
  assert.match(builtClient, /priority:\s*-1/);
  assert.match(builtClient, /createEffortSliderSlotComponent/);
  assert.match(builtClient, /mountCrystalPrismBar/);
  assert.match(builtClient, /PROVIDER_BRAND_LOGOS/);
  assert.match(builtClient, /onDoubleClick:/);
  assert.match(builtClient, /chooseModel\(row,\s*\{\s*close:\s*false\s*\}\)/);
  assert.match(builtClient, /chooseModel\(row,\s*\{\s*close:\s*true\s*\}\)/);
  assert.doesNotMatch(builtClient, /createContextVialController/);
});

test('provider-logos resolves real brand SVGs for providers & gateway models and scopes gradient IDs', async () => {
  const {
    PROVIDER_BRAND_LOGOS,
    resolveProviderBrandKey,
    getProviderBrandSpec,
    renderProviderLogoSvg,
  } = await import('../src/provider-logos.js');

  assert.ok(Object.keys(PROVIDER_BRAND_LOGOS).length >= 30);

  // Provider rail resolution (including Magpie virtual upstream groups)
  assert.equal(resolveProviderBrandKey('deepseek-account', 'DeepSeek Account'), 'deepseek');
  assert.equal(resolveProviderBrandKey('magpie', 'Magpie'), 'magpie');
  assert.equal(resolveProviderBrandKey('magpie-group:group', '路由组'), 'routegroup');
  assert.equal(resolveProviderBrandKey('magpie-group:codex', 'Codex'), 'codex');
  assert.equal(resolveProviderBrandKey('magpie-group:agy-cli', 'Antigravity'), 'antigravity');
  assert.equal(resolveProviderBrandKey('magpie-group:aws-quick', 'AWS Quick'), 'aws-quick');
  assert.equal(resolveProviderBrandKey('magpie-responses', 'Magpie · Responses'), 'openai');
  assert.equal(resolveProviderBrandKey('magpie-anthropic', 'Magpie · Anthropic'), 'anthropic');
  assert.equal(resolveProviderBrandKey('moonshot', 'Moonshot'), 'kimi');
  assert.equal(resolveProviderBrandKey('dashscope', 'Aliyun DashScope'), 'qwen');
  assert.equal(resolveProviderBrandKey('openrouter', 'OpenRouter'), 'openrouter');
  assert.equal(resolveProviderBrandKey('ollama', 'Ollama'), 'ollama');
  assert.equal(resolveProviderBrandKey('custom-internal-proxy', 'Internal Proxy'), null);

  // Model-level resolution inside multi-model gateways
  assert.equal(resolveProviderBrandKey('magpie-group:agy-cli', 'Antigravity', 'agy-cli/gemini-4-neon', 'Gemini 4 Neon'), 'gemini');
  assert.equal(resolveProviderBrandKey('magpie-group:agy-cli', 'Antigravity', 'agy-cli/claude-opus-5-5', 'Claude Opus 5.5'), 'claude');
  assert.equal(resolveProviderBrandKey('magpie-group:codex', 'Codex', 'codex/gpt-6.2-astra', 'GPT-6.2-Astra'), 'openai');
  assert.equal(resolveProviderBrandKey('magpie-group:aws-quick', 'AWS Quick', 'aws-quick/fast', 'AWS(Haiku, Luna)'), 'aws-quick');
  assert.equal(resolveProviderBrandKey('magpie-group:group', '路由组', 'group/smart-split', '🚀 智能'), 'routegroup');

  // Gradient ID scoping (zero collisions, no raw {{ID}} placeholder left)
  const fakeH = (type, props, ...children) => ({ type, props: props || {}, children: children.flat() });
  const geminiSpec = getProviderBrandSpec('magpie-group:agy-cli', 'Antigravity', 'agy-cli/gemini-4-neon', 'Gemini 4 Neon');
  assert.equal(geminiSpec.key, 'gemini');
  const agySpec = getProviderBrandSpec('magpie-group:agy-cli', 'Antigravity');
  assert.equal(agySpec.key, 'antigravity');
  const tree1 = renderProviderLogoSvg(fakeH, geminiSpec, { size: 16, uid: 'u1' });
  const tree2 = renderProviderLogoSvg(fakeH, agySpec, { size: 16, uid: 'u2' });
  const s1 = JSON.stringify(tree1);
  const s2 = JSON.stringify(tree2);
  assert.ok(s1.includes('u1-g0') && s1.includes('url(#u1-g0)'));
  assert.ok(s2.includes('u2-g0') && s2.includes('url(#u2-g0)'));
  assert.equal(s1.includes('{{ID}}'), false);
  assert.equal(s2.includes('{{ID}}'), false);
});

test('buildModelPickerCatalog regroups Magpie protocol buckets into Magpie logical groups in exact order while preserving real DSH provider IDs', async () => {
  const { buildModelPickerCatalog } = await import('../src/effort-slider-controller.js');
  const { resolveProviderBrandKey } = await import('../src/provider-logos.js');

  const rawGroups = [
    {
      id: 'deepseek-account',
      name: 'DeepSeek',
      models: [{ id: 'deepseek-reasoner', name: 'DeepSeek R1' }],
    },
    {
      id: 'magpie',
      name: 'Magpie',
      models: [
        { id: 'group/smart-split', name: '🚀 智能' },
        { id: 'group/fastest-first', name: '🎁 免费' },
        { id: 'aws-quick/fast', name: 'AWS(Haiku, Luna）' },
        { id: 'aws-quick/balanced', name: 'AWS(Sonnet, Terra）' },
        { id: 'aws-quick/smart', name: 'AWS((Opus,Sol）' },
      ],
    },
    {
      id: 'magpie-responses',
      name: 'Magpie · Responses',
      models: [
        { id: 'codex/gpt-6.1-terra', name: 'GPT-6.1 Terra' },
        { id: 'codex/gpt-6.2-sol', name: 'GPT-6.2-Sol' },
        { id: 'codex/gpt-6.2-astra', name: 'GPT-6.2-Astra' },
      ],
    },
    {
      id: 'magpie-anthropic',
      name: 'Magpie · Anthropic',
      models: [
        { id: 'agy-cli/gemini-4-neon', name: 'Gemini 4 Neon' },
        { id: 'agy-cli/gemini-4-hydrogen', name: 'Gemini 4 Hydrogen' },
        { id: 'agy-cli/claude-opus-5-5', name: 'Claude Opus 5.5' },
        { id: 'agy-cli/claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
      ],
    },
    {
      id: 'ollama',
      name: 'Ollama',
      models: [{ id: 'qwen3:32b', name: 'Qwen3 32B' }],
    },
  ];

  const { displayGroups, allRows } = buildModelPickerCatalog(rawGroups, {
    zh: true,
    favoriteKeys: new Set(['magpie-anthropic\0agy-cli/gemini-4-neon']),
    routableKnown: true,
    routableSet: new Set(['deepseek-account', 'magpie', 'magpie-responses', 'magpie-anthropic']),
  });

  // Exact group order: native before -> Magpie (路由组 -> Codex -> Antigravity -> AWS Quick) -> native after
  assert.deepEqual(
    displayGroups.map((g) => g.id),
    ['deepseek-account', 'magpie-group:group', 'magpie-group:codex', 'magpie-group:agy-cli', 'magpie-group:aws-quick', 'ollama'],
  );
  assert.deepEqual(
    displayGroups.map((g) => g.name),
    ['DeepSeek', '路由组', 'Codex', 'Antigravity', 'AWS Quick', 'Ollama'],
  );
  assert.equal(displayGroups[3].tooltip, 'Antigravity (local agy CLI)');
  assert.deepEqual(
    displayGroups.map((g) => g.count),
    [1, 2, 3, 4, 3, 1],
  );

  // Rail icons match Magpie (NOT Anthropic on Antigravity!)
  assert.deepEqual(
    displayGroups.map((g) => resolveProviderBrandKey(g.id, g.name)),
    ['deepseek', 'routegroup', 'codex', 'antigravity', 'aws-quick', 'ollama'],
  );

  // Real DSH provider IDs, favorites, and routability are preserved on every row
  const neonRow = allRows.find((r) => r.model.id === 'agy-cli/gemini-4-neon');
  assert.equal(neonRow.provider, 'magpie-anthropic');
  assert.equal(neonRow.displayGroupId, 'magpie-group:agy-cli');
  assert.equal(neonRow.favorite, true);
  assert.equal(neonRow.unavailable, false);

  const awsRow = allRows.find((r) => r.model.id === 'aws-quick/fast');
  assert.equal(awsRow.provider, 'magpie');
  assert.equal(awsRow.displayGroupId, 'magpie-group:aws-quick');

  const ollamaGroup = displayGroups.find((g) => g.id === 'ollama');
  assert.equal(ollamaGroup.unavailable, true);
});

test('status-vial-controller permanently disables status capsule and sweeps stale nodes', async () => {
  const { createStatusVialController } = await import('../src/status-vial-controller.js');
  const prevDocument = globalThis.document;
  try {
    const staleVials = [];
    const parent = {
      removeChild(el) {
        const idx = staleVials.indexOf(el);
        if (idx >= 0) staleVials.splice(idx, 1);
        el.parentNode = null;
      },
    };
    staleVials.push({ className: 'op-status-vial', parentNode: parent });
    staleVials.push({ className: 'op-status-vial', parentNode: parent });

    globalThis.document = {
      querySelectorAll(sel) {
        return sel === '.op-status-vial' ? [...staleVials] : [];
      },
    };

    const ctrl = createStatusVialController();
    ctrl.start();
    assert.equal(staleVials.length, 0);
    ctrl.refresh();
    ctrl.notifyStreamingChange(true);
    ctrl.dispose();
    assert.equal(staleVials.length, 0);
  } finally {
    globalThis.document = prevDocument;
  }
});

test('mascot-controller prevents duplicate stages across reloads/orphans and leaves zero stages when off', async () => {
  const { createMascotController } = await import('../src/mascot-controller.js');
  const prevDocument = globalThis.document;
  const prevWindow = globalThis.window;
  try {
    const attrs = new Map();
    const docEl = {
      setAttribute(k, v) { attrs.set(k, String(v)); },
      removeAttribute(k) { attrs.delete(k); },
      hasAttribute(k) { return attrs.has(k); },
      getAttribute(k) { return attrs.get(k) ?? null; },
    };
    const makeEl = (tag) => ({
      tagName: tag.toUpperCase(),
      className: '',
      attrs: new Map(),
      children: [],
      parentNode: null,
      get isConnected() { return this.parentNode !== null || this === card; },
      setAttribute(k, v) { this.attrs.set(k, String(v)); },
      getAttribute(k) { return this.attrs.get(k) ?? null; },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) this.children.splice(idx, 1);
        child.parentNode = null;
        return child;
      },
      querySelector() { return null; },
    });

    const card = makeEl('div');
    // Seed an orphan mascot stage left behind from a prior reload
    const orphanStage = makeEl('div');
    orphanStage.className = 'ag-cs-crab ag-cs-dual-stage';
    orphanStage.setAttribute('data-op-mascot-stage', '1');
    card.appendChild(orphanStage);

    globalThis.window = {
      matchMedia: () => ({ matches: false }),
      addEventListener() {},
      removeEventListener() {},
    };
    globalThis.document = {
      hidden: false,
      documentElement: docEl,
      body: null,
      createElement: makeEl,
      querySelector(sel) {
        return sel === '[data-composer-card]' ? card : null;
      },
      querySelectorAll(sel) {
        if (sel.includes('data-op-mascot-stage')) {
          return card.children.filter(
            (c) => c.getAttribute('data-op-mascot-stage') === '1' || c.className.includes('ag-cs-dual-stage')
          );
        }
        return [];
      },
    };

    let mountedRigCount = 0;
    let disposedRigCount = 0;
    const fakeRigApi = {
      mountDualMascotStage() {
        mountedRigCount += 1;
        return {
          setState() {},
          dispose() { disposedRigCount += 1; },
        };
      },
    };

    let settings = { enabled: true, mascotSpec: 'r:w1', accent: 'follow', darkPreset: 'obsidian', themeMode: 'auto' };
    const ctrl1 = createMascotController({
      getRig: () => fakeRigApi,
      getSettings: () => settings,
    });
    ctrl1.start();
    // Orphan stage must have been swept; strictly 1 stage mounted
    assert.equal(card.children.length, 1);
    assert.equal(mountedRigCount, 1);

    // Simulate HMR / duplicate plugin start without calling ctrl1.dispose()
    const ctrl2 = createMascotController({
      getRig: () => fakeRigApi,
      getSettings: () => settings,
    });
    ctrl2.start();
    // ctrl1 must have been auto-disposed and strictly 1 stage remains
    assert.equal(disposedRigCount, 1);
    assert.equal(card.children.length, 1);
    assert.equal(mountedRigCount, 2);

    // Turning mascots off must leave 0 stages even if a stray stage exists
    const strayStage = makeEl('div');
    strayStage.className = 'ag-cs-crab ag-cs-dual-stage';
    card.appendChild(strayStage);
    assert.equal(card.children.length, 2);

    settings = { ...settings, mascotSpec: 'off' };
    ctrl2.refresh();
    assert.equal(card.children.length, 0);
    assert.equal(disposedRigCount, 2);
    assert.equal(attrs.has('data-op-mascot-active'), false);

    ctrl2.dispose();
  } finally {
    globalThis.document = prevDocument;
    globalThis.window = prevWindow;
  }
});

test('computeMascotObstacles climbs QueueDock roof, hides when tall/overlay, and avoids right toBottom button', async () => {
  const { computeMascotObstacles } = await import('../src/mascot-controller.js');

  const makeBox = ({ rect, children = [], queryMap = {}, closestMap = {}, hidden = false } = {}) => ({
    hidden,
    children,
    firstElementChild: children[0] || null,
    getBoundingClientRect: () => rect,
    querySelector: (sel) => queryMap[sel]?.[0] || null,
    querySelectorAll: (sel) => {
      for (const [key, list] of Object.entries(queryMap)) {
        if (sel.includes(key)) return list;
      }
      return [];
    },
    closest: (sel) => {
      for (const [key, val] of Object.entries(closestMap)) {
        if (sel.includes(key)) return val;
      }
      return null;
    },
    contains: () => false,
  });

  // 1. Clean composer card with no obstacles
  const cardRect = { left: 100, right: 800, top: 600, bottom: 720, width: 700, height: 120 };
  const cleanSeat = makeBox({ rect: { left: 100, right: 800, top: 600, bottom: 720, width: 700, height: 120 } });
  const cleanScope = makeBox({ rect: { left: 0, right: 900, top: 0, bottom: 800, width: 900, height: 800 } });
  const cleanCard = makeBox({
    rect: cardRect,
    closestMap: { 'data-composer-seat': cleanSeat, 'data-conversation-scroll': cleanScope },
  });
  assert.deepEqual(computeMascotObstacles(cleanCard, cleanScope), {
    yieldMode: 'none',
    leapOffsetY: 0,
    popoverRightWidth: 0,
  });

  // 2. Single-row QueueDock above card (tucked 3px under card top) -> leap onto roof
  const queuePanel = makeBox({ rect: { left: 112, right: 788, top: 562, bottom: 603, width: 676, height: 41 } });
  const queueDock = makeBox({
    rect: { left: 112, right: 788, top: 562, bottom: 603, width: 676, height: 41 },
    children: [queuePanel],
  });
  const seatWithQueue = makeBox({
    rect: { left: 100, right: 800, top: 562, bottom: 720, width: 700, height: 158 },
    queryMap: { 'data-queue-dock': [queueDock] },
  });
  const cardWithQueue = makeBox({
    rect: cardRect,
    closestMap: { 'data-composer-seat': seatWithQueue, 'data-conversation-scroll': cleanScope },
  });
  assert.deepEqual(computeMascotObstacles(cardWithQueue, cleanScope), {
    yieldMode: 'leap',
    leapOffsetY: 38,
    popoverRightWidth: 0,
  });

  // 3. Expanded tall QueueDock (> 128px above card) -> auto-hide ('peek')
  const tallQueuePanel = makeBox({ rect: { left: 112, right: 788, top: 410, bottom: 603, width: 676, height: 193 } });
  const tallQueueDock = makeBox({
    rect: { left: 112, right: 788, top: 410, bottom: 603, width: 676, height: 193 },
    children: [tallQueuePanel],
  });
  const seatWithTallQueue = makeBox({
    rect: { left: 100, right: 800, top: 410, bottom: 720, width: 700, height: 310 },
    queryMap: { 'data-queue-dock': [tallQueueDock] },
  });
  const cardWithTallQueue = makeBox({
    rect: cardRect,
    closestMap: { 'data-composer-seat': seatWithTallQueue, 'data-conversation-scroll': cleanScope },
  });
  assert.deepEqual(computeMascotObstacles(cardWithTallQueue, cleanScope), {
    yieldMode: 'peek',
    leapOffsetY: 0,
    popoverRightWidth: 0,
  });

  // 4. Open composer overlay menu (e.g. slash command popup) -> hide immediately
  const overlayMenu = makeBox({ rect: { left: 100, right: 420, top: 380, bottom: 592, width: 320, height: 212 } });
  const overlayAnchor = makeBox({ rect: { left: 100, right: 800, top: 600, bottom: 600, width: 700, height: 0 }, children: [overlayMenu] });
  const cardWithOverlay = makeBox({
    rect: cardRect,
    queryMap: { '[data-composer-overlay]': [overlayAnchor] },
    closestMap: { 'data-composer-seat': cleanSeat, 'data-conversation-scroll': cleanScope },
  });
  assert.deepEqual(computeMascotObstacles(cardWithOverlay, cleanScope), {
    yieldMode: 'peek',
    leapOffsetY: 0,
    popoverRightWidth: 0,
  });

  // 5. Right-side "toBottom" button visible -> narrow patrol corridor via popoverRightWidth
  const toBottomBtn = makeBox({
    rect: { left: 750, right: 784, top: 550, bottom: 584, width: 34, height: 34 },
  });
  const scopeWithToBottom = makeBox({
    rect: { left: 0, right: 900, top: 0, bottom: 800, width: 900, height: 800 },
    queryMap: { toBottom: [toBottomBtn] },
  });
  const cardWithToBottom = makeBox({
    rect: cardRect,
    closestMap: { 'data-composer-seat': cleanSeat, 'data-conversation-scroll': scopeWithToBottom },
  });
  const obsToBottom = computeMascotObstacles(cardWithToBottom, scopeWithToBottom);
  assert.equal(obsToBottom.yieldMode, 'none');
  assert.equal(obsToBottom.leapOffsetY, 0);
  assert.equal(obsToBottom.popoverRightWidth, 62); // (800 - 750) + 12

  // 6. Both QueueDock (leap) and right-side toBottom button (corridor narrow) active together
  const toBottomAboveQueue = makeBox({
    rect: { left: 750, right: 784, top: 512, bottom: 546, width: 34, height: 34 },
  });
  const scopeCombined = makeBox({
    rect: { left: 0, right: 900, top: 0, bottom: 800, width: 900, height: 800 },
    queryMap: { toBottom: [toBottomAboveQueue] },
  });
  const cardCombined = makeBox({
    rect: cardRect,
    closestMap: { 'data-composer-seat': seatWithQueue, 'data-conversation-scroll': scopeCombined },
  });
  assert.deepEqual(computeMascotObstacles(cardCombined, scopeCombined), {
    yieldMode: 'leap',
    leapOffsetY: 38,
    popoverRightWidth: 62,
  });
});

test('measureContentEditableCaret tracks Lexical Shift+Enter <br> newlines and scrollport clipping', async () => {
  const { measureContentEditableCaret } = await import('../src/effects-controller.js');

  const scrollBox = {
    getBoundingClientRect: () => ({ left: 100, right: 700, top: 500, bottom: 640, width: 600, height: 140 }),
  };

  const textHello = { nodeType: 3, nodeValue: 'hello', parentElement: null };
  const spanHello = {
    nodeType: 1,
    tagName: 'SPAN',
    childNodes: [textHello],
    parentElement: null,
    getClientRects: () => [{ left: 114, right: 154, top: 506, bottom: 526, width: 40, height: 20 }],
    getBoundingClientRect: () => ({ left: 114, right: 154, top: 506, bottom: 526, width: 40, height: 20 }),
  };
  textHello.parentElement = spanHello;

  const brLine1 = {
    nodeType: 1,
    tagName: 'BR',
    childNodes: [],
    parentElement: null,
    getBoundingClientRect: () => ({ left: 154, right: 154, top: 506, bottom: 526, width: 0, height: 20 }),
  };
  const brLine2 = {
    nodeType: 1,
    tagName: 'BR',
    childNodes: [],
    parentElement: null,
    getBoundingClientRect: () => ({ left: 114, right: 114, top: 530, bottom: 550, width: 0, height: 20 }),
  };

  const p = {
    nodeType: 1,
    tagName: 'P',
    childNodes: [spanHello, brLine1, brLine2],
    parentElement: null,
    // Notice p.top is Line 1 (504) while p spans 2 lines (height 48)
    getBoundingClientRect: () => ({ left: 114, right: 690, top: 504, bottom: 552, width: 576, height: 48 }),
  };
  spanHello.parentElement = p;
  brLine1.parentElement = p;
  brLine2.parentElement = p;

  const fakeDoc = {
    createRange() {
      let startNode = null;
      let startOff = 0;
      return {
        setStart(n, o) { startNode = n; startOff = o; },
        setEnd() {},
        getClientRects() {
          if (startNode === textHello) {
            return [{ left: 114 + startOff * 8, right: 122 + startOff * 8, top: 506, bottom: 526, width: 8, height: 20 }];
          }
          return [];
        },
        getBoundingClientRect() {
          return this.getClientRects()[0] || { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
        },
      };
    },
  };

  const editorEl = {
    nodeType: 1,
    tagName: 'DIV',
    ownerDocument: fakeDoc,
    contains: (n) => n === editorEl || n === p || n === spanHello || n === textHello || n === brLine1 || n === brLine2,
    closest: (sel) => (sel.includes('data-input-scroll') ? scrollBox : null),
    getBoundingClientRect: () => ({ left: 100, right: 700, top: 500, bottom: 556, width: 600, height: 56 }),
  };
  p.parentElement = editorEl;

  const makeWin = (range) => ({
    getSelection: () => ({
      rangeCount: 1,
      isCollapsed: true,
      getRangeAt: () => range,
    }),
    getComputedStyle: () => ({
      paddingLeft: '14px',
      paddingTop: '4px',
      fontSize: '14px',
      lineHeight: '24px',
    }),
  });

  // 1. After Shift+Enter: collapsed at (<p>, 2) where Chromium returns empty getClientRects()
  //    MUST land on Line 2 (top ~530), NOT jump back to Line 1 (p.top = 504)!
  const afterNewline = measureContentEditableCaret(editorEl, makeWin({
    startContainer: p,
    startOffset: 2,
    getClientRects: () => [],
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
  }));
  assert.ok(afterNewline, 'caret must be measured after Shift+Enter');
  assert.equal(afterNewline.x, 114);
  assert.ok(afterNewline.y >= 528 && afterNewline.y <= 536, `expected line 2 y (~530), got ${afterNewline.y}`);

  // 2. End of line 1 right before <br>: collapsed at (<p>, 1) -> must stay at end of "hello" on Line 1
  const beforeBr = measureContentEditableCaret(editorEl, makeWin({
    startContainer: p,
    startOffset: 1,
    getClientRects: () => [],
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
  }));
  assert.ok(beforeBr);
  assert.equal(beforeBr.x, 154);
  assert.ok(beforeBr.y >= 504 && beforeBr.y <= 512, `expected line 1 y (~506), got ${beforeBr.y}`);

  // 3. Same-Y <br> engine quirk guard: if brLine2 reports same top as brLine1, advance by lineHeight (24px)
  const brSameY = {
    nodeType: 1,
    tagName: 'BR',
    childNodes: [],
    parentElement: p,
    getBoundingClientRect: () => ({ left: 114, right: 114, top: 506, bottom: 526, width: 0, height: 20 }),
  };
  p.childNodes = [spanHello, brLine1, brSameY];
  const guarded = measureContentEditableCaret(editorEl, makeWin({
    startContainer: p,
    startOffset: 2,
    getClientRects: () => [],
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
  }));
  assert.ok(guarded);
  assert.equal(guarded.x, 114);
  assert.ok(guarded.y >= 528 && guarded.y <= 536, `expected guarded line 2 y (~532), got ${guarded.y}`);

  // 4. Scrolled out of [data-input-scroll] viewport -> clipped (returns null)
  const brOffscreen = {
    nodeType: 1,
    tagName: 'BR',
    childNodes: [],
    parentElement: p,
    getBoundingClientRect: () => ({ left: 114, right: 114, top: 680, bottom: 700, width: 0, height: 20 }),
  };
  p.childNodes = [spanHello, brLine1, brOffscreen];
  const clipped = measureContentEditableCaret(editorEl, makeWin({
    startContainer: p,
    startOffset: 2,
    getClientRects: () => [],
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
  }));
  assert.equal(clipped, null);
});

test('dual-mascot-rig syncs habitat prop and fxCanvas during QueueDock leap and toBottom avoidance', () => {
  const rigSrc = readFileSync(new URL('../vendor/dual-mascot-rig.js', import.meta.url), 'utf8');
  assert.match(rigSrc, /const syncHabitatLayout\s*=/);
  assert.match(rigSrc, /habitatCanvas\.style\.right\s*=\s*`\$\{rightPx\}px`/);
  assert.match(rigSrc, /habitatCanvas\.style\.transform\s*=\s*liftY\s*\?/);
  assert.match(rigSrc, /fxCanvas\.style\.transform\s*=\s*liftY\s*\?/);
  const builtClient = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  assert.match(builtClient, /const syncHabitatLayout\s*=/);
});

test('magpie group order follows magpie listing', async () => {
  const { buildModelPickerCatalog } = await import('../src/effort-slider-controller.js');
  const { displayGroups } = buildModelPickerCatalog([{ id: 'magpie', name: 'Magpie', models: [
    { id: 'kiro/a' }, { id: 'codex/b' }, { id: 'aws-quick/c' } ] }], { zh: true, magpieOrder: ['aws-quick', 'kiro', 'codex'] });
  assert.deepEqual(displayGroups.map((g) => g.name), ['AWS Quick', 'Kiro', 'Codex']);
});

test('prism rim aligns to composer card border-box and superellipse corner-shape without arcTo drift', async () => {
  const { computePrismRimLayout } = await import('../src/prism-rim-controller.js');
  const rimSrc = readFileSync(new URL('../src/prism-rim-controller.js', import.meta.url), 'utf8');
  const css = buildStylesheet();

  // Guard: never draw circular canvas arcTo paths that diverge from CSS corner-shape: superellipse(1.5)
  assert.doesNotMatch(rimSrc, /\barcTo\s*\(/, 'prism-rim-controller must clip via CSS mask shell, not canvas arcTo()');

  // Guard: CSS mask shell inherits corner-shape and excludes content-box like ::before
  assert.match(css, /\.op-prism-rim-shell\s*\{[^}]*corner-shape:\s*inherit;[^}]*mask-composite:\s*exclude;/s);
  assert.match(css, /\[data-composer-card\]::before\s*\{[^}]*corner-shape:\s*inherit;/s);

  // Guard: composer card keeps --op-radius-card and border: 0 even alongside dsh-usage-rings (.ur-row)
  assert.match(css, /html\[data-op-enabled="1"\] \[data-composer-card\]:has\(\+ \[data-composer-dock\] \.ur-row\)\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*var\(--op-radius-card\);/s);

  // Guard: completion pulse on [data-composer-card] must not clobber border-radius with --op-radius-sm
  const cardPulseRule = css.match(/html\[data-op-enabled="1"\]\[data-op-choreography="1"\]\[data-op-complete-pulse="1"\] \[data-composer-card\]\s*\{([^}]*)\}/);
  assert.ok(cardPulseRule, 'expected dedicated complete-pulse rule for [data-composer-card]');
  assert.doesNotMatch(cardPulseRule[1], /border-radius\s*:/, 'complete-pulse on [data-composer-card] must not override border-radius');

  // Layout math: borderless superellipse card (soft 20px)
  const softLayout = computePrismRimLayout({
    borderTopWidth: '0px',
    borderRightWidth: '0px',
    borderBottomWidth: '0px',
    borderLeftWidth: '0px',
    borderTopLeftRadius: '20px',
    borderTopRightRadius: '20px',
    borderBottomRightRadius: '20px',
    borderBottomLeftRadius: '20px',
    cornerShape: 'superellipse(1.5)',
  }, 1.75);
  assert.equal(softLayout.top, '-1.5px');
  assert.equal(softLayout.left, '-1.5px');
  assert.equal(softLayout.borderTopLeftRadius, '21.5px');
  assert.equal(softLayout.cornerShape, 'superellipse(1.5)');

  // Layout math: card with 1px border still aligns to outer border-box edge
  const borderedLayout = computePrismRimLayout({
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
    borderBottomRightRadius: '16px',
    borderBottomLeftRadius: '0px',
    cornerShape: 'superellipse(1.5)',
  }, 2.1);
  assert.equal(borderedLayout.top, '-2.5px');
  assert.equal(borderedLayout.left, '-2.5px');
  assert.equal(borderedLayout.padding, '2.1px');
  assert.equal(borderedLayout.borderTopLeftRadius, '17.5px');
  assert.equal(borderedLayout.borderBottomLeftRadius, '0px');
});

test('all circular and pill stylesheet rules opt out of global superellipse with corner-shape: round', () => {
  const css = buildStylesheet();
  const blocks = css.match(/[^{}]+\{[^{}]+\}/g) || [];
  const offending = [];
  for (const block of blocks) {
    if (/border-radius:\s*(?:50%|999px|var\(--op-radius-pill[^)]*\))\s*;/.test(block)) {
      if (!/corner-shape:\s*round\s*;/.test(block)) {
        offending.push(block.split('{')[0].trim());
      }
    }
  }
  assert.deepEqual(
    offending,
    [],
    `Full-round/pill CSS rules must include "corner-shape: round;" so DSH superellipse(1.5) does not square them: ${offending.join(', ')}`
  );
});

test('main composer lookup ignores sidebar side-question cards across controllers', async () => {
  const { findMainComposerCard, findComposerInput } = await import('../src/selection-ask-controller.js');

  const makeCard = (id, { sidebar = false, hidden = false } = {}) => {
    const editor = {
      id: `${id}-editor`,
      closest(sel) {
        if (sidebar && sel.includes('.op-side-question')) return { className: 'op-side-question' };
        return null;
      },
    };
    return {
      id,
      hidden,
      closest(sel) {
        if (sidebar && (sel.includes('.op-side-question') || sel.includes('[data-sidebar-right-session]'))) {
          return { className: 'op-side-question' };
        }
        if (hidden && sel.includes('[hidden]')) return { hidden: true };
        return null;
      },
      querySelector(sel) {
        return sel.includes('contenteditable') ? editor : null;
      },
      _editor: editor,
    };
  };

  const sidebarCard = makeCard('sidebar', { sidebar: true });
  const hiddenCard = makeCard('hidden', { hidden: true });
  const mainCard = makeCard('main');
  const fakeDoc = {
    querySelectorAll(sel) {
      if (sel === '[data-composer-card]') return [sidebarCard, hiddenCard, mainCard];
      return [];
    },
    querySelector(sel) {
      if (sel === '[data-composer-card]') return sidebarCard;
      return sidebarCard._editor;
    },
  };

  assert.equal(findMainComposerCard(fakeDoc), mainCard);
  assert.equal(findComposerInput(fakeDoc), mainCard._editor);

  // If only a sidebar card exists, never hijack it as the main composer card
  const sidebarOnlyDoc = {
    querySelectorAll(sel) {
      return sel === '[data-composer-card]' ? [sidebarCard] : [];
    },
    querySelector(sel) {
      return sel === '[data-composer-card]' ? sidebarCard : sidebarCard._editor;
    },
  };
  assert.equal(findMainComposerCard(sidebarOnlyDoc), null);
  assert.equal(findComposerInput(sidebarOnlyDoc), null);

  // Guard: mascot and prism-rim must route through findMainComposerCard instead of raw document.querySelector
  const mascotSrc = readFileSync(new URL('../src/mascot-controller.js', import.meta.url), 'utf8');
  const rimSrc = readFileSync(new URL('../src/prism-rim-controller.js', import.meta.url), 'utf8');
  assert.doesNotMatch(mascotSrc, /document\.querySelector\(\s*['"]\[data-composer-card\]['"]\s*\)/);
  assert.doesNotMatch(rimSrc, /document\.querySelector\(\s*['"]\[data-composer-card\]['"]\s*\)/);
});

test('prompt-suggest passes reasoning_effort minimal for doubao-seed-2 models only', async (t) => {
  const route = createHostHandlers().find(({ path }) => path.endsWith('/prompt-suggest'));
  const sentBodies = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).endsWith('/v1/models')) {
      return Response.json({
        data: [
          { id: 'volcengine/doubao-seed-2-0-mini-260428', display_name: 'doubao-seed-2-0-mini' },
          { id: 'qwen-cn/qwen-flash-2025-07-28', display_name: 'qwen-flash' },
        ],
      });
    }
    sentBodies.push(JSON.parse(String(init?.body || '{}')));
    return Response.json({ choices: [{ message: { content: '继续测试一下' } }] });
  });

  const r1 = await (await route.fetch(new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'volcengine/doubao-seed-2-0-mini-260428',
      user: '测试',
      assistant: '已切换完成。',
      zh: true,
    }),
  }))).json();
  assert.equal(r1.ok, true);
  assert.equal(sentBodies[0].reasoning_effort, 'minimal');

  const r2 = await (await route.fetch(new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen-cn/qwen-flash-2025-07-28',
      user: '测试',
      assistant: '已切换完成。',
      zh: true,
    }),
  }))).json();
  assert.equal(r2.ok, true);
  assert.equal('reasoning_effort' in sentBodies[1], false);
});

test('prompt-suggest returns three divergent candidates and Shift+Tab cycles them without a new request', async (t) => {
  const route = createHostHandlers().find(({ path }) => path.endsWith('/prompt-suggest'));
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).endsWith('/v1/models')) {
      return Response.json({ data: [{ id: 'volcengine/doubao-seed-2-0-mini-260428', display_name: 'mini' }] });
    }
    return Response.json({
      choices: [{ message: { content: '1. 这是什么意思\n2. 会不会影响别的地方\n- 要花多少钱\n继续' } }],
    });
  });
  const res = await (await route.fetch(new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'volcengine/doubao-seed-2-0-mini-260428', assistant: '已改好。', zh: true }),
  }))).json();
  assert.equal(res.ok, true);
  assert.deepEqual(res.texts, ['这是什么意思', '会不会影响别的地方', '要花多少钱']);
  assert.equal(res.text, '这是什么意思');

});

test('suggestion effect events are recorded and summarised into accept rate and latency', async (t) => {
  const { getDataDirs, appendSuggestEvent, summarizeSuggestEvents } = await import('../index.js');
  const dir = mkdtempSync(join(tmpdir(), 'dsh-op-events-'));
  try {
    const dirs = getDataDirs(dir);
    for (const ev of [
      { kind: 'shown', model: 'volcengine/doubao-seed-2-0-mini-260428', ms: 480, source: 'model' },
      { kind: 'accepted', model: 'volcengine/doubao-seed-2-0-mini-260428', ms: 2100 },
      { kind: 'shown', model: 'volcengine/doubao-seed-2-0-mini-260428', ms: 620, source: 'model' },
      { kind: 'dismissed', model: 'volcengine/doubao-seed-2-0-mini-260428' },
      { kind: 'shown', model: 'local', ms: 12, source: 'local' },
      { kind: 'cycled', model: 'local' },
      { kind: 'bogus' },
    ]) {
      await appendSuggestEvent(dirs, ev);
    }

    const { createHostHandlers: host } = await import('../index.js');
    const statsRoute = host(dir).find(({ path }) => path.endsWith('/suggest-stats'));
    const stats = (await (await statsRoute.fetch(new Request('http://localhost'))).json()).stats;
    assert.equal(stats.shown, 3);
    assert.equal(stats.accepted, 1);
    assert.equal(stats.dismissed, 1);
    assert.equal(stats.cycled, 1);
    assert.equal(stats.acceptRate, 50);
    assert.equal(stats.latency.samples, 3);
    assert.equal(stats.byModel['volcengine/doubao-seed-2-0-mini-260428'].shown, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // 没有事件时不该报错，接受率为空
  assert.equal(summarizeSuggestEvents([]).acceptRate, null);
});

test('settings panel shows accept rate and latency from the stats endpoint', () => {
  const ui = readFileSync(new URL('../src/studio-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /suggest-stats/);
  assert.match(ui, /promptSuggestStatsLine/);
  assert.match(ui, /promptSuggestStatsEmpty/);
  // 文案不能承诺界面上没有的东西
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.match(changelog, /采纳率/);
});

test('speech samples are stored and fed back into the next suggestion prompt', async (t) => {
  const { getDataDirs, appendSpeechSample, readSpeechSamples } = await import('../index.js');
  const dir = mkdtempSync(join(tmpdir(), 'dsh-op-samples-'));
  try {
    const dirs = getDataDirs(dir);
    assert.deepEqual(await readSpeechSamples(dirs), []);
    await appendSpeechSample(dirs, '  继续  ');
    await appendSpeechSample(dirs, '这是什么意思');
    await appendSpeechSample(dirs, '继续');
    // 重复出现的会挪到最新，保持「最近说的在最后」
    assert.deepEqual(await readSpeechSamples(dirs), ['这是什么意思', '继续']);

    for (let i = 0; i < 50; i += 1) await appendSpeechSample(dirs, `第${i}句`);
    const kept = await readSpeechSamples(dirs);
    assert.equal(kept.length, 40);
    assert.equal(kept[kept.length - 1], '第49句');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // 生成建议时把他的话带进提示词
  const dir2 = mkdtempSync(join(tmpdir(), 'dsh-op-samples2-'));
  try {
    const route = createHostHandlers(dir2).find(({ path }) => path.endsWith('/prompt-suggest'));
    let promptText = '';
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      if (String(url).endsWith('/v1/models')) {
        return Response.json({ data: [{ id: 'volcengine/doubao-seed-2-0-mini-260428', display_name: 'mini' }] });
      }
      promptText = JSON.parse(String(init?.body || '{}')).messages[1].content;
      return Response.json({ choices: [{ message: { content: '现在刷新就行？' } }] });
    });
    const sampleRoute = createHostHandlers(dir2).find(({ path }) => path.endsWith('/speech-sample'));
    await sampleRoute.fetch(new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '我要效果好的那个' }),
    }));
    await route.fetch(new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assistant: '有两个方案可选。', zh: true, model: 'volcengine/doubao-seed-2-0-mini-260428' }),
    }));
    assert.match(promptText, /他平时真这么说过/);
    assert.match(promptText, /我要效果好的那个/);
  } finally {
    rmSync(dir2, { recursive: true, force: true });
  }
});

test('prompt-suggest sends handoff for action-back turns and never asks the user to redo it', async (t) => {
  const { isWaitingOnUser } = await import('../src/prompt-suggest-controller.js');
  const route = createHostHandlers().find(({ path }) => path.endsWith('/prompt-suggest'));
  let systemText = '';
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).endsWith('/v1/models')) {
      return Response.json({ data: [{ id: 'volcengine/doubao-seed-2-0-mini-260428', display_name: 'mini' }] });
    }
    systemText = JSON.parse(String(init?.body || '{}')).messages[0].content;
    return Response.json({ choices: [{ message: { content: '直接授权GitHub' } }] });
  });

  const authText = '现在只差 GitHub 这一步需要你点两下，验证码已复制到剪贴板，在输入框粘贴后点继续。';
  assert.equal(isWaitingOnUser(authText), true);
  assert.equal(isWaitingOnUser('已改好，24 项测试通过。'), false);

  const res = await (await route.fetch(new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'volcengine/doubao-seed-2-0-mini-260428',
      assistant: authText,
      zh: true,
      handoff: true,
    }),
  }))).json();
  assert.match(systemText, /早就做完了/);
  assert.equal(res.text, '已经弄好了，继续');
});

test('sidebar tools register the More-menu entries through the slot inject, not at apply time', () => {
  const source = readFileSync(new URL('../src/sidebar-tools.js', import.meta.url), 'utf8');
  assert.match(
    source,
    /ctx\.slots\.inject\('sidebar\.panellist\.actions', \(\) => \{/,
    'Sidebar actions must be registered inside the slot inject; apply-time registrations never reach the More menu',
  );
  assert.match(source, /id: 'seven-appearance-edit-sidebar'/, 'The "Edit sidebar…" entry must be registered');
  assert.match(source, /isZh\(\) \? '编辑侧栏…' : 'Edit sidebar…'/, 'The menu label must stay bilingual');
  const outsideInject = source
    .split("ctx.slots.inject('sidebar.panellist.actions'")[0];
  assert.ok(
    !outsideInject.includes("name: 'sidebar.panellist.actions'"),
    'No sidebar.panellist.actions registration may live outside the inject callback',
  );
});
