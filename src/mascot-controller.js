// Mascot stage controller: bridges Obsidian Prism's dual-mascot-rig onto DSH [data-composer-card]
import { findMainComposerCard } from './selection-ask-controller.js';

const MASCOT_SIDEBAR_EXCLUDED = '[data-sidebar-right-session], .op-explain';

function findMainConversationScope(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return doc;
  const sessions = doc.querySelectorAll('[data-conversation-session]');
  for (const el of sessions) {
    if (!el.closest?.(MASCOT_SIDEBAR_EXCLUDED) && !el.hidden && !el.closest?.('[hidden], [inert]')) {
      return el;
    }
  }
  return doc;
}

export function detectStreamingActive(doc = document) {
  if (!doc) return false;
  const scope = findMainConversationScope(doc);
  const runningSel = '[data-streaming="true"], [data-chat-running]:not([data-holding])';
  if (typeof scope.querySelectorAll === 'function') {
    for (const el of scope.querySelectorAll(runningSel)) {
      if (!el.closest?.(MASCOT_SIDEBAR_EXCLUDED) && !el.hidden && !el.closest?.('[hidden], [inert]')) {
        return true;
      }
    }
  } else if (scope.querySelector?.(runningSel)) {
    return true;
  }
  const card = scope.querySelector?.('[data-composer-card]') || findMainComposerCard(doc);
  if (card && !card.closest?.(MASCOT_SIDEBAR_EXCLUDED)) {
    if (card.querySelector('[data-sending], button[aria-busy="true"]')) {
      return true;
    }
    // Look for a visible stop / cancel streaming button inside composer card
    const stopBtn = card.querySelector(
      'button[aria-label*="Stop" i], button[aria-label*="停止"], button[title*="Stop" i], button[title*="停止"], [data-stop-button="true"]'
    );
    if (stopBtn && !stopBtn.disabled && stopBtn.offsetParent !== null) return true;
  }
  return false;
}

function resolveMascotCamp(settings) {
  if (settings.accent === 'terracotta' || settings.accent === 'amber') return 'claude';
  if (settings.accent === 'cobalt' || settings.accent === 'prism') return 'gemini';
  const eff = typeof document !== 'undefined' ? document.documentElement?.getAttribute?.('data-op-effective-theme') : null;
  const isDark = eff ? eff === 'dark' : settings.themeMode === 'dark';
  if (isDark && settings.darkPreset === 'warm') return 'claude';
  if (!isDark && settings.lightPreset === 'alabaster') return 'claude';
  return 'gemini';
}

const MASCOT_CTRL_GLOBAL_KEY = '__dshObsidianPrismMascotCtrl';
const MAX_LEAP_OFFSET_PX = 128;
const MIN_ROOF_HEADROOM_PX = 96;

const TO_BOTTOM_SELECTOR = [
  'button[class*="toBottom"]',
  '[class*="toBottomSlot"] > button',
  'button[aria-label*="回到底部"]',
  'button[aria-label*="滚动到底部"]',
  'button[aria-label*="Back to bottom" i]',
  'button[aria-label*="Scroll to bottom" i]',
].join(', ');

function readVisibleRect(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return null;
  if (el.hidden) return null;
  const r = el.getBoundingClientRect();
  if (!r || r.width <= 0 || r.height <= 0) return null;
  return r;
}

/**
 * Inspect obstacles around [data-composer-card] so mascots can:
 *  - leap onto the top roof of [data-queue-dock] / [data-testid="todo-panel"]
 *  - duck & hide ('peek') when docks expand too tall, headroom is tight, or an upward composer overlay opens
 *  - narrow their right-side patrol corridor (popoverRightWidth) when the scroll-to-bottom button is visible
 */
