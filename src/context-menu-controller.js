// Conversation context menu for dsh-obsidian-prism
import { isZhUi } from './i18n.js';
import { findComposerInput, formatSelectionQuote, insertTextIntoComposer } from './selection-ask-controller.js';

const SKIP_SELECTOR = [
  '[data-composer-card]',
  '[data-composer-dock]',
  'textarea',
  'input',
  'select',
  '[contenteditable="true"]',
  '.op-drawer',
  '.op-context-menu',
  '[role="dialog"]',
].join(',');

async function writeClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

export function createContextMenuController({ getSettings, openSideQuestion }) {
  let menuEl = null;
  let toastEl = null;
  let toastTimer = null;
  let disposed = false;

  function showToast(msg, tone = 'ok') {
    if (disposed || !document.body) return;
    if (toastTimer) clearTimeout(toastTimer);
    toastEl?.remove();
    toastEl = document.createElement('div');
    toastEl.className = 'op-selection-toast';
    toastEl.setAttribute('data-op-ui', '1');
    toastEl.setAttribute('data-tone', tone);
    toastEl.setAttribute('data-visible', '1');
    toastEl.setAttribute('role', 'status');
    toastEl.textContent = msg;
    document.body.appendChild(toastEl);
    toastTimer = setTimeout(() => { toastEl?.remove(); toastEl = null; }, 2200);
  }

  function hideMenu() {
    menuEl?.remove();
    menuEl = null;
  }

  async function copy(text, zh, label) {
    try {
      await writeClipboard(text);
      showToast(zh ? `已复制${label.zh}` : `Copied ${label.en}`);
    } catch {
      showToast(zh ? '复制失败' : 'Copy failed', 'err');
    }
  }

  function insert(text, mode, zh) {
    const composer = findComposerInput(document);
    if (!composer) return showToast(zh ? '未找到输入框' : 'Composer input not found', 'err');
    if (insertTextIntoComposer(composer, formatSelectionQuote(text, mode, zh))) {
      showToast(mode === 'explain' ? (zh ? '已填充解释追问' : 'Explain prompt inserted') : (zh ? '已引用到输入框' : 'Quoted into composer'));
    }
  }

  function collectItems(target, zh, selectionAskEnabled) {
    const items = [];
    const sel = window.getSelection?.();
    const selText = sel && !sel.isCollapsed ? String(sel.toString()).trim() : '';
    if (selText) {
      items.push({ label: zh ? '复制选中内容' : 'Copy selection', run: () => copy(selText, zh, { zh: '选中内容', en: 'selection' }) });
      if (selectionAskEnabled) {
        const conversation = target.closest('[data-conversation-session]');
        const sessionId = conversation && !conversation.closest('.op-side-question')
          ? conversation.getAttribute('data-conversation-session')
          : null;
        if (sessionId && conversation.contains(sel.anchorNode) && conversation.contains(sel.focusNode)) {
          const open = (mode) => openSideQuestion(sessionId, selText, mode, zh).catch(() => {
            showToast(zh ? '未能打开侧边追问' : 'Could not open the sidebar question', 'err');
          });
          items.push({ label: zh ? '在侧边栏追问' : 'Ask in the sidebar', run: () => open('quote') });
          items.push({ label: zh ? '在侧边栏解释' : 'Explain in the sidebar', run: () => open('explain') });
        }
      }
    }

    const link = target.closest('a[href]');
    if (link && /^https?:/i.test(link.href)) {
      items.push({ sep: true });
      items.push({ label: zh ? '复制链接' : 'Copy link', run: () => copy(link.href, zh, { zh: '链接', en: 'link' }) });
    }

    const pathEl = target.closest('[data-path], [data-files-path], [data-presented-file] [title]');
    const path = pathEl?.getAttribute('data-path') || pathEl?.getAttribute('data-files-path') || pathEl?.getAttribute('title');
    if (path && /[\\/]/.test(path)) {
      items.push({ sep: true });
      items.push({ label: zh ? '复制文件路径' : 'Copy file path', run: () => copy(path, zh, { zh: '文件路径', en: 'path' }) });
      items.push({ label: zh ? '在输入框中引用路径' : 'Mention path in composer', run: () => insert(path, 'quote', zh) });
    }

    const pre = target.closest('pre');
    if (pre) {
      const code = (pre.querySelector('code') || pre).innerText.replace(/\n$/, '');
      if (code) {
        items.push({ sep: true });
        items.push({ label: zh ? '复制整段代码' : 'Copy code block', run: () => copy(code, zh, { zh: '代码', en: 'code' }) });
      }
    }

    const turn = target.closest('[data-message-bubble], [data-chat-turn], [data-message-role], [data-turn], [data-message-id]');
    if (turn && !selText) {
      const txt = turn.innerText.trim();
      if (txt) {
        items.push({ sep: true });
        items.push({ label: zh ? '复制整条消息' : 'Copy message', run: () => copy(txt, zh, { zh: '整条消息', en: 'message' }) });
        items.push({ label: zh ? '引用整条消息' : 'Quote message', run: () => insert(txt, 'quote', zh) });
      }
    }

    while (items.length && items[0].sep) items.shift();
    return items;
  }

  function renderMenu(items, x, y) {
    hideMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'op-context-menu';
    menuEl.setAttribute('data-op-ui', '1');
    menuEl.setAttribute('role', 'menu');
    for (const it of items) {
      if (it.sep) {
        const hr = document.createElement('div');
        hr.className = 'op-context-menu-sep';
        menuEl.appendChild(hr);
        continue;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'op-context-menu-item';
      btn.setAttribute('role', 'menuitem');
      btn.textContent = it.label;
      btn.addEventListener('mousedown', (ev) => ev.preventDefault());
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        hideMenu();
        it.run();
      });
      menuEl.appendChild(btn);
    }
    document.body.appendChild(menuEl);
    const r = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    menuEl.style.left = `${Math.max(8, Math.min(x, vw - r.width - 8))}px`;
    menuEl.style.top = `${Math.max(8, y + r.height > vh - 8 ? y - r.height : y)}px`;
    menuEl.querySelector('button')?.focus({ preventScroll: true });
  }

  function onContextMenu(ev) {
    const s = getSettings();
    if (!s.enabled) return;
    if (ev.shiftKey) return; // Shift+右键保留系统菜单
    const target = ev.target instanceof Element ? ev.target : ev.target?.parentElement;
    if (!target || target.closest(SKIP_SELECTOR)) return;
    const items = collectItems(target, isZhUi(s), Boolean(s.selectionAskEnabled));
    if (!items.length) return;
    ev.preventDefault();
    ev.stopPropagation();
    renderMenu(items, ev.clientX, ev.clientY);
  }

  function onPointerDown(ev) {
    if (menuEl && !menuEl.contains(ev.target)) hideMenu();
  }

  function onKeyDown(ev) {
    if (!menuEl) return;
    if (ev.key === 'Escape') return hideMenu();
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      const btns = [...menuEl.querySelectorAll('button')];
      const i = btns.indexOf(document.activeElement);
      const next = ev.key === 'ArrowDown' ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length;
      btns[next]?.focus();
      ev.preventDefault();
    }
  }

  function start() {
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', hideMenu, true);
    window.addEventListener('resize', hideMenu);
    window.addEventListener('blur', hideMenu);
  }

  function refresh() {
    const s = getSettings();
    if (!s.enabled) hideMenu();
  }

  function dispose() {
    disposed = true;
    document.removeEventListener('contextmenu', onContextMenu, true);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', hideMenu, true);
    window.removeEventListener('resize', hideMenu);
    window.removeEventListener('blur', hideMenu);
    hideMenu();
    if (toastTimer) clearTimeout(toastTimer);
    toastEl?.remove();
  }

  return { start, refresh, dispose };
}
