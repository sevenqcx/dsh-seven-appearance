// Conversation workbench enhancers: Code Block Folding + Upgraded Searchable Outline Navigation
import { isZhUi } from './i18n.js';

function detectCodeLanguage(pre) {
  const code = pre.querySelector('code');
  const cls = `${pre.className || ''} ${code?.className || ''}`;
  const m = /(?:language|lang)-([a-z0-9+#_-]+)/i.exec(cls);
  if (m) return m[1];
  const dataLang = pre.getAttribute('data-language') || code?.getAttribute('data-language');
  if (dataLang) return dataLang;
  return 'code';
}

function countLines(pre) {
  const code = pre.querySelector('code') || pre;
  const text = code.textContent || '';
  if (!text) return 0;
  return text.split('\n').length;
}

function findUserTurnElements() {
  const dshTurns = Array.from(
    document.querySelectorAll('[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]')
  ).filter((el) => el.offsetParent !== null && !el.closest('[data-composer-card], .op-drawer, [data-op-ui="1"], nav, aside'));

  if (dshTurns.length > 0) return dshTurns;

  const explicit = Array.from(
    document.querySelectorAll(
      '[data-message-role="user"], [data-role="user"], [data-turn-role="user"], [data-author="user"]'
    )
  ).filter((el) => el.offsetParent !== null && !el.closest('[data-composer-card], .op-drawer, [data-op-ui="1"], nav, aside'));

  if (explicit.length > 0) return explicit;

  const main = document.querySelector('[data-chat-flow], [data-conversation-region], main, [role="main"]');
  if (!main) return [];
  const candidates = Array.from(main.querySelectorAll('[data-message-id], article, [data-turn-id]')).filter(
    (el) => el.offsetParent !== null && !el.closest('[data-composer-card], [data-op-ui="1"]')
  );
  if (candidates.length === 0) return [];
  const userLike = candidates.filter((el) => {
    const attrs = `${el.className || ''} ${el.getAttribute('data-testid') || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
    return attrs.includes('user') || attrs.includes('human') || attrs.includes('prompt');
  });
  return userLike.length > 0 ? userLike : candidates.filter((_, idx) => idx % 2 === 0);
}

function collectOutlineItems() {
  if (document.querySelector('[data-phase="hero"]') && !document.querySelector('[data-chat-flow]')) {
    return [];
  }

  const rawEntries = [];
  const seen = new Set();

  // 1. User turns
  const turns = findUserTurnElements();
  turns.forEach((el, idx) => {
    if (seen.has(el)) return;
    seen.add(el);
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    rawEntries.push({
      kind: 'turn',
      el,
      badge: `#${String(idx + 1).padStart(2, '0')}`,
      label: text.slice(0, 80) || `#${idx + 1}`,
      searchText: text.toLowerCase(),
    });
  });

  // 2. Code blocks in conversation
  const codeBlocks = Array.from(
    document.querySelectorAll('[data-chat-flow] pre, [data-conversation-region] pre, [data-phase="active"] pre, main pre')
  ).filter((pre) => pre.offsetParent !== null && pre.querySelector('code') && !pre.closest('[data-composer-card], .op-drawer, [data-op-ui="1"]'));

  codeBlocks.forEach((pre) => {
    if (seen.has(pre)) return;
    seen.add(pre);
    const lang = detectCodeLanguage(pre).toUpperCase();
    const lines = countLines(pre);
    const codeText = (pre.querySelector('code')?.textContent || '').trim();
    const firstLine = (codeText.split('\n').find((l) => l.trim()) || '').trim().slice(0, 64);
    rawEntries.push({
      kind: 'code',
      el: pre,
      badge: `${lang} · ${lines}L`,
      label: firstLine || `${lang} (${lines})`,
      searchText: `${lang} ${codeText}`.toLowerCase(),
    });
  });

  // 3. Tool blocks & deliverable cards
  const toolEls = Array.from(
    document.querySelectorAll('[data-tool], [data-presented-file], [data-changed-files]')
  ).filter((el) => el.offsetParent !== null && !el.closest('[data-composer-card], .op-drawer, [data-op-ui="1"]'));

  toolEls.forEach((el) => {
    if (seen.has(el)) return;
    seen.add(el);
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    const badge = el.hasAttribute('data-presented-file')
      ? 'FILE'
      : el.hasAttribute('data-changed-files')
      ? 'DIFF'
      : 'TOOL';
    rawEntries.push({
      kind: 'tool',
      el,
      badge,
      label: text.slice(0, 76) || badge,
      searchText: `${badge} ${text}`.toLowerCase(),
    });
  });

  // Sort in exact DOM document order
  rawEntries.sort((a, b) => {
    if (a.el === b.el) return 0;
    const pos = a.el.compareDocumentPosition(b.el);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  return rawEntries.map((item, i) => ({ ...item, order: i + 1 }));
}

export function createWorkbenchController({ getSettings }) {
  let mo = null;
  let scanTimer = null;
  let scrollTimer = null;
  let railEl = null;
  let hoverOpen = false;
  let pinned = false;
  let collapsed = false;
  let activeCategory = 'all'; // 'all' | 'turn' | 'code' | 'tool'
  let searchQuery = '';
  let hoverCloseTimer = null;
  let items = [];
  let activeIndex = 0;
  const userExpanded = new WeakSet();
  const flashTimers = new WeakMap();

  function removeFoldBars() {
    document.querySelectorAll('.op-code-fold-bar').forEach((bar) => bar.remove());
    document.querySelectorAll('pre[data-op-foldable="1"]').forEach((pre) => {
      pre.removeAttribute('data-op-foldable');
      pre.removeAttribute('data-op-folded');
    });
  }

  function scanCodeBlocks() {
    const s = getSettings();
    if (!s.enabled || !s.codeFoldEnabled) {
      removeFoldBars();
      return;
    }
    const streaming = document.documentElement.getAttribute('data-op-streaming') === '1';
    const zh = isZhUi(s);
    const threshold = s.codeFoldThreshold || 24;

    const pres = document.querySelectorAll('pre');
    for (const pre of pres) {
      if (pre.closest('.op-drawer, [data-composer-card]')) continue;
      if (!pre.querySelector('code')) continue;
      const lines = countLines(pre);
      const existingBar = pre.querySelector(':scope > .op-code-fold-bar');

      if (lines < threshold) {
        if (existingBar) existingBar.remove();
        pre.removeAttribute('data-op-foldable');
        pre.removeAttribute('data-op-folded');
        continue;
      }

      pre.setAttribute('data-op-foldable', '1');
      if (!existingBar) {
        if (!streaming && !userExpanded.has(pre)) {
          pre.setAttribute('data-op-folded', '1');
        }
        const bar = document.createElement('div');
        bar.className = 'op-code-fold-bar';
        bar.setAttribute('data-op-ui', '1');

        const meta = document.createElement('span');
        meta.className = 'op-code-fold-meta';
        const lang = detectCodeLanguage(pre);
        meta.textContent = `${lang.toUpperCase()} · ${lines} ${zh ? '行' : 'lines'}`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'op-code-fold-btn';

        const syncBtn = () => {
          const curZh = isZhUi(getSettings());
          const folded = pre.getAttribute('data-op-folded') === '1';
          btn.textContent = folded
            ? (curZh ? '展开全部' : 'Expand')
            : (curZh ? '折叠代码' : 'Collapse');
        };
        syncBtn();

        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const folded = pre.getAttribute('data-op-folded') === '1';
          if (folded) {
            pre.setAttribute('data-op-folded', '0');
            userExpanded.add(pre);
          } else {
            pre.setAttribute('data-op-folded', '1');
            userExpanded.delete(pre);
          }
          syncBtn();
        });

        bar.appendChild(meta);
        bar.appendChild(btn);
        pre.prepend(bar);
      } else {
        // Keep metadata & button labels synchronized when code or UI language updates
        const meta = existingBar.querySelector('.op-code-fold-meta') || existingBar.firstElementChild;
        const btn = existingBar.querySelector('.op-code-fold-btn');
        const lang = detectCodeLanguage(pre);
        if (meta) meta.textContent = `${lang.toUpperCase()} · ${lines} ${zh ? '行' : 'lines'}`;
        if (btn) {
          const folded = pre.getAttribute('data-op-folded') === '1';
          btn.textContent = folded
            ? (zh ? '展开全部' : 'Expand')
            : (zh ? '折叠代码' : 'Collapse');
        }
      }
    }
  }

  function removeOutlineRail() {
    if (railEl && railEl.parentNode) railEl.parentNode.removeChild(railEl);
    railEl = null;
    hoverOpen = false;
    items = [];
  }

  function jumpToItem(item) {
    if (!item || !item.el || !item.el.isConnected) return;
    item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item.el.setAttribute('data-op-jump-flash', '1');
    const prevTid = flashTimers.get(item.el);
    if (prevTid) clearTimeout(prevTid);
    const tid = setTimeout(() => {
      if (item.el.isConnected) item.el.removeAttribute('data-op-jump-flash');
      flashTimers.delete(item.el);
    }, 950);
    flashTimers.set(item.el, tid);
  }

  function computeActiveIndex() {
    if (items.length === 0) return 0;
    const anchorY = (window.innerHeight || 800) * 0.28;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < items.length; i += 1) {
      const r = items[i].el.getBoundingClientRect();
      const d = Math.abs(r.top - anchorY);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function getFilteredItems() {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (activeCategory !== 'all' && item.kind !== activeCategory) return false;
      if (q && !item.searchText.includes(q) && !item.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function renderOutlineList(listEl, zh) {
    listEl.textContent = '';
    const filtered = getFilteredItems();
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'op-outline-empty';
      empty.textContent = zh ? '没有匹配的条目' : 'No matching items';
      listEl.appendChild(empty);
      return;
    }

    for (const item of filtered) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'op-outline-item';
      btn.setAttribute('data-kind', item.kind);
      const isCurrent = items[activeIndex] === item;
      if (isCurrent) btn.setAttribute('data-active', '1');

      const badge = document.createElement('span');
      badge.className = 'op-outline-idx';
      badge.setAttribute('data-kind', item.kind);
      badge.textContent = item.badge;

      const txt = document.createElement('span');
      txt.className = 'op-outline-text';
      txt.textContent = item.label;

      btn.appendChild(badge);
      btn.appendChild(txt);
      btn.addEventListener('click', () => {
        jumpToItem(item);
      });
      listEl.appendChild(btn);
    }
  }

  function paintOutlineContents() {
    if (!railEl) return;
    const s = getSettings();
    const zh = isZhUi(s);
    const panelOpen = !collapsed && (pinned || hoverOpen);

    // Preserve search input focus if user is actively typing
    const activeEl = document.activeElement;
    const wasTypingSearch = Boolean(activeEl && activeEl.classList?.contains('op-outline-search') && railEl.contains(activeEl));
    const selStart = wasTypingSearch ? activeEl.selectionStart : null;
    const selEnd = wasTypingSearch ? activeEl.selectionEnd : null;

    railEl.setAttribute('data-collapsed', collapsed ? '1' : '0');
    railEl.setAttribute('data-pinned', pinned ? '1' : '0');
    railEl.textContent = '';

    if (collapsed) {
      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'op-outline-pill-toggle';
      restoreBtn.title = zh ? '展开会话大纲 (Alt+Shift+O)' : 'Expand outline (Alt+Shift+O)';
      restoreBtn.textContent = zh ? '大纲' : 'Nav';
      restoreBtn.addEventListener('click', () => {
        collapsed = false;
        pinned = true;
        paintOutlineContents();
      });
      railEl.appendChild(restoreBtn);
      return;
    }

    // Compact vertical dot rail
    const dots = document.createElement('div');
    dots.className = 'op-outline-dots';
    const maxDots = 18;
    const railItems = items.length <= maxDots ? items : items.filter((it) => it.kind === 'turn').slice(0, maxDots);
    for (const item of railItems) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'op-outline-dot';
      dot.setAttribute('data-kind', item.kind);
      if (items[activeIndex] === item) dot.setAttribute('data-active', '1');
      dot.title = `${item.badge} · ${item.label}`;
      dot.addEventListener('click', () => {
        jumpToItem(item);
      });
      dots.appendChild(dot);
    }

    const collapseMini = document.createElement('button');
    collapseMini.type = 'button';
    collapseMini.className = 'op-outline-mini-btn';
    collapseMini.title = zh ? '收起大纲给正文留白' : 'Collapse outline';
    collapseMini.textContent = '›';
    collapseMini.addEventListener('click', (ev) => {
      ev.stopPropagation();
      collapsed = true;
      pinned = false;
      hoverOpen = false;
      paintOutlineContents();
    });
    dots.appendChild(collapseMini);
    railEl.appendChild(dots);

    if (panelOpen) {
      const pop = document.createElement('div');
      pop.className = 'op-outline-pop';
      pop.setAttribute('role', 'region');
      pop.setAttribute('aria-label', zh ? '会话大纲' : 'Conversation outline');

      // Header with title, pin & collapse actions
      const head = document.createElement('div');
      head.className = 'op-outline-head';

      const title = document.createElement('div');
      title.className = 'op-outline-title';
      title.textContent = zh ? `会话大纲 (${items.length})` : `Outline (${items.length})`;

      const actions = document.createElement('div');
      actions.className = 'op-outline-actions';

      const pinBtn = document.createElement('button');
      pinBtn.type = 'button';
      pinBtn.className = 'op-outline-mini-btn';
      pinBtn.setAttribute('data-active', pinned ? '1' : '0');
      pinBtn.textContent = pinned ? (zh ? '已固定' : 'Pinned') : (zh ? '固定' : 'Pin');
      pinBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        pinned = !pinned;
        paintOutlineContents();
      });

      const hideBtn = document.createElement('button');
      hideBtn.type = 'button';
      hideBtn.className = 'op-outline-mini-btn';
      hideBtn.textContent = zh ? '收起' : 'Hide';
      hideBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        collapsed = true;
        pinned = false;
        hoverOpen = false;
        paintOutlineContents();
      });

      actions.appendChild(pinBtn);
      actions.appendChild(hideBtn);
      head.appendChild(title);
      head.appendChild(actions);
      pop.appendChild(head);

      // Search box
      const searchInput = document.createElement('input');
      searchInput.type = 'search';
      searchInput.className = 'op-outline-search';
      searchInput.value = searchQuery;
      searchInput.placeholder = zh ? '筛选提问、代码或工具…' : 'Filter turns, code, tools…';
      pop.appendChild(searchInput);

      // Category filter tabs
      const turnCount = items.filter((i) => i.kind === 'turn').length;
      const codeCount = items.filter((i) => i.kind === 'code').length;
      const toolCount = items.filter((i) => i.kind === 'tool').length;

      const tabs = document.createElement('div');
      tabs.className = 'op-outline-tabs';
      const tabDefs = [
        { id: 'all', label: zh ? `全部 ${items.length}` : `All ${items.length}` },
        { id: 'turn', label: zh ? `提问 ${turnCount}` : `Turns ${turnCount}` },
        { id: 'code', label: zh ? `代码 ${codeCount}` : `Code ${codeCount}` },
        { id: 'tool', label: zh ? `工具 ${toolCount}` : `Tools ${toolCount}` },
      ];

      const listEl = document.createElement('div');
      listEl.className = 'op-outline-list';

      for (const td of tabDefs) {
        const tb = document.createElement('button');
        tb.type = 'button';
        tb.className = 'op-outline-tab';
        tb.setAttribute('data-tab', td.id);
        tb.setAttribute('data-active', activeCategory === td.id ? '1' : '0');
        tb.textContent = td.label;
        tb.addEventListener('click', (ev) => {
          ev.stopPropagation();
          activeCategory = td.id;
          tabs.querySelectorAll('.op-outline-tab').forEach((node) => {
            node.setAttribute('data-active', node.getAttribute('data-tab') === activeCategory ? '1' : '0');
          });
          renderOutlineList(listEl, zh);
        });
        tabs.appendChild(tb);
      }
      pop.appendChild(tabs);

      searchInput.addEventListener('input', (ev) => {
        searchQuery = ev.target.value || '';
        renderOutlineList(listEl, zh);
      });

      renderOutlineList(listEl, zh);
      pop.appendChild(listEl);
      railEl.appendChild(pop);

      if (wasTypingSearch) {
        searchInput.focus();
        if (typeof selStart === 'number' && typeof selEnd === 'number') {
          searchInput.setSelectionRange(selStart, selEnd);
        }
      }
    }
  }

  function renderOutlineRail() {
    const s = getSettings();
    if (!s.enabled || !s.turnOutlineEnabled) {
      removeOutlineRail();
      return;
    }

    const collected = collectOutlineItems();
    const turnCount = collected.filter((i) => i.kind === 'turn').length;
    if (turnCount < 2 && collected.length < 3) {
      removeOutlineRail();
      return;
    }

    items = collected;
    activeIndex = computeActiveIndex();

    if (!railEl || !railEl.isConnected) {
      railEl = document.createElement('div');
      railEl.className = 'op-outline-rail';
      railEl.setAttribute('data-op-ui', '1');
      railEl.addEventListener('mouseenter', () => {
        if (collapsed) return;
        if (hoverCloseTimer) { clearTimeout(hoverCloseTimer); hoverCloseTimer = null; }
        hoverOpen = true;
        paintOutlineContents();
      });
      railEl.addEventListener('mouseleave', () => {
        if (pinned || collapsed) return;
        hoverCloseTimer = setTimeout(() => {
          if (railEl && railEl.contains(document.activeElement)) return;
          hoverOpen = false;
          paintOutlineContents();
        }, 200);
      });
      document.body.appendChild(railEl);
    }

    // Offset beside DSH's native right-edge TurnNavigator when actually mounted near the right edge
    const vw = window.innerWidth || 1200;
    const nativeCandidates = document.querySelector('[data-chat-flow]')
      ? Array.from(document.querySelectorAll('[class*="TurnNavigator"], [data-turn-navigator], [role="navigation"][aria-label]'))
      : [];
    const hasNativeRail = nativeCandidates.some((el) => {
      if (el.closest('[data-op-ui="1"], nav, aside')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.width < 120 && r.right >= vw - 90;
    });
    railEl.style.right = hasNativeRail ? '44px' : '12px';

    paintOutlineContents();
  }

  function toggleOutlinePanel() {
    const s = getSettings();
    if (!s.enabled || !s.turnOutlineEnabled) return;
    if (!railEl || !railEl.isConnected) {
      renderOutlineRail();
    }
    if (!railEl) return;
    if (collapsed) {
      collapsed = false;
      pinned = true;
    } else if (pinned || hoverOpen) {
      pinned = false;
      hoverOpen = false;
    } else {
      pinned = true;
    }
    paintOutlineContents();
  }

  function onScroll() {
    if (!railEl || items.length === 0 || scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      const next = computeActiveIndex();
      if (next !== activeIndex) {
        activeIndex = next;
        paintOutlineContents();
      }
    }, 180);
  }

  function onKeyDown(ev) {
    if (ev.altKey && ev.shiftKey && (ev.key === 'O' || ev.key === 'o')) {
      ev.preventDefault();
      toggleOutlinePanel();
    }
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scanCodeBlocks();
      renderOutlineRail();
    }, 280);
  }

  function start() {
    scheduleScan();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKeyDown);
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.target instanceof Element && m.target.closest('[data-op-ui="1"], .op-drawer')) continue;
          scheduleScan();
          break;
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  function refresh() {
    scanCodeBlocks();
    renderOutlineRail();
  }

  function dispose() {
    if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
    if (scrollTimer) { clearTimeout(scrollTimer); scrollTimer = null; }
    if (hoverCloseTimer) { clearTimeout(hoverCloseTimer); hoverCloseTimer = null; }
    for (const [el, tid] of flashTimers.entries()) {
      clearTimeout(tid);
      if (el?.isConnected) el.removeAttribute('data-op-jump-flash');
    }
    flashTimers.clear();
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('keydown', onKeyDown);
    if (mo) { mo.disconnect(); mo = null; }
    removeFoldBars();
    removeOutlineRail();
  }

  return { start, refresh, toggleOutlinePanel, dispose };
}
