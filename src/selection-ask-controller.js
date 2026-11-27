// Selection Quick-Ask & Quote Bar for dsh-obsidian-prism
import { isZhUi } from './i18n.js';

export function formatSelectionQuote(rawText, mode = 'quote', zh = true) {
  const cleaned = String(rawText ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!cleaned) return '';
  const quoted = cleaned
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');

  if (mode === 'explain') {
    const lead = zh
      ? '请结合当前上下文，详细解释下面这段内容：'
      : 'Please explain this excerpt in detail based on our current context:';
    return `${lead}\n${quoted}\n\n`;
  }
  return `${quoted}\n\n`;
}

const COMPOSER_SIDEBAR_EXCLUDED = '[data-sidebar-right-session], .op-side-question';

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
  const surfaces = document.querySelectorAll('[data-text-interaction-surface]');
  for (const el of surfaces) {
    if (!(el instanceof Element)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.height > 4) return r;
  }
  return null;
}

export function createSelectionAskController({ getSettings, openSideQuestion }) {
  let pillEl = null;
  let toastEl = null;
  let toastTimer = null;
  let evalTimer = null;
  let repositionRaf = 0;
  let pointerSelecting = false;
  let activeText = '';
  let activeSessionId = '';
  let disposed = false;

  const EXCLUDE_SELECTOR = [
    '[data-composer-card]',
    '[data-composer-dock]',
    '[data-text-interaction-surface]',
    '.op-drawer',
    '.op-drawer-backdrop',
    '.op-outline-rail',
    '.op-selection-pill',
    '.op-side-question',
    '.op-status-vial',
    '.op-code-fold-bar',
    '[data-op-ui="1"]',
    'textarea',
    'input',
    'select',
    '[contenteditable="true"]',
    'nav',
    'aside',
    '[role="dialog"]',
  ].join(',');

  function clearToast() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    toastEl = null;
  }

  function showToast(msg, tone = 'ok') {
    if (disposed || !document.body || !msg) return;
    clearToast();
    toastEl = document.createElement('div');
    toastEl.className = 'op-selection-toast';
    toastEl.setAttribute('data-op-ui', '1');
    toastEl.setAttribute('data-tone', tone);
    toastEl.setAttribute('data-visible', '1');
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    toastEl.textContent = msg;
    document.body.appendChild(toastEl);
    toastTimer = setTimeout(clearToast, 2200);
  }

  function hidePill() {
    activeText = '';
    activeSessionId = '';
    if (repositionRaf) {
      cancelAnimationFrame(repositionRaf);
      repositionRaf = 0;
    }
    if (pillEl && pillEl.parentNode) pillEl.parentNode.removeChild(pillEl);
    pillEl = null;
  }

  function getSelectionNodeElement(node) {
    if (!node) return null;
    return node.nodeType === 1 ? node : node.parentElement || null;
  }

  function isEligibleSelection(sel) {
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const text = sel.toString().trim();
    const minLen = /[\u3400-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(text) ? 1 : 2;
    if (text.length < minLen || text.length > 3000) return null;

    const range = sel.getRangeAt(0);
    const anchorEl = getSelectionNodeElement(sel.anchorNode) || getSelectionNodeElement(range.startContainer);
    const focusEl = getSelectionNodeElement(sel.focusNode) || getSelectionNodeElement(range.endContainer);
    const commonEl = getSelectionNodeElement(range.commonAncestorContainer);
    if (!anchorEl || !focusEl) return null;
    if (anchorEl.closest(EXCLUDE_SELECTOR) || focusEl.closest(EXCLUDE_SELECTOR)) return null;

    const convSelector =
      '[data-chat-flow], [data-text-interaction-source], [data-conversation-region], [data-phase="active"], main, [role="main"]';
    const convRoot = anchorEl.closest(convSelector) || focusEl.closest(convSelector) || commonEl?.closest(convSelector);
    if (!convRoot) return null;
    // Do not show on hero empty state headline
    if (anchorEl.closest('[data-phase="hero"]') && !anchorEl.closest('[data-chat-flow]')) return null;

    const conversation = anchorEl.closest('[data-conversation-session]');
    const sessionId =
      conversation && conversation.contains(focusEl) && !conversation.closest('.op-side-question')
        ? conversation.getAttribute('data-conversation-session') || ''
        : '';
    if (!sessionId) return null;

    const rect = getSelectionBoundingRect(range);
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;

    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) return null;

    return { text, rect, sessionId };
  }

  async function copySelection(text, zh) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      showToast(zh ? '已复制选中内容' : 'Copied selection', 'ok');
    } catch {
      showToast(zh ? '复制失败' : 'Copy failed', 'err');
    }
  }

  function runAction(kind) {
    const s = getSettings();
    const zh = isZhUi(s);
    const text = activeText;
    const sessionId = activeSessionId;
    if (!text) return;

    if (kind === 'copy') {
      copySelection(text, zh);
      hidePill();
      return;
    }

    hidePill();
    if (!sessionId || typeof openSideQuestion !== 'function') {
      showToast(zh ? '未能打开侧边追问' : 'Could not open the sidebar question', 'err');
      return;
    }
    Promise.resolve(openSideQuestion(sessionId, text, kind, zh))
      .then(() => {
        try {
          window.getSelection?.()?.removeAllRanges?.();
        } catch {
          // ignore
        }
      })
      .catch(() => {
        showToast(zh ? '未能打开侧边追问' : 'Could not open the sidebar question', 'err');
      });
  }

  function positionPill(rect) {
    if (!pillEl || !pillEl.isConnected) return;
    const pillRect = pillEl.getBoundingClientRect();
    const width = pillRect.width || 180;
    const height = pillRect.height || 34;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    const gap = 10;

    // Respect composer top edge so pill never lands under the composer card
    const composerCard = findMainComposerCard(document);
    const composerTop = composerCard ? composerCard.getBoundingClientRect().top : vh;
    const maxBottom = Math.min(vh - 12, composerTop - 8);

    const centerX = rect.left + rect.width / 2;
    const left = Math.max(12, Math.min(vw - width - 12, centerX - width / 2));

    const aboveTop = rect.top - height - gap;
    const belowTop = rect.bottom + gap;
    const nativeRect = getNativeTextSurfaceRect();

    let top = aboveTop;
    let placement = 'above';

    const aboveBox = { left, top: aboveTop, right: left + width, bottom: aboveTop + height };
    const belowBox = { left, top: belowTop, right: left + width, bottom: belowTop + height };

    const aboveFits = aboveTop >= 12;
    const belowFits = belowTop + height <= maxBottom;
    const collidesAbove = nativeRect ? rectsOverlap(aboveBox, nativeRect, 6) : false;
    const collidesBelow = nativeRect ? rectsOverlap(belowBox, nativeRect, 6) : false;

    if ((!aboveFits || collidesAbove) && belowFits && !collidesBelow) {
      top = belowTop;
      placement = 'below';
    } else if (collidesAbove && nativeRect) {
      // Stack cleanly above the native DSH quote surface if below doesn't fit
      const stackedAbove = nativeRect.top - height - 8;
      if (stackedAbove >= 12) {
        top = stackedAbove;
        placement = 'above';
      } else if (belowFits) {
        top = belowTop;
        placement = 'below';
      }
    } else if (!aboveFits) {
      top = Math.max(12, Math.min(maxBottom - height, belowTop));
      placement = 'below';
    }

    pillEl.setAttribute('data-placement', placement);
    pillEl.style.left = `${Math.round(left)}px`;
    pillEl.style.top = `${Math.round(top)}px`;
  }

  function renderPill(text, rect, sessionId) {
    const s = getSettings();
    const zh = isZhUi(s);
    activeText = text;
    activeSessionId = sessionId;

    if (!pillEl || !pillEl.isConnected) {
      pillEl = document.createElement('div');
      pillEl.className = 'op-selection-pill';
      pillEl.setAttribute('data-op-ui', '1');
      pillEl.setAttribute('role', 'toolbar');
      const keepSelection = (ev) => {
        // Keep browser selection intact until button click completes
        ev.preventDefault();
        ev.stopPropagation();
      };
      pillEl.addEventListener('pointerdown', keepSelection);
      pillEl.addEventListener('mousedown', keepSelection);
      document.body.appendChild(pillEl);
    }

    pillEl.setAttribute('aria-label', zh ? '划词快捷操作' : 'Selection quick actions');
    pillEl.textContent = '';

    const actions = [
      { id: 'quote', label: zh ? '侧边追问' : 'Ask in sidebar', primary: true },
      { id: 'explain', label: zh ? '侧边解释' : 'Explain', primary: false },
      { id: 'copy', label: zh ? '复制' : 'Copy', primary: false },
    ];

    for (const act of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = act.primary ? 'op-selection-btn op-selection-btn-primary' : 'op-selection-btn';
      btn.setAttribute('data-op-action', act.id);
      btn.textContent = act.label;
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        runAction(act.id);
      });
      pillEl.appendChild(btn);
    }

    positionPill(rect);
    // Re-check once after next frame in case DSH's native quote surface appeared simultaneously
    if (repositionRaf) cancelAnimationFrame(repositionRaf);
    repositionRaf = requestAnimationFrame(() => {
      repositionRaf = 0;
      if (disposed || !pillEl || !pillEl.isConnected) return;
      const sel = window.getSelection?.();
      const eligible = isEligibleSelection(sel);
      if (eligible) positionPill(eligible.rect);
    });
  }

  function evaluateNow() {
    evalTimer = null;
    if (disposed) return;
    const s = getSettings();
    if (!s.enabled || !s.selectionAskEnabled) {
      hidePill();
      return;
    }
    const sel = window.getSelection?.();
    const eligible = isEligibleSelection(sel);
    if (!eligible) {
      hidePill();
      return;
    }
    renderPill(eligible.text, eligible.rect, eligible.sessionId);
  }

  function scheduleEvaluate(delay = 45) {
    if (evalTimer) clearTimeout(evalTimer);
    evalTimer = setTimeout(evaluateNow, delay);
  }

  function isInsidePill(target) {
    return target instanceof Element && Boolean(target.closest('.op-selection-pill'));
  }

  function onPointerDown(ev) {
    if (isInsidePill(ev.target)) return;
    pointerSelecting = true;
    hidePill();
  }

  function onPointerUp(ev) {
    pointerSelecting = false;
    if (isInsidePill(ev.target)) return;
    scheduleEvaluate(40);
  }

  function onKeyUp(ev) {
    if (ev.key === 'Escape') {
      hidePill();
      return;
    }
    if (ev.shiftKey || ev.key === 'Shift' || (ev.key === 'a' && (ev.metaKey || ev.ctrlKey))) {
      scheduleEvaluate(50);
    }
  }

  function onKeyDown(ev) {
    if (ev.key === 'Escape' && pillEl) {
      hidePill();
    }
  }

  function onSelectionChange() {
    if (disposed) return;
    const sel = window.getSelection?.();
    if (!sel || sel.isCollapsed) {
      if (pillEl) hidePill();
      return;
    }
    // Wait until drag finishes, or evaluate via debounce for keyboard/double-click selections
    if (!pointerSelecting) {
      scheduleEvaluate(120);
    }
  }

  function onScrollOrResize() {
    if (!pillEl || !pillEl.isConnected) return;
    if (repositionRaf) return;
    repositionRaf = requestAnimationFrame(() => {
      repositionRaf = 0;
      if (disposed || !pillEl || !pillEl.isConnected) return;
      const sel = window.getSelection?.();
      const eligible = isEligibleSelection(sel);
      if (!eligible) {
        hidePill();
        return;
      }
      positionPill(eligible.rect);
    });
  }

  function start() {
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('mouseup', onPointerUp, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
  }

  function refresh() {
    const s = getSettings();
    if (!s.enabled || !s.selectionAskEnabled) {
      hidePill();
    } else if (pillEl && activeText) {
      // Re-render pill immediately on language change
      evaluateNow();
    }
  }

  function dispose() {
    disposed = true;
    pointerSelecting = false;
    if (evalTimer) {
      clearTimeout(evalTimer);
      evalTimer = null;
    }
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('mouseup', onPointerUp, true);
    document.removeEventListener('keyup', onKeyUp, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('selectionchange', onSelectionChange);
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
    hidePill();
    clearToast();
  }

  return { start, refresh, dispose };
}
