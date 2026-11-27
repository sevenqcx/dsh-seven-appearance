// Visual effects controller: Ambient Aura, Smooth Caret, and Stream Text Fade-In (CSS Custom Highlight API)

const MIRROR_STYLES = [
  'direction', 'boxSizing', 'width', 'overflowX', 'overflowY',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
  'fontSizeAdjust', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform',
  'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize',
];

function measureTextareaCaret(el) {
  const pos = typeof el.selectionStart === 'number' ? el.selectionStart : 0;
  const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : pos;
  if (end !== pos) return null;

  const cs = getComputedStyle(el);
  const mirror = document.createElement('div');
  mirror.style.position = 'fixed';
  mirror.style.top = '-9999px';
  mirror.style.left = '-9999px';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflowWrap = 'break-word';
  for (const prop of MIRROR_STYLES) {
    mirror.style[prop] = cs[prop];
  }
  mirror.textContent = el.value.slice(0, pos);
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const rect = el.getBoundingClientRect();
  const top = rect.top + marker.offsetTop - el.scrollTop;
  const left = rect.left + marker.offsetLeft - el.scrollLeft;
  const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.35 || 18;
  document.body.removeChild(mirror);

  if (top < rect.top - 4 || top > rect.bottom + 4) return null;
  return {
    x: left,
    y: top + Math.max(0, (lineH - Math.min(lineH, 20)) / 2),
    height: Math.min(22, Math.max(14, lineH * 0.85)),
  };
}

function isUsableRect(r) {
  return Boolean(
    r &&
    (r.height > 0 || r.width > 0) &&
    !(r.width === 0 && r.height === 0 && r.top === 0 && r.left === 0)
  );
}

function firstUsableRect(list) {
  if (!list || !list.length) return null;
  for (let i = 0; i < list.length; i += 1) {
    if (isUsableRect(list[i])) return list[i];
  }
  return null;
}

function lastUsableRect(list) {
  if (!list || !list.length) return null;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (isUsableRect(list[i])) return list[i];
  }
  return null;
}

function findBoundaryTextNode(node, fromEnd) {
  if (!node) return null;
  if (node.nodeType === 3) {
    return node.nodeValue && node.nodeValue.length > 0 ? node : null;
  }
  const children = node.childNodes;
  if (!children || !children.length) return null;
  if (fromEnd) {
    for (let i = children.length - 1; i >= 0; i -= 1) {
      const found = findBoundaryTextNode(children[i], true);
      if (found) return found;
    }
  } else {
    for (let i = 0; i < children.length; i += 1) {
      const found = findBoundaryTextNode(children[i], false);
      if (found) return found;
    }
  }
  return null;
}

function measureNodeEdge(node, atEnd, doc) {
  if (!node) return null;
  if (node.nodeType === 3) {
    const text = node.nodeValue || '';
    if (!text.length || !doc || typeof doc.createRange !== 'function') return null;
    try {
      const probe = doc.createRange();
      if (atEnd) {
        probe.setStart(node, text.length - 1);
        probe.setEnd(node, text.length);
      } else {
        probe.setStart(node, 0);
        probe.setEnd(node, 1);
      }
      const rects = probe.getClientRects?.();
      const r = (atEnd ? lastUsableRect(rects) : firstUsableRect(rects)) || probe.getBoundingClientRect?.();
      if (isUsableRect(r)) {
        return {
          left: atEnd ? r.right : r.left,
          top: r.top,
          height: r.height,
          char: atEnd ? text[text.length - 1] : text[0],
        };
      }
    } catch {
      return null;
    }
    return null;
  }
  if (node.nodeType === 1) {
    if (node.tagName === 'BR') {
      const br = node.getBoundingClientRect?.();
      if (isUsableRect(br)) return { left: br.left, top: br.top, height: br.height, isBr: true };
      return null;
    }
    const textNode = findBoundaryTextNode(node, atEnd);
    if (textNode) {
      const tr = measureNodeEdge(textNode, atEnd, doc);
      if (tr) return tr;
    }
    const rects = node.getClientRects?.();
    const r = (atEnd ? lastUsableRect(rects) : firstUsableRect(rects)) || node.getBoundingClientRect?.();
    if (isUsableRect(r)) {
      return { left: atEnd ? r.right : r.left, top: r.top, height: r.height };
    }
  }
  return null;
}

