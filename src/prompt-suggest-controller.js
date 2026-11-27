// Next-prompt suggestion for dsh-obsidian-prism.
// Renders a translucent inline ghost follow-up inside the empty composer:
// - Shows a context-aware local suggestion at 0ms as soon as a reply finishes.
// - In default/model mode, prefetches during streaming or silently upgrades
//   with a fast lightweight model (~0.5s) if the user hasn't typed yet.
// - In pure-local mode (promptSuggestModel === 'local'), makes zero network
//   calls and cycles local candidates instantaneously on Shift+Tab.
// - Persists across session switches, window focus changes, and composer
//   remounts until the user chooses to type (or accepts via Tab / Esc).
import { isZhUi } from './i18n.js';
import { findComposerInput, insertTextIntoComposer } from './selection-ask-controller.js';

export const LOCAL_ONLY_MODEL = 'local';

const GHOST_ID = 'op-prompt-suggest';
const GHOST_HOST_ATTR = 'data-op-prompt-ghost';
const MAX_CTX = 1200;
const FINISH_SETTLE_MS = 50;
const SYNC_DEBOUNCE_MS = 120;
const PREFETCH_POLL_MS = 400;
const PREFETCH_MIN_CHARS = 32;
const PREFETCH_REDO_DELTA = 320;
const PREFETCH_REDO_COOLDOWN_MS = 2500;
const PREFETCH_FINAL_DELTA = 180;
const PREFETCH_MAX_PER_TURN = 2;
const MAX_CACHE_ENTRIES = 30;
const MAX_TRACKED_SIGS = 50;

function textOf(el) {
  return String(el?.innerText || el?.textContent || '').replace(/\s+\n/g, '\n').trim();
}

const SIDEBAR_EXCLUDED = '[data-sidebar-right-session], .op-side-question';

function setBoundedMap(map, key, value, max = MAX_CACHE_ENTRIES) {
  if (!key) return;
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > max) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
}

function addBoundedSet(set, key, max = MAX_TRACKED_SIGS) {
  if (!key) return;
  if (set.has(key)) set.delete(key);
  set.add(key);
  while (set.size > max) {
    const oldest = set.values().next().value;
    set.delete(oldest);
  }
}

