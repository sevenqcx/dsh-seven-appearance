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

// 助手把动作交回给用户（点按钮 / 授权 / 粘贴验证码 / 扫码 / 刷新）：这种情况建议要写「他早做完了」
export function isWaitingOnUser(text) {
  return /(需要你|请你|等你|你来点|你去点|你点一下|你粘贴|复制到剪贴板|验证码|授权页|授权后|打开.{0,6}链接后|扫码|刷新页面后)/.test(
    String(text || '').slice(-260),
  );
}

export function buildLocalSuggestions({ user = '', assistant = '', zh = true } = {}) {
  const body = String(assistant || '').trim();
  const tail = body.slice(-260);
  const full = `${String(user || '')}\n${body}`;

  const waitingOnUser = isWaitingOnUser(tail);

  if (!zh) {
    if (waitingOnUser) {
      return dedupeSuggestions([
        'Done, continue',
        'Authorized, what next',
        'Anything else for me',
        'Skip it, do the rest',
        'Did it, no change though',
      ]);
    }
    if (/(option\s*[1a]|approach\s*[1a]|which\s+(one|option|approach)|prefer\s+option|1\.\s+.+\n\s*2\.)/i.test(body)) {
      return dedupeSuggestions([
        'Go with your recommendation',
        'Option 1',
        'Option 2',
        'What is the real difference',
        'Can we try both',
        'What does the second one buy me',
      ]);
    }
    if (/(refresh|reload|test|verify|passed|built|deployed|fixed|updated|ready)/i.test(tail)) {
      return dedupeSuggestions([
        'Continue',
        'Looks fine',
        'Still broken',
        'No change after refresh',
        'Is it faster now',
        'What should I check',
      ]);
    }
    if (/(error|failed|blocked|bug|issue|root cause|exception)/i.test(tail)) {
      return dedupeSuggestions([
        'Just fix it',
        'What does that mean',
        'Why did it happen',
        'Could it break something else',
        'Will it happen again',
        'Check the same spots too',
      ]);
    }
    if (/\?\s*$/.test(tail) || /(would you like|want me to|should i|shall we|confirm)/i.test(tail)) {
      return dedupeSuggestions([
        'Do it',
        'Go with yours',
        'Hold on, one more thing',
        'Why do you suggest that',
        'How long will it take',
        'Is there another way',
      ]);
    }
    return dedupeSuggestions([
      'Continue',
      'What does that mean',
      'What does it affect',
      'How much does it cost',
      'Is there a simpler way',
      'What do other people use',
    ]);
  }

  // 中文：他的口吻，但每条换一个方向，不要都是「继续」
  if (waitingOnUser) {
    return dedupeSuggestions([
      '已经弄好了，继续',
      '授权完了，然后呢',
      '弄好了，还有别的要我做吗',
      '这一步跳过，先弄别的',
      '弄了，怎么没反应',
    ]);
  }

  const hasChoices =
    /(方案\s*[1一A]|第一种|第二种|①[\s\S]{1,120}②|哪一种|按哪种|选哪种|二选一|两种改法|两种做法)/.test(body) ||
    /(^|\n)\s*1[.、]\s*[\s\S]{4,140}\n\s*2[.、]\s*/.test(body);
  if (hasChoices) {
    return dedupeSuggestions([
      '按你推荐的来',
      '选第一个',
      '选第二个',
      '两者区别说下',
      '第二个好在哪',
      '能不能两个都试',
    ]);
  }

  const hasRefreshOrTest = /(刷新|重启|试一下|测一测|测完|验三件事|测试|验证通过|全部通过|已改好|改好了|上线|发布)/.test(tail);
  if (hasRefreshOrTest) {
    return dedupeSuggestions([
      '继续',
      '可以',
      '还是不行',
      '我试了，没问题',
      '刷新后没变化',
      '现在比以前快吗',
    ]);
  }

  const hasProblem = /(报错|失败|卡住|原因|排查|冲突|异常|没生效|不显示|消失)/.test(tail);
  if (hasProblem) {
    return dedupeSuggestions([
      '直接修掉',
      '这是什么意思',
      '为什么会这样',
      '会不会影响别的地方',
      '以后还会不会再犯',
      '同类也一起查',
    ]);
  }

  const asksConfirm = /[？?]\s*$/.test(tail) || /(要不要|是否|可以吗|需要我|你想按|你看|确认一下)/.test(tail);
  if (asksConfirm) {
    return dedupeSuggestions([
      '可以，做吧',
      '行',
      '这个先不做',
      '为什么建议这样做',
      '要多久',
      '有没有别的做法',
    ]);
  }

  if (/(计划|方案|思路|对比|结论|建议)/.test(full)) {
    return dedupeSuggestions([
      '按这个做',
      '有没有更省事的',
      '要花多少钱',
      '别人家用的是什么',
      '会不会有风险',
      '先小范围试试',
    ]);
  }

  return dedupeSuggestions([
    '继续',
    '这是什么意思',
    '对我有什么影响',
    '要花多少钱',
    '有没有更简单的办法',
    '别人是怎么做的',
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
      ? seenList.slice(-8)
      : [text];
    const pool = Array.isArray(localPool) && localPool.length ? localPool : (prev?.localPool || [text]);
    setBoundedMap(cacheBySig, sigKey, {
      text,
      seen: list,
      source,
      localPool: pool,
      localIdx: typeof localIdx === 'number' ? localIdx : (prev?.localIdx || 0),
    });
  }

  // 只有「纯本地」模式才用本地词库；配了模型就只走模型一条路，不做本地兜底再升级的两段式
  function showCachedOrLocal(ctx, sessionId, model, s) {
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
    if (!isLocalOnlyModel(model)) return sigKey;
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

  async function fetchSuggestions({ user, assistant, zh, model, exclude = [] }) {
    const res = await fetch('/api/dsh-obsidian-prism/prompt-suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user,
        assistant,
        zh,
        ...(model ? { model } : {}),
        ...(exclude.length ? { exclude } : {}),
        ...(isWaitingOnUser(assistant) ? { handoff: true } : {}),
      }),
    });
    const j = await res.json();
    const list = Array.isArray(j?.texts)
      ? j.texts.map((t) => String(t || '').trim()).filter(Boolean)
      : (typeof j?.text === 'string' && j.text.trim() ? [j.text.trim()] : []);
    return j?.ok ? list : [];
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
      else showCachedOrLocal(ctx, sessionId, model, s);
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
      const batch = await fetchSuggestions({
        user: ctx.user,
        assistant: ctx.assistant,
        zh: isZhUi(s),
        model,
        exclude,
      });
      inflightSigs.delete(sigKey);
      if (seq !== reqSeq || !enabled() || isStreaming) return;
      loadingNext = false;
      const next = batch[0] || '';
      if (next) {
        for (const item of batch) if (!seen.includes(item)) seen = [...seen.slice(-7), item];
        saveSuggestion(sigKey, next, seen, { source: 'model', localPool: batch, localIdx: 0 });
        if (!dismissedSigs.has(sigKey)) {
          renderGhost(next, sigKey);
        }
      } else {
        addBoundedSet(failedSigs, sigKey);
        if (suggestion && !silent && !dismissedSigs.has(sigKey)) {
          renderGhost(suggestion, sigKey);
        }
      }
    } catch {
      inflightSigs.delete(sigKey);
      addBoundedSet(failedSigs, sigKey);
      if (seq === reqSeq) {
        loadingNext = false;
        if (suggestion && !silent && !dismissedSigs.has(sigKey)) {
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

    fetchSuggestions({
      user: live.user,
      assistant: live.assistant,
      zh: isZhUi(s),
      model,
    })
      .then((batch) => {
        if (entry.seq !== reqSeq) return;
        entry.inflight = false;
        if (batch.length) {
          entry.batch = batch;
          entry.text = batch[0];
        }
        const sigKey = makeSigKey(entry.sessionId, entry.turn, entry.model);
        if (entry.text) {
          const batch = Array.isArray(entry.batch) && entry.batch.length ? entry.batch : [entry.text];
          saveSuggestion(sigKey, entry.text, batch, { source: 'model', localPool: batch, localIdx: 0 });
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
    showCachedOrLocal(ctx, sessionId, model, s);
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

  // Shift+Tab / ↻：先在同一批候选里瞬间切换（不发请求），换完了再去要新的一批
  function cycle() {
    if (!enabled() || loadingNext) return;
    const s = getSettings();
    const model = s.promptSuggestModel || '';
    const mainConv = resolveMainConversation(document);
    const ctx = collectTurnContext(mainConv || document);
    if (!ctx) return;
    const sessionId = mainConv?.getAttribute?.('data-conversation-session') || '';
    const sigKey = makeSigKey(sessionId, ctx.sig, model);
    const cached = cacheBySig.get(sigKey);
    const pool = Array.isArray(cached?.localPool) ? cached.localPool : [];
    const idx = cached?.localIdx ?? 0;

    if (pool.length > 1) {
      const nextIdx = idx + 1 < pool.length ? idx + 1 : -1;
      if (nextIdx >= 0) {
        const nextText = pool[nextIdx];
        saveSuggestion(sigKey, nextText, pool, {
          source: cached.source,
          localPool: pool,
          localIdx: nextIdx,
        });
        lastSig = sigKey;
        renderGhost(nextText, sigKey);
        return;
      }
      // 这批看完了：纯本地模式回到开头，配了模型就再要一批没出现过的
      if (isLocalOnlyModel(model)) {
        const wrapped = pool[0];
        saveSuggestion(sigKey, wrapped, pool, { source: 'local', localPool: pool, localIdx: 0 });
        lastSig = sigKey;
        renderGhost(wrapped, sigKey);
        return;
      }
    } else if (isLocalOnlyModel(model)) {
      cycleLocalFallback(sigKey, ctx, s);
      return;
    }
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
        showCachedOrLocal(ctx, sessionId, model, s);
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
      const batch = Array.isArray(match.batch) && match.batch.length ? match.batch : [match.text];
      seen = [...batch];
      lastSig = sigKey;
      saveSuggestion(sigKey, match.text, seen, { source: 'model', localPool: batch, localIdx: 0 });
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
      showCachedOrLocal(immediateCtx, sessionId, model, s);
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