function resolveBlockContainer(el, startContainer) {
  let cur = startContainer && startContainer.nodeType === 1
    ? startContainer
    : startContainer?.parentElement || null;
  let candidate = null;
  while (cur && cur !== el && el.contains(cur)) {
    candidate = cur;
    cur = cur.parentElement;
  }
  return candidate;
}

export function measureContentEditableCaret(el, win = window) {
  const sel = win?.getSelection?.();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  const elRect = el.getBoundingClientRect();
  if (elRect.width === 0 && elRect.height === 0) return null;

  const scrollEl = el.closest?.('[data-input-scroll]') || el.closest?.('[data-composer-card]') || el;
  const clipRect = scrollEl.getBoundingClientRect?.() || elRect;

  const cs = win.getComputedStyle(el);
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padT = parseFloat(cs.paddingTop) || 0;
  const fontSize = parseFloat(cs.fontSize) || 14;
  const lineH = parseFloat(cs.lineHeight) || fontSize * 1.45 || 22;

  const blockEl = resolveBlockContainer(el, range.startContainer);
  const blockRect = blockEl?.getBoundingClientRect?.();
  const lineLeft = isUsableRect(blockRect) ? blockRect.left : elRect.left + padL;
  const doc = el.ownerDocument || document;

  let r = null;

  if (range.startContainer.nodeType === 1) {
    // Collapsed range at an element boundary (e.g. Lexical <p> after Shift+Enter <br><br>)
    const node = range.startContainer;
    const offset = range.startOffset;
    const children = node.childNodes || [];
    const prev = offset > 0 ? children[offset - 1] : null;
    const next = offset < children.length ? children[offset] : null;
    const prevIsBr = Boolean(prev && prev.nodeType === 1 && prev.tagName === 'BR');
    const nextIsBr = Boolean(next && next.nodeType === 1 && next.tagName === 'BR');

    if (nextIsBr) {
      const nextRect = next.getBoundingClientRect?.();
      const prevRect = prevIsBr ? prev.getBoundingClientRect?.() : null;
      if (isUsableRect(nextRect)) {
        if (prevIsBr) {
          if (isUsableRect(prevRect) && Math.abs(nextRect.top - prevRect.top) < lineH * 0.45) {
            r = { left: lineLeft, top: prevRect.top + lineH, height: lineH };
          } else {
            r = { left: lineLeft, top: nextRect.top, height: nextRect.height || lineH };
          }
        } else if (!prev) {
          r = { left: lineLeft, top: nextRect.top, height: nextRect.height || lineH };
        } else {
          r = measureNodeEdge(prev, true, doc) || {
            left: nextRect.left,
            top: nextRect.top,
            height: nextRect.height || lineH,
          };
        }
      } else if (prevIsBr && isUsableRect(prevRect)) {
        r = { left: lineLeft, top: prevRect.top + lineH, height: lineH };
      } else if (prev) {
        r = measureNodeEdge(prev, true, doc);
      } else if (isUsableRect(blockRect)) {
        r = { left: blockRect.left, top: blockRect.top, height: lineH };
      }
    } else if (next) {
      r = measureNodeEdge(next, false, doc);
      if (!r && prevIsBr) {
        const prevRect = prev.getBoundingClientRect?.();
        if (isUsableRect(prevRect)) {
          r = { left: lineLeft, top: prevRect.top + lineH, height: lineH };
        }
      }
    } else if (prevIsBr) {
      const prevRect = prev.getBoundingClientRect?.();
      const prevPrev = offset >= 2 ? children[offset - 2] : null;
      const prevPrevIsBr = Boolean(prevPrev && prevPrev.nodeType === 1 && prevPrev.tagName === 'BR');
      if (children.length === 1) {
        r = {
          left: lineLeft,
          top: isUsableRect(prevRect) ? prevRect.top : (isUsableRect(blockRect) ? blockRect.top : elRect.top + padT),
          height: (isUsableRect(prevRect) && prevRect.height) || lineH,
        };
      } else if (prevPrevIsBr && isUsableRect(prevRect)) {
        r = { left: lineLeft, top: prevRect.top, height: prevRect.height || lineH };
      } else if (isUsableRect(prevRect)) {
        r = { left: lineLeft, top: prevRect.top + lineH, height: lineH };
      }
    } else if (prev) {
      r = measureNodeEdge(prev, true, doc);
    } else if (isUsableRect(blockRect)) {
      r = { left: blockRect.left, top: blockRect.top, height: lineH };
    }

    if (!isUsableRect(r)) {
      const rects = range.getClientRects?.();
      r = lastUsableRect(rects) || range.getBoundingClientRect?.();
    }
  } else {
    // Collapsed range inside a Text node
    const rects = range.getClientRects?.();
    r = lastUsableRect(rects);
    if (!isUsableRect(r)) {
      const br = range.getBoundingClientRect?.();
      if (isUsableRect(br)) r = br;
    }
    if (!isUsableRect(r) && range.startContainer.nodeType === 3 && doc && typeof doc.createRange === 'function') {
      const textNode = range.startContainer;
      const text = textNode.nodeValue || '';
      const off = range.startOffset;
      try {
        if (off > 0 && text.length > 0) {
          const idx = Math.min(off, text.length);
          const probe = doc.createRange();
          probe.setStart(textNode, idx - 1);
          probe.setEnd(textNode, idx);
          const pr = lastUsableRect(probe.getClientRects?.()) || probe.getBoundingClientRect?.();
          if (isUsableRect(pr)) {
            if (text[idx - 1] === '\n') {
              r = { left: lineLeft, top: pr.top + lineH, height: lineH };
            } else {
              r = { left: pr.right, top: pr.top, height: pr.height || lineH };
            }
          }
        } else if (off < text.length) {
          const probe = doc.createRange();
          probe.setStart(textNode, off);
          probe.setEnd(textNode, off + 1);
          const pr = firstUsableRect(probe.getClientRects?.()) || probe.getBoundingClientRect?.();
          if (isUsableRect(pr)) {
            r = { left: pr.left, top: pr.top, height: pr.height || lineH };
          }
        }
      } catch {
        // fall through to parent/default fallback
      }
    }
  }

  if (!isUsableRect(r)) {
    const x = elRect.left + padL;
    const y = elRect.top + padT;
    const caretH = Math.min(22, Math.max(14, lineH * 0.85));
    const centeredY = y + Math.max(0, (lineH - caretH) / 2);
    if (centeredY + caretH < clipRect.top - 4 || centeredY > clipRect.bottom + 4) return null;
    return { x, y: centeredY, height: caretH };
  }

  const rawH = r.height && r.height > 0 ? r.height : lineH;
  const caretH = Math.min(22, Math.max(14, Math.min(rawH, lineH * 0.85)));
  const y = r.top + Math.max(0, (rawH - caretH) / 2);
  if (y + caretH < clipRect.top - 4 || y > clipRect.bottom + 4) return null;
  return { x: r.left, y, height: caretH };
}

