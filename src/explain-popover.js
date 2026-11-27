// Inline explain popover for dsh-obsidian-prism.
//
// 划词 → 在原生「引用文本」右边点「解释」→ 选区旁边弹出一个小窗，用最快的模型
// 结合上下文把这段讲清楚。它不建会话、不建分支、不往会话列表里留东西；
// 想继续问就在小窗里接着打，点外面、按 Esc 或点叉就关掉。
import { isZhUi } from './i18n.js';

const HOST_CLASS = 'op-explain';
const MAX_CONTEXT = 2400;
const PANEL_WIDTH = 400;
const PANEL_MIN_WIDTH = 240;
const PANEL_MAX_HEIGHT = 340;
const GAP = 8;

const TOOLBAR_TEXT = new Set(['复制', '赞', '踩', '分享', '引用', 'Copy', 'Like', 'Dislike', 'Share', 'Quote']);

function textOf(el) {
  return String(el?.innerText || el?.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** 去掉模型爱用的 **加粗** 和 `反引号` 标记，小窗里按纯文本显示。 */
function plainify(text) {
  return String(text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '');
}

/**
 * 选中文字所在的那条消息：用消息气泡的正文做「上下文」，不含下面的复制/赞踩工具条。
 * @param anchorEl - 选区起点所在的元素。
 * @returns 该消息的角色与正文（超长截断）。
 */
export function readSelectionContext(anchorEl) {
  let node = anchorEl && anchorEl.nodeType === 1 ? anchorEl : anchorEl?.parentElement || null;
  let bubble = null;
  let row = null;
  while (node) {
    if (!bubble && node.getAttribute?.('data-message-bubble')) bubble = node;
    if (node.getAttribute?.('data-chat-flow-kind')) {
      row = node;
      break;
    }
    node = node.parentElement || null;
  }
  const role = row?.getAttribute?.('data-chat-flow-kind') === 'user' ? 'user' : 'assistant';
  const source = bubble || row || null;
  let context = textOf(source);
  if (!context && row) {
    context = String(row.innerText || row.textContent || '')
      .split('\n')
      .filter((line) => line.trim() && !TOOLBAR_TEXT.has(line.trim()))
      .join('\n')
      .trim();
  }
  return { role, context: context.slice(0, MAX_CONTEXT) };
}

/**
 * 划词解释小窗。
 * @param options.getSettings - 读取插件设置（只用来决定界面语言）。
 * @returns 显示、关闭、启动与销毁接口。
 */
export function createExplainPopover({ getSettings }) {
  let host = null;
  let headEl = null;
  let quoteEl = null;
  let threadEl = null;
  let formEl = null;
  let inputEl = null;
  let sendEl = null;
  let statusEl = null;
  let busy = false;
  let abort = null;
  let run = 0;
  let anchor = null;
  let quote = '';
  let context = '';
  let role = 'assistant';
  let history = [];
  let disposed = false;
  let started = false;

  const zh = () => isZhUi(getSettings());

  function ensureHost() {
    if (host && host.isConnected !== false) return host;
    host = document.createElement('div');
    host.className = HOST_CLASS;
    host.setAttribute('data-op-ui', '1');
    host.setAttribute('translate', 'no');
    host.setAttribute('role', 'dialog');
    host.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    host.addEventListener('mousedown', (ev) => ev.stopPropagation());

    headEl = document.createElement('div');
    headEl.className = 'op-explain-head';
    const title = document.createElement('span');
    title.className = 'op-explain-title';
    title.textContent = zh() ? '解释' : 'Explain';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'op-explain-close';
    close.setAttribute('aria-label', zh() ? '关闭解释' : 'Close explanation');
    close.textContent = '×';
    close.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      hide();
    });
    headEl.append(title, close);

    quoteEl = document.createElement('blockquote');
    quoteEl.className = 'op-explain-quote';

    threadEl = document.createElement('div');
    threadEl.className = 'op-explain-thread';

    statusEl = document.createElement('p');
    statusEl.className = 'op-explain-status';
    statusEl.setAttribute('role', 'status');

    formEl = document.createElement('form');
    formEl.className = 'op-explain-form';
    inputEl = document.createElement('textarea');
    inputEl.className = 'op-explain-input';
    inputEl.rows = 1;
    inputEl.placeholder = zh() ? '接着问…' : 'Ask a follow-up…';
    inputEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        submit();
      }
    });
    sendEl = document.createElement('button');
    sendEl.type = 'submit';
    sendEl.className = 'op-explain-send';
    sendEl.textContent = zh() ? '问' : 'Ask';
    formEl.append(inputEl, sendEl);
    formEl.addEventListener('submit', (ev) => {
      ev.preventDefault();
      submit();
    });

    host.append(headEl, quoteEl, threadEl, statusEl, formEl);
    document.body.appendChild(host);
    return host;
  }

  function setStatus(text, tone = '') {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.setAttribute('data-tone', text ? tone : '');
    statusEl.hidden = !text;
  }

  function appendTurn(kind, text) {
    const item = document.createElement('div');
    item.className = 'op-explain-item';
    item.setAttribute('data-role', kind);
    const body = document.createElement('p');
    body.className = 'op-explain-text';
    body.textContent = text || '';
    item.appendChild(body);
    threadEl.appendChild(item);
    return body;
  }

  function scrollToEnd() {
    if (threadEl) threadEl.scrollTop = threadEl.scrollHeight;
  }

  function place(rect) {
    if (!host || !rect) return;
    const viewWidth = window.innerWidth || 1280;
    const viewHeight = window.innerHeight || 800;
    const width = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_WIDTH, viewWidth - 24));
    host.style.width = `${width}px`;
    const below = rect.bottom + GAP;
    const above = rect.top - GAP - PANEL_MAX_HEIGHT;
    const top = below + PANEL_MAX_HEIGHT <= viewHeight - 12 || above < 12 ? below : above;
    const left = Math.max(12, Math.min(rect.left, viewWidth - width - 12));
    host.style.left = `${Math.round(left)}px`;
    host.style.top = `${Math.round(Math.max(12, Math.min(top, viewHeight - 96)))}px`;
    host.style.maxHeight = `${Math.max(180, Math.min(PANEL_MAX_HEIGHT, viewHeight - top - 24))}px`;
  }

  function clearThread() {
    if (!threadEl) return;
    while (threadEl.firstChild) threadEl.removeChild(threadEl.firstChild);
  }

  function abortRun() {
    run += 1;
    busy = false;
    if (abort) {
      try {
        abort.abort();
      } catch {
        // ignore
      }
      abort = null;
    }
  }

  async function ask(question) {
    if (busy) return;
    const seq = ++run;
    busy = true;
    const picked = getSettings()?.promptSuggestModel || '';
    if (sendEl) sendEl.disabled = true;
    setStatus(zh() ? '正在解释…' : 'Reading…');
    const answerEl = appendTurn('assistant', '');
    scrollToEnd();
    abort = typeof AbortController === 'function' ? new AbortController() : null;
    try {
      const res = await fetch('/api/dsh-obsidian-prism/explain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: quote,
          context,
          role,
          zh: zh(),
          ...(picked && picked !== 'local' ? { model: picked } : {}),
          ...(question ? { question } : {}),
          ...(history.length ? { history } : {}),
        }),
        ...(abort ? { signal: abort.signal } : {}),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      let raw = '';
      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (seq !== run) return;
          raw += decoder.decode(value, { stream: true });
          answerEl.textContent = plainify(raw);
          scrollToEnd();
        }
        raw += decoder.decode();
      } else {
        raw = await res.text();
      }
      if (seq !== run) return;
      const answer = plainify(raw).trim();
      answerEl.textContent = answer || (zh() ? '没读出结果，再问一次试试。' : 'No answer, try again.');
      if (answer) {
        history = [
          ...history.slice(-6),
          { role: 'user', content: question || (zh() ? '解释一下这段是什么意思。' : 'Explain what this passage means.') },
          { role: 'assistant', content: answer },
        ];
      }
      setStatus('');
    } catch (error) {
      if (seq !== run) return;
      answerEl.textContent = '';
      if (answerEl.parentNode) answerEl.parentNode.remove();
      setStatus(zh() ? '解释没拿到结果，再点一次试试。' : 'Could not get an answer, try again.', 'err');
    } finally {
      if (seq === run) {
        busy = false;
        abort = null;
        if (sendEl) sendEl.disabled = false;
        scrollToEnd();
      }
    }
  }

  function submit() {
    const question = String(inputEl?.value || '').trim();
    if (!question || busy) return;
    inputEl.value = '';
    appendTurn('user', question);
    scrollToEnd();
    ask(question);
  }

  function show({ text, anchor: anchorEl, rect }) {
    const value = String(text || '').trim();
    if (!value || disposed) return;
    abortRun();
    const settings = getSettings();
    if (!settings?.enabled || !settings?.selectionAskEnabled) return;
    ensureHost();
    const info = readSelectionContext(anchorEl);
    anchor = anchorEl || null;
    quote = value;
    context = info.context;
    role = info.role;
    history = [];
    busy = false;
    clearThread();
    if (quoteEl) quoteEl.textContent = value;
    setStatus('');
    host.setAttribute('data-visible', '1');
    host.hidden = false;
    place(rect || rectOf(anchorEl));
    ask('');
  }

  function rectOf(el) {
    const r = el?.getBoundingClientRect?.();
    if (!r || (r.width === 0 && r.height === 0)) return { left: 120, top: 120, right: 320, bottom: 150, width: 200, height: 30 };
    return r;
  }

  function hide() {
    abortRun();
    if (host) {
      host.removeAttribute('data-visible');
      host.hidden = true;
      host.remove();
    }
    host = null;
    headEl = null;
    quoteEl = null;
    threadEl = null;
    formEl = null;
    inputEl = null;
    sendEl = null;
    statusEl = null;
    quote = '';
    context = '';
    history = [];
    anchor = null;
  }

  function isOpen() {
    return Boolean(host && host.isConnected !== false && !host.hidden);
  }

  const onPointerDown = (ev) => {
    if (!isOpen()) return;
    const target = ev?.target;
    if (host && target && host.contains && host.contains(target)) return;
    hide();
  };

  const onKeyDown = (ev) => {
    if (!isOpen()) return;
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      hide();
    }
  };

  const onScrollOrResize = () => {
    if (!isOpen() || !anchor) return;
    place(rectOf(anchor));
  };

  function start() {
    if (started || disposed) return;
    started = true;
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
  }

  function refresh() {
    const settings = getSettings();
    if (!settings?.enabled && isOpen()) hide();
  }

  function dispose() {
    disposed = true;
    started = false;
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
    hide();
  }

  return { show, hide, isOpen, start, refresh, dispose };
}
