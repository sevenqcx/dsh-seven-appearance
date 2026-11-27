// Selection Quick-Ask & Quote Bar for dsh-obsidian-prism
import { isZhUi } from './i18n.js';

export function formatSelectionQuote(rawText) {
  const cleaned = String(rawText ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!cleaned) return '';
  const quoted = cleaned
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');

  return `${quoted}\n\n`;
}

const COMPOSER_SIDEBAR_EXCLUDED = '[data-sidebar-right-session], .op-explain';

export function findMainComposerCard(doc = document) {
  if (!doc) return null;
  const isMainVisible = (el) =>
    Boolean(el && !el.hidden && !el.closest?.(COMPOSER_SIDEBAR_EXCLUDED) && !el.closest?.('[hidden], [inert]'));
  if (typeof doc.querySelectorAll === 'function') {
    const cards = doc.querySelectorAll('[data-composer-card]');
    for (const card of cards) {
      if (isMainVisible(card)) return card;
    }
    if (cards && cards.length > 0) return null;
  }
  const single = doc.querySelector?.('[data-composer-card]') || null;
  return single && isMainVisible(single) ? single : null;
}

export function findComposerInput(doc = document) {
  if (!doc) return null;
  const card = findMainComposerCard(doc);
  if (card) {
    const ce = card.querySelector('[contenteditable="true"]');
    if (ce) return ce;
    const ta = card.querySelector('textarea:not([disabled])');
    if (ta) return ta;
  }
  const isMain = (el) => Boolean(el && !el.closest?.(COMPOSER_SIDEBAR_EXCLUDED));
  const fallback =
    doc.querySelector('[data-composer-card] [contenteditable="true"]') ||
    doc.querySelector('textarea[data-composer-input], textarea:not([disabled]):not(.op-hidden-input)') ||
    doc.querySelector('[contenteditable="true"]');
  return isMain(fallback) ? fallback : null;
}

function createSyntheticPasteEvent(text) {
  let dt = null;
  try {
    if (typeof DataTransfer === 'function') {
      dt = new DataTransfer();
      dt.setData('text/plain', text);
    }
  } catch {
    dt = null;
  }
  if (!dt) {
    dt = {
      types: ['text/plain'],
      files: [],
      items: [],
      getData(type) {
        return type === 'text/plain' || type === 'text' ? text : '';
      },
    };
  }

  let ev = null;
  try {
    if (typeof ClipboardEvent === 'function') {
      ev = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
    }
  } catch {
    ev = null;
  }
  if (!ev) {
    ev = new Event('paste', { bubbles: true, cancelable: true });
  }
  try {
    if (!ev.clipboardData || ev.clipboardData.getData?.('text/plain') !== text) {
      Object.defineProperty(ev, 'clipboardData', {
        configurable: true,
        value: dt,
      });
    }
  } catch {
    // ignore if non-configurable
  }
  return ev;
}

function moveCaretToEnd(el) {
  try {
    const doc = el.ownerDocument || document;
    const view = doc.defaultView || window;
    const sel = view?.getSelection?.();
    if (!sel) return;
    const range = doc.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // ignore caret placement error
  }
}