export function createEffectsController({ getSettings }) {
  let auraEl = null;
  let caretEl = null;
  let boundInput = null;
  let caretResizeObserver = null;
  let idleTimer = null;
  let rafId = 0;
  let settleRafId = 0;

  const supportsHighlight = typeof CSS !== 'undefined' && typeof Highlight !== 'undefined' && CSS.highlights;
  const fadeEntries = [];
  let fadeRaf = 0;
  let streamObserver = null;
  let disposed = false;

  function disconnectCaretResizeObserver() {
    if (caretResizeObserver) {
      try { caretResizeObserver.disconnect(); } catch { /* ignore */ }
      caretResizeObserver = null;
    }
  }

  function observeBoundInputResize(target) {
    disconnectCaretResizeObserver();
    if (typeof ResizeObserver === 'undefined' || !target) return;
    caretResizeObserver = new ResizeObserver(() => {
      scheduleCaretUpdate();
    });
    caretResizeObserver.observe(target);
    const card = target.closest?.('[data-composer-card]');
    if (card && card !== target) caretResizeObserver.observe(card);
  }

  function ensureAura() {
    if (!auraEl || !auraEl.isConnected) {
      auraEl = document.createElement('div');
      auraEl.className = 'op-ambient-aura';
      auraEl.setAttribute('aria-hidden', 'true');
      document.body.prepend(auraEl);
    }
  }

  function ensureCaret() {
    if (!caretEl || !caretEl.isConnected) {
      caretEl = document.createElement('div');
      caretEl.className = 'op-smooth-caret';
      caretEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(caretEl);
    }
  }

  function hideCaret() {
    if (caretEl) {
      caretEl.setAttribute('data-visible', '0');
      caretEl.setAttribute('data-idle', '0');
    }
  }

  function updateCaretNow() {
    rafId = 0;
    const s = getSettings();
    if (!s.enabled || !s.smoothCaret || !boundInput || document.activeElement !== boundInput) {
      hideCaret();
      return;
    }
    ensureCaret();
    const coords = boundInput.tagName === 'TEXTAREA'
      ? measureTextareaCaret(boundInput)
      : measureContentEditableCaret(boundInput);
    if (!coords) {
      hideCaret();
      return;
    }
    caretEl.style.transform = `translate3d(${Math.round(coords.x)}px, ${Math.round(coords.y)}px, 0)`;
    caretEl.style.height = `${Math.round(coords.height)}px`;
    caretEl.setAttribute('data-visible', '1');
    caretEl.setAttribute('data-idle', '0');
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (caretEl && caretEl.getAttribute('data-visible') === '1') {
        caretEl.setAttribute('data-idle', '1');
      }
    }, 450);
  }

  function scheduleCaretUpdate(withSettle = false) {
    if (disposed) return;
    if (!rafId) {
      rafId = requestAnimationFrame(updateCaretNow);
    }
    if (withSettle) {
      if (settleRafId) cancelAnimationFrame(settleRafId);
      settleRafId = requestAnimationFrame(() => {
        settleRafId = requestAnimationFrame(() => {
          settleRafId = 0;
          if (!disposed && boundInput) updateCaretNow();
        });
      });
    }
  }

  function bindComposerInput(target) {
    if (!(target instanceof Element)) return;
    const isInput = target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true';
    if (!isInput || !target.closest('[data-composer-card]')) return;
    if (boundInput && boundInput !== target) {
      boundInput.removeAttribute('data-op-caret-bound');
    }
    boundInput = target;
    boundInput.setAttribute('data-op-caret-bound', '1');
    observeBoundInputResize(target);
    scheduleCaretUpdate();
  }

  function onFocusIn(e) {
    const s = getSettings();
    if (!s.enabled || !s.smoothCaret) return;
    bindComposerInput(e.target);
  }

  function onFocusOut(e) {
    if (boundInput && e.target === boundInput) {
      boundInput.removeAttribute('data-op-caret-bound');
      boundInput = null;
      disconnectCaretResizeObserver();
      hideCaret();
    }
  }

  function onCaretActivity() {
    if (boundInput) scheduleCaretUpdate(false);
  }

  function onCaretEditActivity() {
    if (boundInput) scheduleCaretUpdate(true);
  }

  function clearHighlights() {
    if (!supportsHighlight) return;
    for (let i = 0; i < 3; i++) {
      try { CSS.highlights.delete(`op-stream-fade-${i}`); } catch { /* ignore */ }
    }
    fadeEntries.length = 0;
  }

  function tickFade() {
    fadeRaf = 0;
    if (!supportsHighlight || disposed) return;
    const now = performance.now();
    const buckets = [[], [], []];
    for (let i = fadeEntries.length - 1; i >= 0; i--) {
      const item = fadeEntries[i];
      const age = now - item.createdAt;
      if (age >= 320 || !item.range.startContainer.isConnected) {
        fadeEntries.splice(i, 1);
        continue;
      }
      const idx = age < 100 ? 0 : age < 210 ? 1 : 2;
      buckets[idx].push(item.range);
    }
    for (let i = 0; i < 3; i++) {
      const key = `op-stream-fade-${i}`;
      if (buckets[i].length > 0) {
        try { CSS.highlights.set(key, new Highlight(...buckets[i])); } catch { /* ignore */ }
      } else {
        try { CSS.highlights.delete(key); } catch { /* ignore */ }
      }
    }
    if (fadeEntries.length > 0) {
      fadeRaf = requestAnimationFrame(tickFade);
    }
  }

  function enqueueFadeRange(node, start, end) {
    if (!supportsHighlight || !node || !node.isConnected) return;
    const len = node.nodeValue ? node.nodeValue.length : 0;
    const s = Math.max(0, Math.min(start, len));
    const e = Math.max(s, Math.min(end, len));
    if (e <= s) return;
    try {
      const range = document.createRange();
      range.setStart(node, s);
      range.setEnd(node, e);
      fadeEntries.push({ range, createdAt: performance.now() });
      if (fadeEntries.length > 36) fadeEntries.splice(0, fadeEntries.length - 36);
      if (!fadeRaf) fadeRaf = requestAnimationFrame(tickFade);
    } catch {
      // ignore invalid range during concurrent React update
    }
  }

  function isEligibleStreamNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    if (parent.closest('[data-composer-card], .op-drawer, .op-outline-rail, .op-selection-explain, .op-selection-toast, .op-status-vial, [data-op-ui="1"], pre, code, script, style, button')) {
      return false;
    }
    return true;
  }

  function handleStreamMutations(mutations) {
    const s = getSettings();
    if (!s.enabled || !s.streamFade || !supportsHighlight || document.hidden) return;
    if (document.documentElement.getAttribute('data-op-streaming') !== '1') return;

    for (const m of mutations) {
      if (m.type === 'characterData' && isEligibleStreamNode(m.target)) {
        const oldLen = m.oldValue ? m.oldValue.length : 0;
        const newLen = m.target.nodeValue ? m.target.nodeValue.length : 0;
        if (newLen > oldLen && newLen - oldLen < 240) {
          enqueueFadeRange(m.target, oldLen, newLen);
        }
      } else if (m.type === 'childList' && m.addedNodes.length > 0) {
        for (const n of m.addedNodes) {
          if (n.nodeType === Node.TEXT_NODE && isEligibleStreamNode(n)) {
            const len = n.nodeValue ? n.nodeValue.length : 0;
            if (len > 0 && len < 240) enqueueFadeRange(n, 0, len);
          }
        }
      }
    }
  }

  function start() {
    ensureAura();
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('keydown', onCaretEditActivity, true);
    document.addEventListener('beforeinput', onCaretEditActivity, true);
    document.addEventListener('input', onCaretEditActivity, true);
    document.addEventListener('compositionstart', onCaretEditActivity, true);
    document.addEventListener('compositionupdate', onCaretEditActivity, true);
    document.addEventListener('compositionend', onCaretEditActivity, true);
    document.addEventListener('keyup', onCaretActivity, true);
    document.addEventListener('mouseup', onCaretActivity, true);
    document.addEventListener('selectionchange', onCaretActivity);
    window.addEventListener('scroll', onCaretActivity, true);
    window.addEventListener('resize', onCaretActivity);

    if (supportsHighlight && typeof MutationObserver !== 'undefined' && document.body) {
      streamObserver = new MutationObserver(handleStreamMutations);
      streamObserver.observe(document.body, {
        characterData: true,
        characterDataOldValue: true,
        childList: true,
        subtree: true,
      });
    }
    refresh();
  }

  function refresh() {
    const s = getSettings();
    document.documentElement.setAttribute('data-op-smooth-caret', s.enabled && s.smoothCaret ? '1' : '0');
    if (!s.enabled || !s.smoothCaret) {
      if (boundInput) {
        boundInput.removeAttribute('data-op-caret-bound');
        boundInput = null;
      }
      disconnectCaretResizeObserver();
      hideCaret();
    } else if (document.activeElement) {
      bindComposerInput(document.activeElement);
    }
    if (!s.enabled || !s.streamFade) {
      clearHighlights();
    }
  }

  function dispose() {
    disposed = true;
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('focusout', onFocusOut, true);
    document.removeEventListener('keydown', onCaretEditActivity, true);
    document.removeEventListener('beforeinput', onCaretEditActivity, true);
    document.removeEventListener('input', onCaretEditActivity, true);
    document.removeEventListener('compositionstart', onCaretEditActivity, true);
    document.removeEventListener('compositionupdate', onCaretEditActivity, true);
    document.removeEventListener('compositionend', onCaretEditActivity, true);
    document.removeEventListener('keyup', onCaretActivity, true);
    document.removeEventListener('mouseup', onCaretActivity, true);
    document.removeEventListener('selectionchange', onCaretActivity);
    window.removeEventListener('scroll', onCaretActivity, true);
    window.removeEventListener('resize', onCaretActivity);
    disconnectCaretResizeObserver();
    if (streamObserver) {
      streamObserver.disconnect();
      streamObserver = null;
    }
    if (rafId) cancelAnimationFrame(rafId);
    if (settleRafId) cancelAnimationFrame(settleRafId);
    if (fadeRaf) cancelAnimationFrame(fadeRaf);
    if (idleTimer) clearTimeout(idleTimer);
    clearHighlights();
    if (boundInput) boundInput.removeAttribute('data-op-caret-bound');
    if (auraEl && auraEl.parentNode) auraEl.parentNode.removeChild(auraEl);
    if (caretEl && caretEl.parentNode) caretEl.parentNode.removeChild(caretEl);
    document.documentElement.removeAttribute('data-op-smooth-caret');
  }

  return { start, refresh, dispose };
}