export function computeMascotObstacles(card, doc = document) {
  const none = { yieldMode: 'none', leapOffsetY: 0, popoverRightWidth: 0 };
  if (!card || !doc) return none;

  const cardRect = readVisibleRect(card);
  if (!cardRect || cardRect.width < 40) return none;

  // 1. Upward composer overlay (slash-command / @-mention menu / popupSelect) -> hide immediately
  const overlayAnchor = card.querySelector?.('[data-composer-overlay]');
  if (overlayAnchor && overlayAnchor.children && overlayAnchor.children.length > 0) {
    for (const child of overlayAnchor.children) {
      const cr = readVisibleRect(child);
      if (cr && cr.width > 20 && cr.height > 8) {
        return { yieldMode: 'peek', leapOffsetY: 0, popoverRightWidth: 0 };
      }
    }
  }

  // 2. Attached dock panels above composer card (QueueDock / TodoPanel)
  let yieldMode = 'none';
  let leapOffsetY = 0;

  const seat = card.closest?.('[data-composer-seat]') || card.parentElement?.parentElement || card.parentElement;
  if (seat && typeof seat.querySelectorAll === 'function') {
    const docks = seat.querySelectorAll('[data-queue-dock], [data-testid="todo-panel"]');
    let minTop = Infinity;
    for (const dock of docks) {
      if (dock === card || card.contains?.(dock)) continue;
      const visualEl = dock.firstElementChild || dock;
      const dr = readVisibleRect(visualEl) || readVisibleRect(dock);
      if (!dr || dr.width < 20 || dr.height < 6) continue;
      // Must sit above (or tucked slightly into) the top edge of the composer card
      if (dr.top < cardRect.top - 2 && dr.bottom <= cardRect.top + 18) {
        if (dr.top < minTop) minTop = dr.top;
      }
    }
    if (minTop < cardRect.top) {
      const roofOffset = Math.max(0, Math.round(cardRect.top - minTop));
      if (roofOffset > 0) {
        if (roofOffset <= MAX_LEAP_OFFSET_PX && minTop >= MIN_ROOF_HEADROOM_PX) {
          yieldMode = 'leap';
          leapOffsetY = roofOffset;
        } else {
          return { yieldMode: 'peek', leapOffsetY: 0, popoverRightWidth: 0 };
        }
      }
    }
  }

  // 3. Right-side floating "back to bottom" button -> narrow patrol corridor away from right edge
  let popoverRightWidth = 0;
  const scope = card.closest?.('[data-conversation-scroll], [data-conversation-content]') || doc;
  if (scope && typeof scope.querySelectorAll === 'function') {
    const roofTop = cardRect.top - leapOffsetY;
    const buttons = scope.querySelectorAll(TO_BOTTOM_SELECTOR);
    for (const btn of buttons) {
      if (btn.closest?.('[data-composer-card], .op-drawer, [data-op-ui="1"]')) continue;
      const br = readVisibleRect(btn);
      if (!br) continue;
      // Only avoid when vertically in the mascot's standing band above the roof
      const verticalOverlap = br.bottom > roofTop - 96 && br.top < roofTop + 24;
      if (!verticalOverlap) continue;
      // Only avoid when horizontally near or inside the right half of the composer card
      if (br.left >= cardRect.left + cardRect.width * 0.45 && br.left < cardRect.right + 16) {
        const needed = Math.max(0, Math.round(cardRect.right - br.left + 12));
        if (needed > popoverRightWidth) popoverRightWidth = needed;
      }
    }
  }

  // Keep a minimum usable patrol corridor on very narrow cards
  if (popoverRightWidth > 0) {
    const maxReserve = Math.max(0, Math.round(cardRect.width - 170));
    popoverRightWidth = Math.min(maxReserve, popoverRightWidth);
  }

  return { yieldMode, leapOffsetY, popoverRightWidth };
}

