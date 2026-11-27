// Sidebar tools: "Edit sidebar…" panel pinning, local-agent removal, and the
// "Back to DSH" button in DS Bot's sidebar. Merged from dsh-grouped-nav.
// localStorage keys intentionally keep the dsh-grouped-nav: prefix so the
// existing hide lists keep working.

const SIDEBAR_TOOLS_LS = 'dsh-grouped-nav:';
const SIDEBAR_TOOLS_STYLE_ID = 'dsh-seven-appearance-sidebar-tools';
const SIDEBAR_TOOLS_EDIT_STYLE_ID = 'dsh-seven-appearance-edit-sidebar-style';
const SIDEBAR_TOOLS_DEFAULT_HIDDEN = ['schedules', 'guizang-design', 'media-desk', 'dsh-market', 'dsh-claude-style.search'];
const SIDEBAR_TOOLS_SVG_NS = 'http://www.w3.org/2000/svg';

export function createSidebarTools({ React, require: requireRuntime }) {
  const isZh = () => /^zh/i.test(document.documentElement.lang || navigator.language || '');

  const readList = (key, fallback = []) => {
    try {
      const raw = localStorage.getItem(SIDEBAR_TOOLS_LS + key);
      if (raw === null) return [...fallback];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [...fallback];
    } catch { return [...fallback]; }
  };
  const writeList = (key, list) => {
    try { localStorage.setItem(SIDEBAR_TOOLS_LS + key, JSON.stringify([...new Set(list)])); } catch { /* storage unavailable */ }
  };

  const cleanClass = (el) => [...el.classList].filter((c) => !/active|fading|rail/i.test(c)).join(' ');

  const ensureBaseStyle = () => {
    if (document.getElementById(SIDEBAR_TOOLS_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SIDEBAR_TOOLS_STYLE_ID;
    style.textContent =
      '.gn-es-list{display:flex;flex-direction:column;gap:4px;max-height:55vh;overflow-y:auto;padding:2px 0}' +
      '.gn-es-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:13.5px;user-select:none}' +
      '.gn-es-row:hover{background:var(--dsh-surface-hover,rgba(128,128,128,.12))}' +
      '.gn-es-row input[type=checkbox]{width:15px;height:15px;accent-color:var(--dsh-accent,currentColor);cursor:pointer;flex:none}' +
      '.gn-es-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.gn-es-item{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%}' +
      'button.gn-agent-return{position:absolute;top:8px;right:12px;z-index:30;display:inline-flex;align-items:center;justify-content:center;gap:5px;' +
      'height:28px;min-height:28px;max-width:calc(100% - 24px);padding:0 8px;border:0;border-radius:7px;font:inherit;font-size:12.5px;line-height:18px;' +
      'background:transparent;color:var(--bt-ink,inherit);cursor:pointer;-webkit-app-region:no-drag;margin:0;box-sizing:border-box;transition:background-color .12s ease,transform .12s ease}' +
      'html[data-platform=darwin] button.gn-agent-return{top:calc((var(--bt-lc-clear,48px) - 28px) / 2 + 1px)}' +
      'html[data-platform=darwin]:not([data-fullscreen]) button.gn-agent-return{max-width:calc(100% - 88px)}' +
      'html[data-windows-titlebar] button.gn-agent-return{top:calc((var(--bt-lc-clear,36px) - 28px) / 2)}' +
      'button.gn-agent-return:hover{background:rgba(127,127,127,.14)}' +
      'button.gn-agent-return:active{transform:scale(.96)}' +
      'button.gn-agent-return .gn-agent-return-mark{display:inline-flex;align-items:center;justify-content:center;flex:none;width:16px;height:16px;line-height:0}' +
      'button.gn-agent-return .gn-agent-return-mark svg{width:16px;height:16px;display:block}' +
      'button.gn-agent-return .gn-agent-return-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      'button.gn-agent-return .gn-agent-return-swap{display:inline-flex;flex:none;line-height:0;opacity:.55}' +
      'button.gn-agent-return .gn-agent-return-swap svg{width:14px;height:14px}' +
      '.bt-leftcol[data-left=rail] > button.gn-agent-return,.bt-leftcol[data-leaving] > button.gn-agent-return{display:none!important}' +
      'html:not([data-platform]):not([data-windows-titlebar]) .bt-leftcol:has(> button.gn-agent-return):not([data-left=rail]){padding-top:48px}' +
      'button.bt-return{position:fixed!important;top:var(--gn-ret-top,10px);right:var(--gn-ret-right,44px);z-index:30;height:28px;min-height:28px;padding:0 8px;gap:5px;' +
      'border-radius:7px;font-size:12.5px;line-height:18px;background:transparent!important;color:inherit;-webkit-app-region:no-drag;margin:0}' +
      'button.bt-return:hover{background:rgba(127,127,127,.14)!important}' +
      'button.bt-return .bt-mark{width:16px!important;height:16px!important;--bt-ink-deepseek:currentColor!important}' +
      'button.bt-return .bt-return-swap svg{width:14px;height:14px}' +
      '[data-sidebar-collapsed] button.bt-return{opacity:0!important;pointer-events:none!important}';
    document.head.appendChild(style);
  };

  function createPanelPinning(ctx) {
    let pendingHidden = new Set(readList('sidebar-hidden', SIDEBAR_TOOLS_DEFAULT_HIDDEN));
    const seenAt = new Map();
    let retryTimer = null;
    let pinsApi = null;
    let unsubscribePins = null;
    let modalRoot = null;
    let modalHost = null;
    let nativeHasUnpinned = false;
    const listeners = new Set();

    const setNativeHasUnpinned = (value) => {
      if (nativeHasUnpinned === value) return;
      nativeHasUnpinned = value;
      for (const fn of listeners) fn();
    };

    const findPinsApi = () => {
      try {
        for (const entry of ctx.slots.entries('sidebar')) {
          if (typeof entry.inject !== 'function') continue;
          const injected = entry.inject();
          const unpinned = injected?.hooks?.entryPins;
          const setPinned = injected?.setPinned;
          if (unpinned && typeof setPinned === 'function') return { unpinned, setPinned };
        }
      } catch { /* slot shape unavailable */ }
      return null;
    };

    const knownPanelIds = () => {
      const ids = new Set();
      try {
        for (const { options } of ctx.slots.entriesOfSlot('sidebar.panellist')) {
          if (options?.id) ids.add(options.id);
        }
      } catch { /* slot listing unavailable */ }
      return ids;
    };

    const applyPendingHidden = (api) => {
      if (pendingHidden.size === 0) return;
      const known = knownPanelIds();
      const current = api.unpinned.getSnapshot();
      const now = performance.now();
      let needRetry = false;
      for (const id of [...pendingHidden]) {
        if (current.includes(id)) { pendingHidden.delete(id); seenAt.delete(id); continue; }
        if (!known.has(id)) {
          if (!seenAt.has(id)) seenAt.set(id, now);
          if (now - seenAt.get(id) < 1500) { needRetry = true; continue; }
          pendingHidden.delete(id);
          seenAt.delete(id);
          continue;
        }
        pendingHidden.delete(id);
        seenAt.delete(id);
        api.setPinned(id, false);
      }
      if (needRetry && retryTimer === null) {
        retryTimer = setTimeout(() => { retryTimer = null; sync(); }, 250);
      }
    };

    const onPinsChange = () => {
      if (!pinsApi) return;
      const snap = pinsApi.unpinned.getSnapshot();
      writeList('sidebar-hidden', [...new Set([...snap, ...pendingHidden])]);
    };

    const closeModal = () => { if (modalRoot) modalRoot.render(null); };

    const openModal = (entries, onPinnedChange) => {
      ensureBaseStyle();
      if (!modalRoot) {
        modalHost = document.createElement('div');
        modalRoot = requireRuntime('react-dom/client').createRoot(modalHost);
      }
      const EditModal = () => {
        const [pinnedMap, setPinnedMap] = React.useState(() => new Map(entries.map((e) => [e.id, e.pinned !== false])));
        const toggle = (id, checked) => {
          setPinnedMap((prev) => new Map(prev).set(id, checked));
          onPinnedChange(id, checked);
        };
        const ui = requireRuntime('@deepseek-ai/dsh-client-ui-primitives');
        return React.createElement(ui.Modal, {
          open: true,
          onClose: closeModal,
          title: isZh() ? '编辑侧栏' : 'Edit sidebar',
          description: isZh() ? '选择要在侧栏中显示的项目。' : 'Choose which items appear in your sidebar.',
          closeLabel: isZh() ? '关闭' : 'Close',
          footer: React.createElement(ui.Button, { variant: 'primary', size: 'sm', onClick: closeModal }, isZh() ? '完成' : 'Done'),
        }, React.createElement('div', { className: 'gn-es-list' },
          entries.map((entry, idx) => React.createElement('label', { key: entry.id, className: 'gn-es-row' },
            React.createElement('input', {
              type: 'checkbox',
              checked: pinnedMap.get(entry.id) === true,
              onChange: (ev) => toggle(entry.id, ev.currentTarget.checked),
              'data-modal-autofocus': idx === 0 ? '' : undefined,
            }),
            React.createElement('span', null, entry.label || entry.id)))));
      };
      modalRoot.render(React.createElement(EditModal));
    };

    const HiddenPanelsMenu = ({ entries, onOpen, onDismiss }) => {
      const ui = requireRuntime('@deepseek-ai/dsh-client-ui-primitives');
      const skip = React.useSyncExternalStore(
        (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
        () => nativeHasUnpinned,
      );
      const hidden = entries.filter((e) => !e.pinned);
      if (hidden.length === 0 || skip) return null;
      return React.createElement(React.Fragment, null,
        hidden.map((entry) => React.createElement(ui.MenuItemButton, {
          key: entry.id,
          onSelect: () => { onDismiss(); onOpen(entry.id); },
          children: React.createElement('span', { className: 'gn-es-item' }, entry.label || entry.id),
        })),
        React.createElement('div', { role: 'separator' }));
    };

    const EditSidebarMenuItem = ({ entries, onDismiss, onPinnedChange }) => {
      const ui = requireRuntime('@deepseek-ai/dsh-client-ui-primitives');
      const ref = React.useRef(null);
      const hiddenKey = entries.filter((e) => !e.pinned).map((e) => e.label).join('\n');
      React.useLayoutEffect(() => {
        const menu = ref.current?.closest('[role="menu"]');
        if (!(menu instanceof HTMLElement)) return undefined;
        const labels = hiddenKey ? hiddenKey.split('\n') : [];
        let found = false;
        for (const item of menu.querySelectorAll('[role="menuitem"]')) {
          if (!item.querySelector('.gn-es-item') && labels.includes((item.textContent || '').trim())) { found = true; break; }
        }
        setNativeHasUnpinned(found);
        return () => setNativeHasUnpinned(false);
      }, [hiddenKey]);
      return React.createElement(ui.MenuItemButton, {
        separatorBefore: true,
        icon: React.createElement('span', { ref, 'aria-hidden': 'true' }),
        onSelect: () => { onDismiss(); openModal(entries, onPinnedChange); },
        children: isZh() ? '编辑侧栏…' : 'Edit sidebar…',
      });
    };

    // The More menu only lists registrations made through the slot's own inject:
    // registering at apply time lands before the region declares and is dropped.
    let disposeSlotRegistrations = null;
    try {
      disposeSlotRegistrations = ctx.slots.inject('sidebar.panellist.actions', () => {
        const regs = [];
        regs.push(ctx.slots.register({ name: 'sidebar.panellist.actions', id: 'seven-appearance-hidden-panels', order: -10 }, HiddenPanelsMenu));
        regs.push(ctx.slots.register({ name: 'sidebar.panellist.actions', id: 'seven-appearance-edit-sidebar', order: 10 }, EditSidebarMenuItem));
        return () => { for (const reg of regs) { try { reg?.dispose?.(); } catch { /* already gone */ } } };
      });
    } catch (error) {
      console.warn('[dsh-seven-appearance] sidebar.panellist.actions registration failed:', error);
    }

    function sync() {
      const api = findPinsApi();
      if (!api) return;
      if (!pinsApi || pinsApi.unpinned !== api.unpinned) {
        if (unsubscribePins) { unsubscribePins(); unsubscribePins = null; }
        pinsApi = api;
        unsubscribePins = api.unpinned.subscribe(onPinsChange);
        pendingHidden = new Set(readList('sidebar-hidden', SIDEBAR_TOOLS_DEFAULT_HIDDEN));
        seenAt.clear();
      }
      applyPendingHidden(api);
    }

    function dispose() {
      if (disposeSlotRegistrations) { try { disposeSlotRegistrations(); } catch { /* already gone */ } disposeSlotRegistrations = null; }
      if (unsubscribePins) { unsubscribePins(); unsubscribePins = null; }
      if (retryTimer !== null) { clearTimeout(retryTimer); retryTimer = null; }
      if (modalRoot) { try { modalRoot.unmount(); } catch { /* already gone */ } modalRoot = null; }
      modalHost = null;
      listeners.clear();
    }

    return { sync, dispose };
  }

  function createLocalAgentFilter() {
    const rowButtonAttr = 'data-seven-la-remove';
    const restoreBarAttr = 'data-seven-la-restore-bar';
    const hiddenAttr = 'data-seven-la-hidden';

    const sync = () => {
      const hidden = new Set(readList('hidden-local-agents'));
      const settings = document.querySelector('[data-shortcut-modal="settings"]');
      if (settings) {
        const rows = [...settings.querySelectorAll('.bt-set-card .bt-la-row')];
        for (const row of rows) {
          const agentName = row.querySelector('.bt-la-name')?.textContent?.trim();
          if (!agentName) continue;
          const isHidden = hidden.has(agentName);
          row.style.display = isHidden ? 'none' : '';
          let removeButton = row.querySelector(`:scope > [${rowButtonAttr}]`);
          if (!removeButton) {
            removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'bt-soft bt-soft-sm';
            removeButton.setAttribute(rowButtonAttr, agentName);
            removeButton.style.cssText = 'flex:none;margin-left:6px;opacity:.75';
            removeButton.textContent = isZh() ? '移除' : 'Remove';
            removeButton.addEventListener('click', (event) => {
              event.stopPropagation();
              const next = readList('hidden-local-agents');
              if (!next.includes(agentName)) next.push(agentName);
              writeList('hidden-local-agents', next);
              scheduleSync();
            });
            row.appendChild(removeButton);
          }
        }
        if (rows.length > 0) {
          const card = rows[0].closest('.bt-set-card');
          if (card) {
            const hiddenHere = rows
              .map((r) => r.querySelector('.bt-la-name')?.textContent?.trim())
              .filter((name) => name && hidden.has(name));
            let bar = card.querySelector(`:scope > [${restoreBarAttr}]`);
            if (hiddenHere.length === 0) {
              if (bar) bar.remove();
            } else {
              if (!bar) {
                bar = document.createElement('div');
                bar.className = 'bt-set-row';
                bar.setAttribute(restoreBarAttr, '');
                bar.style.cssText = 'justify-content:space-between;gap:8px;opacity:.78;font-size:12.5px';
                card.appendChild(bar);
              }
              const signature = hiddenHere.join('|');
              if (bar.getAttribute('data-sig') !== signature) {
                bar.setAttribute('data-sig', signature);
                bar.replaceChildren();
                const label = document.createElement('span');
                label.className = 'bt-set-hint';
                label.textContent = (isZh() ? '已移除：' : 'Removed: ') + hiddenHere.join(', ');
                const wrap = document.createElement('span');
                wrap.style.cssText = 'display:flex;gap:6px;flex:none';
                for (const name of hiddenHere) {
                  const restore = document.createElement('button');
                  restore.type = 'button';
                  restore.className = 'bt-soft bt-soft-sm';
                  restore.textContent = (isZh() ? '恢复 ' : 'Restore ') + name;
                  restore.addEventListener('click', () => {
                    writeList('hidden-local-agents', readList('hidden-local-agents').filter((item) => item !== name));
                    scheduleSync();
                  });
                  wrap.appendChild(restore);
                }
                bar.append(label, wrap);
              }
            }
          }
        }
      }

      for (const group of document.querySelectorAll('.bt-model-group')) {
        const label = (group.querySelector('.bt-menu-label')?.textContent || group.textContent || '').trim();
        const hide = hidden.has(label);
        if (group.hasAttribute(hiddenAttr) || hide) {
          group.style.display = hide ? 'none' : '';
          if (hide) group.setAttribute(hiddenAttr, '1');
          else group.removeAttribute(hiddenAttr);
          let sibling = group.nextElementSibling;
          while (sibling && !sibling.classList.contains('bt-model-group')) {
            if (sibling.getAttribute('role') === 'menuitemradio') sibling.style.display = hide ? 'none' : '';
            sibling = sibling.nextElementSibling;
          }
        }
      }

      for (const card of document.querySelectorAll('.bt-model-choice-group[aria-label]')) {
        const label = card.getAttribute('aria-label')?.trim() || '';
        const hide = hidden.has(label);
        if (card.hasAttribute(hiddenAttr) || hide) {
          card.style.display = hide ? 'none' : '';
          if (hide) card.setAttribute(hiddenAttr, '1');
          else card.removeAttribute(hiddenAttr);
        }
      }

      const menuRoots = document.querySelectorAll('[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-floating-ui-portal]');
      for (const root of menuRoots) {
        for (const group of root.querySelectorAll('[role="group"]')) {
          const ariaLabel = group.getAttribute('aria-label')?.trim() || '';
          const labelledBy = group.getAttribute('aria-labelledby')?.trim() || '';
          let heading = labelledBy ? (document.getElementById(labelledBy)?.textContent?.trim() || '') : '';
          if (!heading) {
            for (const child of group.children) {
              if (child.matches('button, [role="menuitem"], [role="menuitemradio"], [role="option"], [role="separator"], hr')) continue;
              const text = child.textContent?.trim() || '';
              if (text) { heading = text; break; }
            }
          }
          const hide = hidden.has(ariaLabel) || hidden.has(heading);
          if (group.hasAttribute(hiddenAttr) || hide) {
            if (hide) {
              group.style.setProperty('display', 'none', 'important');
              group.setAttribute(hiddenAttr, '1');
            } else {
              group.style.removeProperty('display');
              group.removeAttribute(hiddenAttr);
            }
          }
        }
        for (const el of root.querySelectorAll('div, span, p, li')) {
          if (el.closest('button, [role="menuitem"], [role="menuitemradio"], [role="option"], [role="group"]')) continue;
          if (el.querySelector('button, [role="menuitem"], [role="menuitemradio"], [role="option"]')) continue;
          const text = el.textContent?.trim() || '';
          if (!text) continue;
          const hide = hidden.has(text);
          if (!hide && !el.hasAttribute(hiddenAttr)) continue;
          const parent = el.parentElement;
          if (parent && parent !== root && parent.children.length >= 2) {
            const otherHeadings = [...parent.children].filter((child) => child !== el
              && !child.matches('button, [role="menuitem"], [role="menuitemradio"], [role="option"], [role="separator"], hr')
              && (child.textContent?.trim() || '') !== '');
            if (otherHeadings.length === 0) {
              if (hide) {
                parent.style.setProperty('display', 'none', 'important');
                parent.setAttribute(hiddenAttr, '1');
              } else {
                parent.style.removeProperty('display');
                parent.removeAttribute(hiddenAttr);
              }
              continue;
            }
          }
          if (hide) {
            el.style.setProperty('display', 'none', 'important');
            el.setAttribute(hiddenAttr, '1');
          } else {
            el.style.removeProperty('display');
            el.removeAttribute(hiddenAttr);
          }
          let sibling = el.nextElementSibling;
          while (sibling) {
            if (!sibling.matches('button, [role="menuitem"], [role="menuitemradio"], [role="option"]')) break;
            if (hide) {
              sibling.style.setProperty('display', 'none', 'important');
              sibling.setAttribute(hiddenAttr, '1');
            } else {
              sibling.style.removeProperty('display');
              sibling.removeAttribute(hiddenAttr);
            }
            sibling = sibling.nextElementSibling;
          }
        }
      }
    };

    const dispose = () => {
      document.querySelectorAll(`[${rowButtonAttr}], [${restoreBarAttr}]`).forEach((el) => el.remove());
      document.querySelectorAll(`[${hiddenAttr}]`).forEach((el) => { el.style.display = ''; el.removeAttribute(hiddenAttr); });
    };

    return { sync, dispose };
  }

  function createAgentReturnButton(ctx) {
    const findSetSurface = () => {
      for (const slotName of ['sidebar.footer.action', 'sidebar.workspaces']) {
        try {
          for (const entry of ctx.slots.entries(slotName)) {
            if (typeof entry.inject !== 'function') continue;
            const injected = entry.inject();
            if (typeof injected?.actions?.setSurface === 'function') return injected.actions.setSurface;
          }
        } catch { /* slot unavailable */ }
      }
      return null;
    };

    const fallbackMark = () => {
      const svg = document.createElementNS(SIDEBAR_TOOLS_SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('aria-hidden', 'true');
      const defs = document.createElementNS(SIDEBAR_TOOLS_SVG_NS, 'defs');
      const mask = document.createElementNS(SIDEBAR_TOOLS_SVG_NS, 'mask');
      mask.setAttribute('id', 'seven-dsh-whale-mask');
      const bg = document.createElementNS(SIDEBAR_TOOLS_SVG_NS, 'rect');
      bg.setAttribute('width', '100'); bg.setAttribute('height', '100'); bg.setAttribute('fill', '#fff');
      const eyeOne = document.createElementNS(SIDEBAR_TOOLS_SVG_NS, 'rect');
      eyeOne.setAttribute('x', '67.85'); eyeOne.setAttribute('y', '36.9');
      eyeOne.setAttribute('width', '9.3'); eyeOne.setAttribute('height', '23'); eyeOne.setAttribute('rx', '4.65');
      eyeOne.setAttribute('transform', 'rotate(-15.8 72.5 48.4)'); eyeOne.setAttribute('fill', '#000');
      const eyeTwo = document.createElementNS(SIDEBAR_TOOLS_SVG_NS, 'rect');
      eyeTwo.setAttribute('x', '82.1'); eyeTwo.setAttribute('y', '31.95');
      eyeTwo.setAttribute('width', '7'); eyeTwo.setAttribute('height', '22.9'); eyeTwo.setAttribute('rx', '3.5');
      eyeTwo.setAttribute('transform', 'rotate(-21.2 85.6 43.4)'); eyeTwo.setAttribute('fill', '#000');
      mask.append(bg, eyeOne, eyeTwo);
      defs.appendChild(mask);
      const body = document.createElementNS(SIDEBAR_TOOLS_SVG_NS, 'path');
      body.setAttribute('d', 'M65.3 20.9l5.1 .1 4.8 .9 4.8 1.7 4.3 2.3 3.8 3.1 3 3.4 2.3 3.8 1.6 4.3 .9 4.3 0 4.8-.8 4.8-1.4 4.3-2.3 4.3-3.2 4.3-3.4 3.3-4.3 3.1-7.2 3.5-7.6 1.7-7.2 .1-9.6-1.6-3.3-1-2.9-1.7-8.8-8.9-6-4.7-3.3-.5-7.7 1.1-4.8-.1-4.7-1.2-1.9-1.2-1-1-.5-1.5 .4-1.4 1.1-1.3 1.9-1.3 4.7-1.5 7.7-.6 1.1-.5 .7-1 0-1.4-2.8-7.2-1.2-5.3-.1-4.3 .4-1.4 .9-1.2 1.9-.2 2 1 2.2 2.3 2.2 3.4 3.2 7.6 1.9 9.7 .5-.1 1.1-7.2 1.8-4.8 3.2-5.2 3.9-4.3 4.9-3.9 5.6-2.9 5.8-1.9z');
      body.setAttribute('fill', 'currentColor');
      body.setAttribute('mask', 'url(#seven-dsh-whale-mask)');
      svg.append(defs, body);
      return svg;
    };

    const swapIcon = () => {
      const svg = document.createElementNS(SIDEBAR_TOOLS_SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 20 20');
      svg.setAttribute('width', '14');
      svg.setAttribute('height', '14');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.5');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      for (const d of ['M4 7h9.5M10.5 3.5L14 7l-3.5 3.5', 'M16 13H6.5M9.5 9.5L6 13l3.5 3.5']) {
        const path = document.createElementNS(SIDEBAR_TOOLS_SVG_NS, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
      }
      return svg;
    };

    let button = null;
    let nameSpan = null;
    let markRoot = null;

    const ensureButton = () => {
      if (button) return button;
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'gn-agent-return';
      const markSpan = document.createElement('span');
      markSpan.className = 'gn-agent-return-mark';
      markSpan.setAttribute('aria-hidden', 'true');
      let mountedOfficial = false;
      try {
        const { createRoot } = requireRuntime('react-dom/client');
        const ui = requireRuntime('@deepseek-ai/dsh-client-ui-primitives');
        if (typeof ui?.FishLogo === 'function') {
          markRoot = createRoot(markSpan);
          markRoot.render(React.createElement(ui.FishLogo, { size: 16 }));
          mountedOfficial = true;
        }
      } catch { /* fall back to the built-in mark */ }
      if (!mountedOfficial) markSpan.appendChild(fallbackMark());

      nameSpan = document.createElement('span');
      nameSpan.className = 'gn-agent-return-name';

      const swapSpan = document.createElement('span');
      swapSpan.className = 'gn-agent-return-swap';
      swapSpan.setAttribute('aria-hidden', 'true');
      swapSpan.appendChild(swapIcon());

      button.append(markSpan, nameSpan, swapSpan);
      button.addEventListener('click', () => {
        const setSurface = findSetSurface();
        if (setSurface) setSurface('agent');
      });
      return button;
    };

    const sync = () => {
      const leftCol = document.querySelector('.bt-leftcol');
      const show = Boolean(
        leftCol
        && !leftCol.hasAttribute('data-leaving')
        && leftCol.getAttribute('data-left') !== 'rail'
        && leftCol.querySelector('.bt-side-top')
        && !leftCol.querySelector('.dsh-claude-surface-switch'),
      );
      if (!show) {
        if (button && button.parentElement) button.remove();
        document.querySelectorAll('.bt-leftcol > button.gn-agent-return').forEach((el) => el.remove());
        return;
      }
      const el = ensureButton();
      const label = isZh() ? '返回 DSH' : 'Back to DSH';
      if (nameSpan.textContent !== label) {
        nameSpan.textContent = label;
        el.setAttribute('aria-label', label);
        el.title = label;
      }
      if (el.parentElement !== leftCol) leftCol.appendChild(el);
    };

    const dispose = () => {
      if (markRoot) { try { markRoot.unmount(); } catch { /* already gone */ } markRoot = null; }
      if (button) { button.remove(); button = null; nameSpan = null; }
      document.querySelectorAll('button.gn-agent-return').forEach((el) => el.remove());
    };

    return { sync, dispose };
  }

  function syncReturnButton() {
    const button = document.querySelector('button.bt-return');
    if (!button) return;
    const column = button.closest('[class*="_sidebarCol"]') || document.querySelector('[class*="_sidebarCol"]');
    if (!column || column.closest('[data-sidebar-collapsed]')) return;
    let toggleRect = null;
    for (const candidate of column.querySelectorAll('button')) {
      if (candidate === button) continue;
      const rect = candidate.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < 80) {
        if (!toggleRect || rect.right > toggleRect.right) toggleRect = rect;
      }
    }
    if (!toggleRect) return;
    button.style.setProperty('--gn-ret-top', Math.round(toggleRect.top + (toggleRect.height - 28) / 2) + 'px');
    button.style.setProperty('--gn-ret-right', Math.round(window.innerWidth - toggleRect.left + 4) + 'px');
  }

  let scheduleSync = () => {};

  function start(ctx) {
    ensureBaseStyle();
    const panels = createPanelPinning(ctx);
    const agents = createLocalAgentFilter();
    const agentReturn = createAgentReturnButton(ctx);
    let raf = 0;
    let observer = null;

    const observe = () => {
      observer?.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-current', 'data-sidebar-collapsed', 'data-left', 'data-leaving', 'data-shortcut-modal'],
      });
    };
    const run = () => {
      raf = 0;
      observer?.disconnect();
      try {
        panels.sync();
        agents.sync();
        agentReturn.sync();
        syncReturnButton();
      } catch (error) {
        console.warn('[dsh-seven-appearance] sidebar tools:', error);
      }
      observe();
    };
    scheduleSync = () => { if (!raf) raf = requestAnimationFrame(run); };

    observer = new MutationObserver(scheduleSync);
    window.addEventListener('resize', scheduleSync);
    observe();
    scheduleSync();

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', scheduleSync);
      if (raf) cancelAnimationFrame(raf);
      scheduleSync = () => {};
      panels.dispose();
      agents.dispose();
      agentReturn.dispose();
      document.getElementById(SIDEBAR_TOOLS_STYLE_ID)?.remove();
    };
  }

  return { start };
}
