// Stream Choreography, Completion Shimmer & Smooth Collapsible Micro-interactions

export function createChoreographyController({ getSettings }) {
  let mo = null;
  let pulseTimer = null;
  let lastStreaming = false;
  let disposed = false;
  const arriveTimers = new Set();

  const reducedMq = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function isActive() {
    const s = getSettings();
    return Boolean(s.enabled && s.streamChoreography && !(reducedMq && reducedMq.matches));
  }

  function syncRootFlag() {
    document.documentElement.setAttribute('data-op-choreography', isActive() ? '1' : '0');
  }

  function tagArrival(el) {
    if (!(el instanceof Element)) return;
    if (el.closest('[data-composer-card], .op-drawer, [data-op-ui="1"], nav, aside')) return;
    if (!el.closest('[data-chat-flow], [data-conversation-region], [data-phase="active"], main')) return;
    if (el.hasAttribute('data-op-arrive')) return;

    const tag = el.tagName;
    const isBlock =
      tag === 'P' ||
      tag === 'LI' ||
      tag === 'PRE' ||
      tag === 'BLOCKQUOTE' ||
      tag === 'TABLE' ||
      el.hasAttribute('data-tool') ||
      el.hasAttribute('data-presented-file') ||
      el.hasAttribute('data-changed-files') ||
      el.getAttribute('data-chat-group-part') === 'reasoning';

    if (!isBlock) return;
    el.setAttribute('data-op-arrive', '1');
    const tid = setTimeout(() => {
      arriveTimers.delete(tid);
      if (el.isConnected) el.removeAttribute('data-op-arrive');
    }, 360);
    arriveTimers.add(tid);
  }

  function onToggle(ev) {
    if (!isActive()) return;
    const target = ev.target;
    if (!(target instanceof Element) || target.tagName !== 'DETAILS') return;
    if (target.closest('.op-drawer, [data-op-ui="1"]')) return;
    if (target.open) {
      target.setAttribute('data-op-unfold', '1');
      const tid = setTimeout(() => {
        arriveTimers.delete(tid);
        if (target.isConnected) target.removeAttribute('data-op-unfold');
      }, 280);
      arriveTimers.add(tid);
    }
  }

  function notifyStreamingChange(streaming) {
    const next = Boolean(streaming);
    if (lastStreaming && !next && isActive()) {
      document.documentElement.setAttribute('data-op-complete-pulse', '1');
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => {
        pulseTimer = null;
        document.documentElement.removeAttribute('data-op-complete-pulse');
      }, 950);
    }
    lastStreaming = next;
  }

  function start() {
    syncRootFlag();
    document.addEventListener('toggle', onToggle, true);
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver((muts) => {
        if (disposed || !isActive() || document.hidden) return;
        if (document.documentElement.getAttribute('data-op-streaming') !== '1') return;
        let tagged = 0;
        for (const m of muts) {
          if (m.type !== 'childList' || m.addedNodes.length === 0) continue;
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              tagArrival(node);
              tagged += 1;
              if (tagged >= 6) return;
            }
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  function refresh() {
    syncRootFlag();
  }

  function dispose() {
    disposed = true;
    document.removeEventListener('toggle', onToggle, true);
    if (mo) {
      mo.disconnect();
      mo = null;
    }
    if (pulseTimer) {
      clearTimeout(pulseTimer);
      pulseTimer = null;
    }
    for (const tid of arriveTimers) clearTimeout(tid);
    arriveTimers.clear();
    document.documentElement.removeAttribute('data-op-choreography');
    document.documentElement.removeAttribute('data-op-complete-pulse');
  }

  return { start, refresh, notifyStreamingChange, dispose };
}