function removeAllMascotStages(exceptEl = null) {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
  try {
    const stages = document.querySelectorAll('[data-op-mascot-stage="1"], .ag-cs-dual-stage');
    for (const el of stages) {
      if (exceptEl && el === exceptEl) continue;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  } catch {
    // ignore DOM sweep error
  }
}

export function createMascotController({ getRig, getSettings, onStreamingChange }) {
  let hostCard = null;
  let observedSeat = null;
  let stageEl = null;
  let rig = null;
  let lastStreaming = false;
  let pollTimer = null;
  let mo = null;
  let ro = null;
  let syncRaf = 0;
  let disposed = false;

  const reducedMq = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function isReducedMotion() {
    return Boolean(reducedMq && reducedMq.matches);
  }

  function disconnectResizeObserver() {
    if (ro) {
      try { ro.disconnect(); } catch { /* ignore */ }
      ro = null;
    }
    observedSeat = null;
  }

  function syncResizeObserver(card) {
    if (typeof ResizeObserver === 'undefined' || !card) {
      disconnectResizeObserver();
      return;
    }
    const seat = card.closest?.('[data-composer-seat]') || card;
    if (ro && observedSeat === seat) return;
    disconnectResizeObserver();
    observedSeat = seat;
    ro = new ResizeObserver(() => {
      scheduleMount();
    });
    ro.observe(seat);
    if (seat !== card) ro.observe(card);
  }

  function unmountRig() {
    disconnectResizeObserver();
    if (rig) {
      try { rig.dispose?.(); } catch { /* ignore */ }
      rig = null;
    }
    if (stageEl && stageEl.parentNode) {
      stageEl.parentNode.removeChild(stageEl);
    }
    stageEl = null;
    hostCard = null;
    removeAllMascotStages(null);
    document.documentElement?.removeAttribute('data-op-mascot-active');
  }

  function syncStreamingState(enabled) {
    const streaming = enabled ? detectStreamingActive(document) : false;
    if (!enabled) {
      if (lastStreaming) {
        lastStreaming = false;
        onStreamingChange?.(false);
      }
      document.documentElement.removeAttribute('data-op-streaming');
      return false;
    }
    if (streaming !== lastStreaming || !document.documentElement.hasAttribute('data-op-streaming')) {
      const changed = streaming !== lastStreaming;
      lastStreaming = streaming;
      document.documentElement.setAttribute('data-op-streaming', streaming ? '1' : '0');
      if (changed) onStreamingChange?.(streaming);
    }
    return streaming;
  }

  function ensureMounted() {
    syncRaf = 0;
    if (disposed) return;
    const settings = getSettings();
    // Always keep streaming state synced even when mascots are disabled
    const streaming = syncStreamingState(Boolean(settings.enabled));

    const shouldShow = Boolean(settings.enabled && settings.mascotSpec && settings.mascotSpec !== 'off');
    if (!shouldShow) {
      unmountRig();
      return;
    }

    const rigApi = getRig();
    if (!rigApi || typeof rigApi.mountDualMascotStage !== 'function') return;

    const card = findMainComposerCard(document);
    if (!card || !card.isConnected) {
      unmountRig();
      return;
    }

    const obstacles = computeMascotObstacles(card, document);

    const nextState = {
      mascot: settings.mascotSpec,
      camp: resolveMascotCamp(settings),
      streaming,
      streamTier: streaming ? 3 : 2,
      hasError: false,
      yieldMode: obstacles.yieldMode,
      leapOffsetY: obstacles.leapOffsetY,
      popoverRightWidth: obstacles.popoverRightWidth,
      miniPileEnabled: /minis$|\+m$/.test(settings.mascotSpec),
      orchestrator: false,
      reducedMotion: isReducedMotion(),
    };

    if (hostCard !== card || !stageEl || !stageEl.isConnected || !rig) {
      unmountRig();
      hostCard = card;
      stageEl = document.createElement('div');
      stageEl.className = 'ag-cs-crab ag-cs-dual-stage';
      stageEl.setAttribute('data-op-mascot-stage', '1');
      stageEl.setAttribute('aria-hidden', 'true');
      card.appendChild(stageEl);
      document.documentElement.setAttribute('data-op-mascot-active', '1');
      syncResizeObserver(card);
      try {
        rig = rigApi.mountDualMascotStage(stageEl, nextState);
      } catch {
        unmountRig();
      }
      return;
    }

    syncResizeObserver(card);

    // Sweep any orphan/duplicate mascot stage left by hot reload or stale controllers
    removeAllMascotStages(stageEl);

    if (rig) {
      try { rig.setState?.(nextState); } catch { /* ignore */ }
    }
  }

  function scheduleMount() {
    if (disposed || syncRaf) return;
    syncRaf = requestAnimationFrame(ensureMounted);
  }

  function start() {
    if (typeof window !== 'undefined') {
      const prev = window[MASCOT_CTRL_GLOBAL_KEY];
      if (prev && prev !== api && typeof prev.dispose === 'function') {
        try { prev.dispose(); } catch { /* ignore */ }
      }
      window[MASCOT_CTRL_GLOBAL_KEY] = api;
      window.addEventListener('resize', scheduleMount, { passive: true });
    }
    ensureMounted();
    if (typeof MutationObserver !== 'undefined' && document.body) {
      mo = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.target instanceof Element && m.target.closest('[data-op-ui="1"], [data-op-mascot-stage="1"], .op-drawer')) continue;
          scheduleMount();
          break;
        }
      });
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          'data-chat-running',
          'data-holding',
          'data-streaming',
          'data-sending',
          'aria-busy',
          'hidden',
          'aria-expanded',
          'data-conversation-session',
        ],
      });
    }
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      ensureMounted();
    }, 900);
  }

  function refresh() {
    ensureMounted();
  }

  function dispose() {
    disposed = true;
    if (typeof window !== 'undefined') {
      if (window[MASCOT_CTRL_GLOBAL_KEY] === api) {
        delete window[MASCOT_CTRL_GLOBAL_KEY];
      }
      window.removeEventListener('resize', scheduleMount);
    }
    if (syncRaf) {
      cancelAnimationFrame(syncRaf);
      syncRaf = 0;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (mo) {
      mo.disconnect();
      mo = null;
    }
    unmountRig();
    document.documentElement?.removeAttribute('data-op-streaming');
  }

  const api = { start, refresh, dispose };
  return api;
}