export function insertTextIntoComposer(inputEl, snippet) {
  if (!inputEl || !snippet) return false;
  const tag = String(inputEl.tagName || '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'INPUT') {
    const prev = inputEl.value || '';
    const sep = prev && !prev.endsWith('\n') ? '\n\n' : '';
    const next = `${prev}${sep}${snippet}`;
    const proto = tag === 'TEXTAREA'
      ? (typeof HTMLTextAreaElement !== 'undefined' ? HTMLTextAreaElement.prototype : null)
      : (typeof HTMLInputElement !== 'undefined' ? HTMLInputElement.prototype : null);
    const setter = proto ? Object.getOwnPropertyDescriptor(proto, 'value')?.set : null;
    if (setter) setter.call(inputEl, next);
    else inputEl.value = next;
    inputEl.focus?.();
    if (typeof inputEl.setSelectionRange === 'function') {
      inputEl.setSelectionRange(next.length, next.length);
    }
    inputEl.dispatchEvent?.(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent?.(new Event('change', { bubbles: true }));
    inputEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    return true;
  }

  if (inputEl.isContentEditable || inputEl.getAttribute?.('contenteditable') === 'true') {
    const doc = inputEl.ownerDocument || document;
    const rawPrev = (inputEl.textContent || '').replace(/\u200B/g, '');
    const prevTrimmed = rawPrev.trimEnd();
    const sep = prevTrimmed && !rawPrev.endsWith('\n') ? '\n\n' : '';
    const payload = `${sep}${snippet}`;

    inputEl.focus?.();
    moveCaretToEnd(inputEl);

    // 1. Primary path for Lexical (DSH DraftEditorRuntime listens to PASTE_COMMAND at CRITICAL priority)
    const beforeText = inputEl.textContent || '';
    const pasteEv = createSyntheticPasteEvent(payload);
    inputEl.dispatchEvent?.(pasteEv);
    if (pasteEv.defaultPrevented || (inputEl.textContent || '') !== beforeText) {
      inputEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      return true;
    }

    // 2. Secondary path: browser execCommand('insertText') for standard contenteditable editors
    let insertedByCommand = false;
    try {
      if (typeof doc.execCommand === 'function') {
        insertedByCommand = Boolean(doc.execCommand('insertText', false, payload));
      }
    } catch {
      insertedByCommand = false;
    }
    if (insertedByCommand && (inputEl.textContent || '') !== beforeText) {
      inputEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      return true;
    }

    // 3. Final DOM fallback for plain/mocked contenteditable elements
    inputEl.textContent = `${prevTrimmed}${sep}${snippet}`;
    moveCaretToEnd(inputEl);
    try {
      inputEl.dispatchEvent?.(
        typeof InputEvent === 'function'
          ? new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: payload })
          : new Event('input', { bubbles: true }),
      );
    } catch {
      inputEl.dispatchEvent?.(new Event('input', { bubbles: true }));
    }
    inputEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    return true;
  }
  return false;
}

function getSelectionBoundingRect(range) {
  if (!range) return null;
  try {
    const rects = Array.from(range.getClientRects?.() || []).filter(
      (r) => r && (r.width > 0.5 || r.height > 0.5),
    );
    if (rects.length > 0) {
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const r of rects) {
        if (r.left < left) left = r.left;
        if (r.top < top) top = r.top;
        if (r.right > right) right = r.right;
        if (r.bottom > bottom) bottom = r.bottom;
      }
      if (Number.isFinite(left) && Number.isFinite(top)) {
        return {
          left,
          top,
          right,
          bottom,
          width: Math.max(0, right - left),
          height: Math.max(0, bottom - top),
        };
      }
    }
  } catch {
    // fallback to getBoundingClientRect
  }
  const rect = range.getBoundingClientRect?.();
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  return rect;
}

function rectsOverlap(a, b, pad = 4) {
  if (!a || !b) return false;
  return (
    a.left < b.right + pad &&
    a.right > b.left - pad &&
    a.top < b.bottom + pad &&
    a.bottom > b.top - pad
  );
}

function getNativeTextSurfaceRect() {
  if (typeof document?.querySelectorAll !== 'function') return null;
  let surfaces;
  try {
    surfaces = document.querySelectorAll('[data-text-interaction-surface]');
  } catch {
    return null;
  }
  for (const el of surfaces) {
    try {
      if (typeof getComputedStyle === 'function') {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      }
      const r = el.getBoundingClientRect?.();
      if (r && r.width > 4 && r.height > 4) return r;
    } catch {
      // skip unreadable node
    }
  }
  return null;
}

const SURFACE_SELECTOR = '[data-text-interaction-surface]';
const ACTION_CLASS = 'op-selection-explain';
const EXCLUDE_SELECTOR = [
  '[data-composer-card]',
  '[data-composer-dock]',
  '.op-drawer',
  '.op-drawer-backdrop',
  '.op-outline-rail',
  ACTION_CLASS,
  '.op-explain',
  '.op-status-vial',
  '.op-context-menu',
  '[data-op-ui="1"]',
  'textarea',
  'input',
  'select',
  '[contenteditable="true"]',
  'nav',
  'aside',
  '[role="dialog"]',
].join(',');

function textSurfaceVisible(el) {
  try {
    if (typeof getComputedStyle === 'function') {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    }
    if (el.getAttribute?.('aria-hidden') === 'true') return false;
    const r = el.getBoundingClientRect?.();
    return Boolean(r && r.width > 4 && r.height > 4);
  } catch {
    return false;
  }
}

/**
 * DSH 自己那块划词工具条（此刻可见的那一块）。
 * @param doc - 文档对象。
 * @returns 可见的原生工具条元素，没有则 null。
 */
