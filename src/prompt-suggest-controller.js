// Next-prompt suggestion for dsh-obsidian-prism.
// After the main conversation finishes a reply, ask Magpie (via the plugin
// host route) for one likely next prompt and show it as a chip above the
// composer. Click or Tab (with an empty composer) inserts it; typing hides it.
import { isZhUi } from './i18n.js';
import { findComposerInput, insertTextIntoComposer } from './selection-ask-controller.js';

const CHIP_ID = 'op-prompt-suggest';
const MAX_CTX = 2400;

function textOf(el) {
  return String(el?.innerText || el?.textContent || '').replace(/\s+\n/g, '\n').trim();
}

export function collectTurnContext(doc = document) {
  const pick = (sel) => {
    const list = doc.querySelectorAll(sel);
    return list.length ? list[list.length - 1] : null;
  };
  const user = pick('[data-message-role="user"], [data-role="user"], [data-turn-role="user"], [data-author="user"]');
  const assistant = pick('[data-message-role="assistant"], [data-role="assistant"], [data-turn-role="assistant"], [data-author="assistant"]');
  const u = textOf(user).slice(-MAX_CTX / 3);
  const a = textOf(assistant).slice(-MAX_CTX);
  if (!a) return null;
  return { user: u, assistant: a, sig: `${u.length}:${a.length}:${a.slice(-40)}` };
}

function composerIsEmpty(input) {
  if (!input) return false;
  const v = input.tagName === 'TEXTAREA' ? input.value : input.textContent;
  return !String(v || '').replace(/\u200B/g, '').trim();
}

export function createPromptSuggestController({ getSettings }) {
  let lastSig = '';
  let reqSeq = 0;
  let suggestion = '';
  let onKey = null;
  let onInput = null;

  const enabled = () => {
    const s = getSettings();
    return Boolean(s.enabled && s.promptSuggestEnabled);
  };

  function hide() {
    suggestion = '';
    document.getElementById(CHIP_ID)?.remove();
  }

  function accept() {
    if (!suggestion) return false;
    const input = findComposerInput(document);
    const text = suggestion;
    hide();
    return insertTextIntoComposer(input, text);
  }

  function show(text) {
    const input = findComposerInput(document);
    const card = input?.closest('[data-composer-card]') || input?.parentElement;
    if (!card || !composerIsEmpty(input)) return;
    suggestion = text;
    let chip = document.getElementById(CHIP_ID);
    if (!chip) {
      chip = document.createElement('button');
      chip.id = CHIP_ID;
      chip.type = 'button';
      chip.className = 'op-prompt-suggest';
      chip.setAttribute('translate', 'no');
      chip.addEventListener('mousedown', (ev) => ev.preventDefault());
      chip.addEventListener('click', () => accept());
      card.parentElement?.insertBefore(chip, card);
    }
    const zh = isZhUi(getSettings());
    chip.title = zh ? '点击或按 Tab 使用这条建议' : 'Click or press Tab to use';
    chip.textContent = '';
    const label = document.createElement('span');
    label.className = 'op-prompt-suggest-label';
    label.textContent = zh ? '下一步' : 'Next';
    const body = document.createElement('span');
    body.className = 'op-prompt-suggest-text';
    body.textContent = text;
    const key = document.createElement('kbd');
    key.textContent = 'Tab';
    chip.append(label, body, key);
  }

  async function request() {
    const ctx = collectTurnContext(document);
    if (!ctx || ctx.sig === lastSig) return;
    lastSig = ctx.sig;
    const seq = ++reqSeq;
    try {
      const res = await fetch('/api/dsh-obsidian-prism/prompt-suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: ctx.user, assistant: ctx.assistant, zh: isZhUi(getSettings()) }),
      });
      const j = await res.json();
      if (seq !== reqSeq || !enabled()) return;
      if (j?.ok && typeof j.text === 'string' && j.text.trim()) show(j.text.trim());
    } catch { /* suggestion is optional */ }
  }

  function notifyStreamingChange(streaming) {
    if (streaming) { reqSeq += 1; hide(); return; }
    if (enabled()) setTimeout(() => { if (enabled()) request(); }, 800);
  }

  function attach() {
    if (onKey) return;
    onKey = (ev) => {
      if (!suggestion || ev.key !== 'Tab' || ev.shiftKey || ev.altKey || ev.metaKey || ev.ctrlKey) return;
      const input = findComposerInput(document);
      if (!input || !input.contains(ev.target) && ev.target !== input) return;
      if (!composerIsEmpty(input)) return;
      ev.preventDefault();
      ev.stopPropagation();
      accept();
    };
    onInput = (ev) => {
      if (!suggestion) return;
      const input = findComposerInput(document);
      if (input && (input === ev.target || input.contains(ev.target)) && !composerIsEmpty(input)) hide();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('input', onInput, true);
  }

  function detach() {
    if (onKey) document.removeEventListener('keydown', onKey, true);
    if (onInput) document.removeEventListener('input', onInput, true);
    onKey = null;
    onInput = null;
    hide();
  }

  function refresh() {
    if (enabled()) attach();
    else detach();
  }

  return { start: refresh, refresh, notifyStreamingChange, dispose: detach };
}