function dedupeSuggestions(items) {
  const out = [];
  for (const item of items) {
    const t = String(item || '').trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function buildLocalSuggestions({ user = '', assistant = '', zh = true } = {}) {
  const body = String(assistant || '').trim();
  const tail = body.slice(-260);
  const full = `${String(user || '')}\n${body}`;

  if (!zh) {
    if (/(option\s*[1a]|approach\s*[1a]|which\s+(one|option|approach)|prefer\s+option|1\.\s+.+\n\s*2\.)/i.test(body)) {
      return dedupeSuggestions([
        'Go with your recommended option and implement it',
        'Let us go with Option 1',
        'Let us go with Option 2',
        'Explain the tradeoffs between the options briefly',
      ]);
    }
    if (/(refresh|reload|test|verify|passed|built|deployed|fixed|updated|ready)/i.test(tail)) {
      return dedupeSuggestions([
        'Looks good, continue to the next step',
        'Let me test it and adjust a few details',
        'Double-check for any edge cases we missed',
        'Summarize the changes for commit',
      ]);
    }
    if (/(error|failed|blocked|bug|issue|root cause|exception)/i.test(tail)) {
      return dedupeSuggestions([
        'Fix it with the cleanest approach',
        'Dig deeper into the root cause first',
        'Is there a simpler workaround?',
        'Check if the same issue exists elsewhere',
      ]);
    }
    if (/\?\s*$/.test(tail) || /(would you like|want me to|should i|shall we|confirm)/i.test(tail)) {
      return dedupeSuggestions([
        'Yes, go ahead',
        'Sounds good, do it as you suggested',
        'Hold on, I want to tweak one detail first',
        'Skip that for now and move on',
      ]);
    }
    return dedupeSuggestions([
      'Go ahead and implement this',
      'Continue to the next step',
      'Explain this in a bit more detail',
      'Verify and test the result',
    ]);
  }

  // Chinese context-aware instant suggestions
  const hasChoices =
    /(方案\s*[1一A]|第一种|第二种|①[\s\S]{1,120}②|哪一种|按哪种|选哪种|二选一|两种改法|两种做法)/.test(body) ||
    /(^|\n)\s*1[.、]\s*[\s\S]{4,140}\n\s*2[.、]\s*/.test(body);
  if (hasChoices) {
    return dedupeSuggestions([
      '按你推荐的方案直接做',
      '选第一种，直接动手',
      '选第二种吧',
      '再补充说下这两种的区别',
    ]);
  }

  const hasRefreshOrTest = /(刷新|重启|试一下|测一测|测完|验三件事|测试|验证通过|全部通过|已改好|改好了|上线|发布)/.test(tail);
  if (hasRefreshOrTest) {
    return dedupeSuggestions([
      '试完了，帮我再微调一下',
      '没问题，继续下一步',
      '顺便检查下还有没有漏掉的地方',
      '把这次改动整理一下提交吧',
    ]);
  }

  const hasProblem = /(报错|失败|卡住|原因|排查|冲突|异常|没生效|不显示|消失)/.test(tail);
  if (hasProblem) {
    return dedupeSuggestions([
      '按最稳的办法直接修掉',
      '顺便把同类地方也一并排查下',
      '有没有更简单直接的做法？',
      '继续往下查根因',
    ]);
  }

  const asksConfirm = /[？?]\s*$/.test(tail) || /(要不要|是否|可以吗|需要我|你想按|你看|确认一下)/.test(tail);
  if (asksConfirm) {
    return dedupeSuggestions([
      '可以，直接开始做',
      '按你的建议来就行',
      '等一下，我先补充个要求',
      '这个先不动，接着看别的',
    ]);
  }

  if (/(计划|方案|思路|对比|结论|建议)/.test(full)) {
    return dedupeSuggestions([
      '直接按这个方案落地',
      '有没有更省事的做法？',
      '再讲具体一点',
      '继续下一步',
    ]);
  }

  return dedupeSuggestions([
    '继续下一步',
    '直接帮我改好',
    '帮我测试验证一下',
    '再详细说说',
  ]);
}

function isLocalOnlyModel(model) {
  return String(model || '').trim() === LOCAL_ONLY_MODEL;
}

function resolveMainConversation(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return null;
  if (typeof doc.querySelector === 'function') {
    const sessions = doc.querySelectorAll('[data-conversation-session]');
    for (const el of sessions) {
      if (!el.closest?.(SIDEBAR_EXCLUDED) && !el.hidden && !el.closest?.('[hidden], [inert]')) return el;
    }
  }
  return doc;
}

function findMainComposerInput(doc = document) {
  const main = resolveMainConversation(doc);
  if (main && main !== doc) {
    const input = findComposerInput(main);
    if (input) return input;
  }
  return findComposerInput(doc);
}

function extractTurnFromRows(root, turn, { responseOnly = false } = {}) {
  const rows = Array.from(root.querySelectorAll('[data-chat-flow-kind][data-chat-turn]')).filter(
    (el) => !el.closest?.(SIDEBAR_EXCLUDED) && el.getAttribute?.('data-chat-turn') === turn,
  );
  const userParts = [];
  const responseParts = [];
  const fallbackParts = [];
  for (const el of rows) {
    const kind = el.getAttribute?.('data-chat-flow-kind');
    if (kind === 'user') {
      const txt = textOf(el.querySelector?.('[data-message-bubble]') || el);
      if (txt) userParts.push(txt);
    } else if (kind === 'assistant-step' || kind === 'assistant') {
      const part = el.getAttribute?.('data-chat-group-part');
      if (part === 'response') {
        const txt = textOf(el);
        if (txt) responseParts.push(txt);
      } else if (!part) {
        const resp = el.querySelector?.('[data-chat-group-part="response"]');
        if (resp) {
          const txt = textOf(resp);
          if (txt) responseParts.push(txt);
        } else if (!responseOnly) {
          const txt = textOf(el);
          if (txt) fallbackParts.push(txt);
        }
      }
    }
  }
  const u = userParts.join('\n\n').slice(-500);
  const a = (responseParts.length ? responseParts : fallbackParts).join('\n\n').slice(-MAX_CTX);
  if (!a) return null;
  return { user: u, assistant: a, sig: String(turn) };
}

export function collectStreamingContext(doc = document) {
  const root = resolveMainConversation(doc);
  if (!root) return null;
  const rows = Array.from(root.querySelectorAll('[data-chat-flow-kind][data-chat-turn]')).filter(
    (el) => !el.closest?.(SIDEBAR_EXCLUDED),
  );
  if (!rows.length) return null;
  const turn = rows[rows.length - 1].getAttribute?.('data-chat-turn');
  if (!turn) return null;
  return extractTurnFromRows(root, turn, { responseOnly: true });
}

export function collectTurnContext(doc = document) {
  const root = resolveMainConversation(doc);
  if (!root) return null;

  const tails = Array.from(root.querySelectorAll('[data-turn-tail]')).filter(
    (el) => !el.closest?.(SIDEBAR_EXCLUDED),
  );
  for (let i = tails.length - 1; i >= 0; i -= 1) {
    const tail = tails[i];
    const turn = tail.getAttribute?.('data-turn-tail') || tail.getAttribute?.('data-chat-turn');
    if (turn) {
      const extracted = extractTurnFromRows(root, turn);
      if (extracted) return extracted;
    }
  }

  const rows = Array.from(root.querySelectorAll('[data-chat-flow-kind][data-chat-turn]')).filter(
    (el) => !el.closest?.(SIDEBAR_EXCLUDED),
  );
  if (rows.length > 0) {
    const seenTurns = new Set();
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const turn = rows[i].getAttribute?.('data-chat-turn');
      if (!turn || seenTurns.has(turn)) continue;
      seenTurns.add(turn);
      const extracted = extractTurnFromRows(root, turn);
      if (extracted) return extracted;
    }
  }

  const pick = (sel) => {
    const list = Array.from(root.querySelectorAll(sel)).filter((el) => !el.closest?.(SIDEBAR_EXCLUDED));
    return list.length ? list[list.length - 1] : null;
  };
  const user = pick('[data-message-role="user"], [data-role="user"], [data-turn-role="user"], [data-author="user"]');
  const assistant = pick('[data-message-role="assistant"], [data-role="assistant"], [data-turn-role="assistant"], [data-author="assistant"]');
  const u = textOf(user).slice(-500);
  const a = textOf(assistant).slice(-MAX_CTX);
  if (!a) return null;
  return { user: u, assistant: a, sig: `${u.length}:${a.length}:${a.slice(-40)}` };
}

function composerIsEmpty(input) {
  if (!input) return false;
  const v = input.tagName === 'TEXTAREA' ? input.value : input.textContent;
  return !String(v || '').replace(/\u200B/g, '').trim();
}

function isDocumentStreaming() {
  return document.documentElement?.getAttribute?.('data-op-streaming') === '1';
}

export function createPromptSuggestController({ getSettings }) {
  let lastSig = '';
  let currentSig = '';
  let lastModel = getSettings()?.promptSuggestModel || '';
  let reqSeq = 0;
  let suggestion = '';
  let seen = [];
  let loadingNext = false;
  let hostEl = null;
  let pendingTimer = null;
  let syncTimer = null;
  let streamPollTimer = null;
  let isStreaming = false;
  let isComposing = false;
  let prefetched = null;
  let prefetchCount = 0;
  let lastPrefetchAt = 0;
  let onKey = null;
  let onInput = null;
  let onComposition = null;
  let onCompositionEnd = null;
  let onVisibility = null;
  let onWindowFocus = null;
  let mo = null;

  const cacheBySig = new Map();
  const dismissedSigs = new Set();
  const failedSigs = new Set();
  const inflightSigs = new Set();

  const enabled = () => {
    const s = getSettings();
    return Boolean(s.enabled && s.promptSuggestEnabled);
  };

  function makeSigKey(sessionId, turnSig, model) {
    return `${sessionId}:${turnSig}:${model}`;
  }

  function clearPendingTimer() {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function clearSyncTimer() {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
  }

  function clearStreamPoll() {
    if (streamPollTimer) {
      clearInterval(streamPollTimer);
      streamPollTimer = null;
    }
  }

  function resetPrefetch() {
    prefetched = null;
    prefetchCount = 0;
    lastPrefetchAt = 0;
  }

  function clearHostMark() {
    if (hostEl) {
      hostEl.removeAttribute?.(GHOST_HOST_ATTR);
      hostEl = null;
    }
    const stale = document.querySelectorAll?.(`[${GHOST_HOST_ATTR}]`) || [];
    for (const el of stale) el.removeAttribute?.(GHOST_HOST_ATTR);
  }

  function hide({ dismiss = false } = {}) {
    if (dismiss && currentSig) {
      addBoundedSet(dismissedSigs, currentSig);
    }
    suggestion = '';
    currentSig = '';
    loadingNext = false;
    document.getElementById?.(GHOST_ID)?.remove();
    clearHostMark();
  }

  function accept() {
    if (!suggestion) return false;
    const input = findMainComposerInput(document);
    if (!input) return false;
    const text = suggestion;
    hide();
    input.focus?.();
    return insertTextIntoComposer(input, text);
  }

  function renderGhost(text, sigKey = currentSig) {
    const input = findMainComposerInput(document);
    const host = input?.parentElement;
    if (!input || !host || isComposing || !composerIsEmpty(input)) return false;
    suggestion = text;
    if (sigKey) currentSig = sigKey;

    if (hostEl && hostEl !== host) clearHostMark();
    hostEl = host;
    host.setAttribute?.(GHOST_HOST_ATTR, '1');

    let ghost = document.getElementById?.(GHOST_ID);
    if (ghost && ghost.parentElement !== host) {
      ghost.remove();
      ghost = null;
    }
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.id = GHOST_ID;
      ghost.className = 'op-prompt-suggest';
      ghost.setAttribute('data-op-ui', '1');
      ghost.setAttribute('translate', 'no');
      ghost.setAttribute('aria-hidden', 'true');
      host.appendChild(ghost);
    }

    const zh = isZhUi(getSettings());
    ghost.textContent = '';

    const body = document.createElement('span');
    body.className = 'op-prompt-suggest-text';
    body.textContent = text;

    const actions = document.createElement('span');
    actions.className = 'op-prompt-suggest-actions';

    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'op-prompt-suggest-kbd';
    acceptBtn.tabIndex = -1;
    acceptBtn.textContent = 'Tab';
    acceptBtn.title = zh ? '按 Tab 或点击填入输入框' : 'Press or click Tab to insert';
    acceptBtn.addEventListener('mousedown', (ev) => ev.preventDefault());
    acceptBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      accept();
    });

    const cycleBtn = document.createElement('button');
    cycleBtn.type = 'button';
    cycleBtn.className = 'op-prompt-suggest-next';
    cycleBtn.tabIndex = -1;
    cycleBtn.disabled = loadingNext;
    cycleBtn.setAttribute('data-loading', loadingNext ? '1' : '0');
    cycleBtn.textContent = '↻';
    cycleBtn.title = zh ? '换一条建议 (Shift+Tab)' : 'Try another suggestion (Shift+Tab)';
    cycleBtn.addEventListener('mousedown', (ev) => ev.preventDefault());
    cycleBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      cycle();
    });

    actions.append(acceptBtn, cycleBtn);
    ghost.append(body, actions);
    return true;
  }

  function saveSuggestion(sigKey, text, seenList, { source = 'model', localPool = null, localIdx = 0 } = {}) {
    if (!sigKey || !text) return;
    if (source === 'model') failedSigs.delete(sigKey);
    const prev = cacheBySig.get(sigKey);
    const list = Array.isArray(seenList) && seenList.length
      ? seenList.slice(-5)
      : [text];
    setBoundedMap(cacheBySig, sigKey, {
      text,
      seen: list,
      source,
      localPool: localPool || prev?.localPool || null,
      localIdx: typeof localIdx === 'number' ? localIdx : (prev?.localIdx || 0),
    });
  }

  function showInstantLocal(ctx, sessionId, model, s) {
    if (!ctx) return '';
    const sigKey = makeSigKey(sessionId, ctx.sig, model);
    if (dismissedSigs.has(sigKey)) return sigKey;
    const existing = cacheBySig.get(sigKey);
    if (existing?.text) {
      lastSig = sigKey;
      seen = existing.source === 'model' ? [...existing.seen] : [];
      renderGhost(existing.text, sigKey);
      return sigKey;
    }
    const pool = buildLocalSuggestions({ user: ctx.user, assistant: ctx.assistant, zh: isZhUi(s) });
    const first = pool[0] || '';
    if (!first) return sigKey;
    lastSig = sigKey;
    seen = [];
    saveSuggestion(sigKey, first, [first], { source: 'local', localPool: pool, localIdx: 0 });
    renderGhost(first, sigKey);
    return sigKey;
  }

  function cycleLocalFallback(sigKey, ctx, s) {
    const prev = cacheBySig.get(sigKey);
    const pool = prev?.localPool?.length
      ? prev.localPool
      : buildLocalSuggestions({ user: ctx?.user || '', assistant: ctx?.assistant || '', zh: isZhUi(s) });
    if (!pool.length) return false;
    const nextIdx = prev ? ((prev.localIdx ?? 0) + 1) % pool.length : 0;
    const nextText = pool[nextIdx];
    saveSuggestion(sigKey, nextText, [nextText], { source: 'local', localPool: pool, localIdx: nextIdx });
    lastSig = sigKey;
    renderGhost(nextText, sigKey);
    return true;
  }

  async function fetchSuggestionText({ user, assistant, zh, model, exclude = [] }) {
    const res = await fetch('/api/dsh-obsidian-prism/prompt-suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user,
        assistant,
        zh,
        ...(model ? { model } : {}),
        ...(exclude.length ? { exclude } : {}),
      }),
    });
    const j = await res.json();
    const next = typeof j?.text === 'string' ? j.text.trim() : '';
    return j?.ok && next ? next : '';
  }

  async function request({ force = false, silent = false } = {}) {
    const s = getSettings();
    const mainConv = resolveMainConversation(document);
    const ctx = collectTurnContext(mainConv || document);
    if (!ctx) return;
    const sessionId = mainConv?.getAttribute?.('data-conversation-session') || '';
    const model = s.promptSuggestModel || '';
    const sigKey = makeSigKey(sessionId, ctx.sig, model);
    if (!force && dismissedSigs.has(sigKey)) return;

    if (isLocalOnlyModel(model)) {
      if (force) cycleLocalFallback(sigKey, ctx, s);
      else showInstantLocal(ctx, sessionId, model, s);
      return;
    }

    const existing = cacheBySig.get(sigKey);
    if (!force && !silent) {
      if (existing?.source === 'model' && existing.text) {
        lastSig = sigKey;
        seen = [...existing.seen];
        renderGhost(existing.text, sigKey);
        return;
      }
      if (sigKey === lastSig && inflightSigs.has(sigKey)) return;
    }

    if (sigKey !== lastSig) {
      lastSig = sigKey;
      seen = existing?.source === 'model' && existing.seen ? [...existing.seen] : [];
    } else if (existing?.source !== 'model' && !seen.length) {
      seen = [];
    }

    const seq = ++reqSeq;
    const exclude = force ? [...seen] : [];
    inflightSigs.add(sigKey);
    if (force && suggestion && !silent) {
      loadingNext = true;
      renderGhost(suggestion, sigKey);
    }
    try {
      const next = await fetchSuggestionText({
        user: ctx.user,
        assistant: ctx.assistant,
        zh: isZhUi(s),
        model,
        exclude,
      });
      inflightSigs.delete(sigKey);
      if (seq !== reqSeq || !enabled() || isStreaming) return;
      loadingNext = false;
      if (next) {
        if (!seen.includes(next)) seen = [...seen.slice(-4), next];
        saveSuggestion(sigKey, next, seen, { source: 'model' });
        if (!dismissedSigs.has(sigKey)) {
          renderGhost(next, sigKey);
        }
      } else {
        if (existing?.source !== 'model') addBoundedSet(failedSigs, sigKey);
        if (force) {
          cycleLocalFallback(sigKey, ctx, s);
        } else if (suggestion && !silent && !dismissedSigs.has(sigKey)) {
          renderGhost(suggestion, sigKey);
        }
      }
    } catch {
      inflightSigs.delete(sigKey);
      if (existing?.source !== 'model') addBoundedSet(failedSigs, sigKey);
      if (seq === reqSeq) {
        loadingNext = false;
        if (force) {
          cycleLocalFallback(sigKey, ctx, s);
        } else if (suggestion && !silent && !dismissedSigs.has(sigKey)) {
          renderGhost(suggestion, sigKey);
        }
      }
    }
  }

  function pollStreamPrefetch() {
    if (!isStreaming || !enabled() || prefetchCount >= PREFETCH_MAX_PER_TURN) return;
    const s = getSettings();
    const model = s.promptSuggestModel || '';
    if (isLocalOnlyModel(model)) return;

    const mainConv = resolveMainConversation(document);
    const live = collectStreamingContext(mainConv || document);
    if (!live || live.assistant.length < PREFETCH_MIN_CHARS) return;

    const sessionId = mainConv?.getAttribute?.('data-conversation-session') || '';
    const now = Date.now();
    if (prefetched) {
      if (prefetched.inflight) return;
      if (live.assistant.length - prefetched.assistantLen < PREFETCH_REDO_DELTA) return;
      if (now - lastPrefetchAt < PREFETCH_REDO_COOLDOWN_MS) return;
    }

    prefetchCount += 1;
    lastPrefetchAt = now;
    const seq = ++reqSeq;
    const entry = {
      seq,
      sessionId,
      model,
      turn: live.sig,
      assistantLen: live.assistant.length,
      text: prefetched?.text || '',
      inflight: true,
      showOnResolve: false,
    };
    prefetched = entry;

    fetchSuggestionText({
      user: live.user,
      assistant: live.assistant,
      zh: isZhUi(s),
      model,
    })
      .then((next) => {
        if (entry.seq !== reqSeq) return;
        entry.inflight = false;
        if (next) entry.text = next;
        const sigKey = makeSigKey(entry.sessionId, entry.turn, entry.model);
        if (entry.text) {
          saveSuggestion(sigKey, entry.text, [entry.text], { source: 'model' });
        }
        if (entry.showOnResolve && !isStreaming && enabled()) {
          if (entry.text && !dismissedSigs.has(sigKey)) {
            seen = [entry.text];
            lastSig = sigKey;
            renderGhost(entry.text, sigKey);
          } else if (!entry.text) {
            request({ force: false, silent: true });
          }
        }
      })
      .catch(() => {
        if (entry.seq !== reqSeq) return;
        entry.inflight = false;
        if (entry.showOnResolve && !isStreaming && enabled()) {
          request({ force: false, silent: true });
        }
      });
  }

  function sync() {
    clearSyncTimer();
    if (!enabled()) {
      hide();
      return;
    }
    if (isStreaming || isComposing || isDocumentStreaming()) return;

    const mainConv = resolveMainConversation(document);
    const input = findMainComposerInput(document);
    if (!input) {
      if (suggestion) hide();
      return;
    }
    if (!composerIsEmpty(input)) {
      if (suggestion) hide();
      return;
    }
    const ctx = collectTurnContext(mainConv || document);
    if (!ctx) {
      if (suggestion) hide();
      return;
    }

    const s = getSettings();
    const sessionId = mainConv?.getAttribute?.('data-conversation-session') || '';
    const model = s.promptSuggestModel || '';
    const sigKey = makeSigKey(sessionId, ctx.sig, model);

    if (dismissedSigs.has(sigKey)) {
      if (suggestion) hide();
      return;
    }

    const cached = cacheBySig.get(sigKey);
    if (cached?.text) {
      const host = input.parentElement;
      const ghost = document.getElementById?.(GHOST_ID);
      const alreadyRendered = Boolean(
        ghost &&
        host &&
        ghost.parentElement === host &&
        host.getAttribute?.(GHOST_HOST_ATTR) === '1' &&
        currentSig === sigKey &&
        suggestion === cached.text &&
        !loadingNext
      );
      if (!alreadyRendered) {
        lastSig = sigKey;
        seen = cached.source === 'model' ? [...cached.seen] : [];
        renderGhost(cached.text, sigKey);
      }
      // If only local placeholder is cached in hybrid mode, upgrade once in background
      if (cached.source !== 'model' && !isLocalOnlyModel(model) && !inflightSigs.has(sigKey) && !failedSigs.has(sigKey)) {
        request({ silent: true });
      }
      return;
    }

    // Active session changed to a turn we have not generated yet:
    // Show instant 0ms local suggestion first, then upgrade in background if not local-only.
    if (suggestion && currentSig && currentSig !== sigKey) {
      hide();
    }
    showInstantLocal(ctx, sessionId, model, s);
    if (!isLocalOnlyModel(model) && !inflightSigs.has(sigKey) && !failedSigs.has(sigKey)) {
      request({ silent: true });
    }
  }

  function scheduleSync() {
    if (!enabled() || isStreaming || syncTimer) return;
    syncTimer = setTimeout(() => {
      syncTimer = null;
      sync();
    }, SYNC_DEBOUNCE_MS);
  }

  function cycle() {
    if (!enabled() || loadingNext) return;
    request({ force: true });
  }

  function notifyStreamingChange(streaming) {
    clearPendingTimer();
    clearSyncTimer();
    clearStreamPoll();
    if (streaming) {
      isStreaming = true;
      reqSeq += 1;
      resetPrefetch();
      hide();
      if (enabled() && !isLocalOnlyModel(getSettings()?.promptSuggestModel || '')) {
        streamPollTimer = setInterval(pollStreamPrefetch, PREFETCH_POLL_MS);
      }
      return;
    }

    isStreaming = false;
    if (!enabled()) return;

    const s = getSettings();
    const mainConv = resolveMainConversation(document);
    const sessionId = mainConv?.getAttribute?.('data-conversation-session') || '';
    const model = s.promptSuggestModel || '';

    // Pure-local mode: 0ms instant local display, zero network requests
    if (isLocalOnlyModel(model)) {
      const ctx = collectTurnContext(mainConv || document);
      if (ctx) {
        showInstantLocal(ctx, sessionId, model, s);
      } else {
        pendingTimer = setTimeout(() => {
          pendingTimer = null;
          if (enabled() && !isStreaming) sync();
        }, FINISH_SETTLE_MS);
      }
      return;
    }

    const match = prefetched && prefetched.sessionId === sessionId && prefetched.model === model ? prefetched : null;

    if (match && match.text) {
      // Instant 0ms display from speculative model prefetch
      const sigKey = makeSigKey(sessionId, match.turn, model);
      seen = [match.text];
      lastSig = sigKey;
      saveSuggestion(sigKey, match.text, seen, { source: 'model' });
      if (!dismissedSigs.has(sigKey)) {
        renderGhost(match.text, sigKey);
      }
      const prefetchedLen = match.assistantLen;
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (!enabled() || isStreaming) return;
        const latestConv = resolveMainConversation(document);
        const ctx = collectTurnContext(latestConv || document);
        if (!ctx) return;
        const latestSession = latestConv?.getAttribute?.('data-conversation-session') || '';
        const latestSig = makeSigKey(latestSession, ctx.sig, model);
        lastSig = latestSig;
        if (latestSig !== sigKey) {
          saveSuggestion(latestSig, match.text, seen, { source: 'model' });
          if (!dismissedSigs.has(latestSig)) renderGhost(match.text, latestSig);
        }
        if (ctx.assistant.length - prefetchedLen > PREFETCH_FINAL_DELTA && !dismissedSigs.has(latestSig)) {
          request({ force: true, silent: true });
        }
      }, FINISH_SETTLE_MS);
      return;
    }

    // Show local instant suggestion at 0ms while model prefetch resolves or settles
    const immediateCtx = collectTurnContext(mainConv || document);
    if (immediateCtx) {
      showInstantLocal(immediateCtx, sessionId, model, s);
    }

    if (match && match.inflight) {
      match.showOnResolve = true;
      const prefetchedLen = match.assistantLen;
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (!enabled() || isStreaming) return;
        const latestConv = resolveMainConversation(document);
        const ctx = collectTurnContext(latestConv || document);
        if (!ctx) return;
        const latestSession = latestConv?.getAttribute?.('data-conversation-session') || '';
        const latestSig = makeSigKey(latestSession, ctx.sig, model);
        lastSig = latestSig;
        if (!match.inflight && ctx.assistant.length - prefetchedLen > PREFETCH_FINAL_DELTA && !dismissedSigs.has(latestSig)) {
          request({ force: true, silent: true });
        }
      }, FINISH_SETTLE_MS);
      return;
    }

    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      if (enabled() && !isStreaming) request();
    }, FINISH_SETTLE_MS);
  }

  const TAB_YIELD_TARGET_SEL = [
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '.xterm',
    '[role="dialog"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[role="combobox"]',
    '[aria-modal="true"]',
    '.op-drawer',
    '[data-sidebar-right-session]',
    '.op-side-question',
  ].join(', ');

  const TAB_YIELD_OVERLAY_SEL =
    '[role="dialog"]:not([hidden]), [aria-modal="true"]:not([hidden]), [role="menu"]:not([hidden]), [role="listbox"]:not([hidden]), .op-drawer';

  function isTargetInComposer(input, target) {
    if (!input || !target) return false;
    if (target === input || input.contains?.(target)) return true;
    const card = input.closest?.('[data-composer-card]');
    return Boolean(card && card.contains?.(target));
  }

  function canHandleTabShortcut(input, target) {
    if (!input || !composerIsEmpty(input)) return false;
    if (isTargetInComposer(input, target)) return true;
    if (target && typeof target.closest === 'function' && target.closest(TAB_YIELD_TARGET_SEL)) {
      return false;
    }
    const active = document.activeElement;
    if (active && active !== input && !isTargetInComposer(input, active)) {
      if (typeof active.closest === 'function' && active.closest(TAB_YIELD_TARGET_SEL)) {
        return false;
      }
    }
    if (document.querySelector?.(TAB_YIELD_OVERLAY_SEL)) {
      return false;
    }
    return true;
  }

  function resolveActiveSigKey() {
    if (currentSig) return currentSig;
    const s = getSettings();
    const mainConv = resolveMainConversation(document);
    const ctx = collectTurnContext(mainConv || document);
    if (!ctx) return '';
    const sessionId = mainConv?.getAttribute?.('data-conversation-session') || '';
    const model = s.promptSuggestModel || '';
    return makeSigKey(sessionId, ctx.sig, model);
  }

  function dismissActiveTurn() {
    const sig = resolveActiveSigKey();
    if (sig) addBoundedSet(dismissedSigs, sig);
    hide({ dismiss: true });
  }

  function attach() {
    if (onKey) return;
    onKey = (ev) => {
      if (!suggestion || ev.defaultPrevented) return;
      const input = findMainComposerInput(document);
      if (ev.key === 'Escape') {
        if (input && isTargetInComposer(input, ev.target)) {
          dismissActiveTurn();
        }
        return;
      }
      if (ev.key !== 'Tab' || ev.altKey || ev.metaKey || ev.ctrlKey) return;
      if (!canHandleTabShortcut(input, ev.target)) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.shiftKey) cycle();
      else accept();
    };
    onInput = (ev) => {
      const input = findMainComposerInput(document);
      if (!input || (input !== ev.target && !input.contains?.(ev.target))) return;
      if (!composerIsEmpty(input)) {
        hide();
      } else if (!isComposing) {
        sync();
      }
    };
    onComposition = (ev) => {
      const input = findMainComposerInput(document);
      if (input && (input === ev.target || input.contains?.(ev.target))) {
        isComposing = true;
        hide();
      }
    };
    onCompositionEnd = (ev) => {
      const input = findMainComposerInput(document);
      if (!isComposing && (!input || (input !== ev.target && !input.contains?.(ev.target)))) return;
      isComposing = false;
      if (input && composerIsEmpty(input)) {
        sync();
      }
    };
    onVisibility = () => {
      if (!document.hidden) scheduleSync();
    };
    onWindowFocus = () => {
      scheduleSync();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('compositionstart', onComposition, true);
    document.addEventListener('compositionend', onCompositionEnd, true);
    document.addEventListener('visibilitychange', onVisibility);
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', onWindowFocus);
    }
    if (typeof MutationObserver !== 'undefined' && document.body) {
      mo = new MutationObserver((muts) => {
        if (!enabled() || isStreaming) return;
        for (const m of muts) {
          if (m.type === 'attributes' && m.attributeName === GHOST_HOST_ATTR) continue;
          const target = m.target;
          if (target && typeof target.closest === 'function') {
            if (target.closest('[data-op-ui="1"], [data-op-mascot-stage="1"], .op-drawer')) continue;
          }
          scheduleSync();
          break;
        }
      });
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-conversation-session', 'hidden', 'inert'],
      });
      scheduleSync();
    }
  }

  function detach() {
    clearPendingTimer();
    clearSyncTimer();
    clearStreamPoll();
    isStreaming = false;
    isComposing = false;
    resetPrefetch();
    reqSeq += 1;
    if (mo) {
      mo.disconnect();
      mo = null;
    }
    if (onKey) document.removeEventListener('keydown', onKey, true);
    if (onInput) document.removeEventListener('input', onInput, true);
    if (onComposition) document.removeEventListener('compositionstart', onComposition, true);
    if (onCompositionEnd) document.removeEventListener('compositionend', onCompositionEnd, true);
    if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
    if (onWindowFocus && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('focus', onWindowFocus);
    }
    onKey = null;
    onInput = null;
    onComposition = null;
    onCompositionEnd = null;
    onVisibility = null;
    onWindowFocus = null;
    hide();
  }

  function refresh() {
    const nextModel = getSettings()?.promptSuggestModel || '';
    const modelChanged = nextModel !== lastModel;
    if (modelChanged) {
      lastModel = nextModel;
      lastSig = '';
      seen = [];
      resetPrefetch();
      hide();
    }
    if (enabled()) {
      attach();
      if (modelChanged && document.body) scheduleSync();
    } else {
      detach();
    }
  }

  return { start: refresh, refresh, notifyStreamingChange, sync, dispose: detach };
}