export function findSelectionSurface(doc = document) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return null;
  let list;
  try {
    list = doc.querySelectorAll(SURFACE_SELECTOR);
  } catch {
    return null;
  }
  for (const el of list) {
    if (textSurfaceVisible(el)) return el;
  }
  return null;
}

/**
 * 当前选区是否可以解释。
 * @param sel - window.getSelection() 的结果。
 * @returns 选中的文字与选区起点元素，不合格时返回 null。
 */
export function readExplainSelection(sel) {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const text = String(sel.toString() || '').trim();
  const minLen = /[\u3400-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(text) ? 1 : 2;
  if (text.length < minLen || text.length > 3000) return null;
  const range = sel.getRangeAt(0);
  const nodeOf = (node) => (node ? (node.nodeType === 1 ? node : node.parentElement || null) : null);
  const anchorEl = nodeOf(sel.anchorNode) || nodeOf(range.startContainer);
  const focusEl = nodeOf(sel.focusNode) || nodeOf(range.endContainer);
  if (!anchorEl || !focusEl) return null;
  if (anchorEl.closest?.(EXCLUDE_SELECTOR) || focusEl.closest?.(EXCLUDE_SELECTOR)) return null;
  const conversation = anchorEl.closest?.('[data-conversation-session]');
  if (!conversation || !conversation.contains(focusEl)) return null;
  return { text, anchorEl };
}

/**
 * 在原生工具条里补一个「解释」，和「引用文本」同一条、同一刻出现。
 * @param options.surface - 原生工具条元素。
 * @param options.zh - 是否中文界面。
 * @param options.onCreate - 新建按钮时回调（用来挂点击）。
 * @returns 工具条里的解释按钮。
 */
export function ensureExplainAction({ surface, doc = document, zh, onCreate }) {
  let button = surface.querySelector(`.${ACTION_CLASS}`);
  if (!button) {
    button = doc.createElement('button');
    button.type = 'button';
    button.className = ACTION_CLASS;
    button.setAttribute('data-op-ui', '1');
    if (typeof onCreate === 'function') onCreate(button);
    surface.appendChild(button);
  }
  const label = zh ? '解释' : 'Explain';
  if (button.textContent !== label) button.textContent = label;
  button.setAttribute('aria-label', zh ? '解释选中的文字' : 'Explain the selection');
  return button;
}

/**
 * 划词解释入口：不自己画浮条，只在 DSH 的「引用文本」条里追加一个动作。
 * @param options.getSettings - 读取插件设置。
 * @param options.openExplain - 打开解释小窗。
 * @returns 启动、刷新与销毁接口。
 */
export function createSelectionAskController({ getSettings, openExplain }) {
  let buttonEl = null;
  let observer = null;
  let pending = false;
  let disposed = false;
  let current = { text: '', anchorEl: null };

  function removeAction() {
    if (buttonEl && buttonEl.parentNode) buttonEl.parentNode.removeChild(buttonEl);
    buttonEl = null;
    current = { text: '', anchorEl: null };
  }

  function reconcile() {
    if (disposed) return;
    const settings = getSettings();
    if (!settings?.enabled || !settings?.selectionAskEnabled) {
      removeAction();
      return;
    }
    const surface = findSelectionSurface(document);
    if (!surface) {
      removeAction();
      return;
    }
    const picked = readExplainSelection(window.getSelection?.());
    if (!picked) {
      removeAction();
      return;
    }
    current = picked;
    buttonEl = ensureExplainAction({
      surface,
      zh: isZhUi(settings),
      onCreate: (button) => {
        button.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
        });
        button.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
        });
        button.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const { text, anchorEl } = current;
          if (!text || typeof openExplain !== 'function') return;
          openExplain({ text, anchor: anchorEl });
        });
      },
    });
  }

  // 原生工具条的出现、移动、隐藏都在 DOM 变化里，跟着它同步即可
  function schedule() {
    if (pending || disposed) return;
    pending = true;
    Promise.resolve().then(() => {
      pending = false;
      if (!disposed) reconcile();
    });
  }

  function start() {
    if (disposed || observer) return;
    if (typeof MutationObserver === 'function' && document.body) {
      observer = new MutationObserver(schedule);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'aria-hidden', 'hidden'],
      });
    }
    document.addEventListener('selectionchange', schedule);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    schedule();
  }

  function refresh() {
    schedule();
  }

  function dispose() {
    disposed = true;
    if (observer) observer.disconnect();
    observer = null;
    document.removeEventListener('selectionchange', schedule);
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    removeAction();
  }

  return { start, refresh, dispose };
}
