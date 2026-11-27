// Zero-idle-cost GPU 2D Canvas Prism Rim for DSH [data-composer-card]
import { findMainComposerCard } from './selection-ask-controller.js';

const PRISM_RIM_PALETTES = {
  obsidian: {
    dark: ['#E0F2FE', '#669DF6', '#9B72CB', '#5EEAD4'],
    light: ['#1D4ED8', '#2563EB', '#7C3AED', '#0EA5E9'],
  },
  warm: {
    dark: ['#FFF3E4', '#F6BD60', '#E59472', '#D97757'],
    light: ['#9A3412', '#C25934', '#D97757', '#D97706'],
  },
  prism: {
    dark: ['#FFFFFF', '#669DF6', '#A78BFA', '#F472B6', '#FBBF24'],
    light: ['#2563EB', '#7C3AED', '#DB2777', '#D97706'],
  },
  cobalt: {
    dark: ['#F0F9FF', '#7CE2FF', '#669DF6', '#3B82F6'],
    light: ['#1D4ED8', '#2563EB', '#0284C7', '#38BDF8'],
  },
  terracotta: {
    dark: ['#FFF7ED', '#FBBF77', '#E59472', '#C96E4B'],
    light: ['#9A3412', '#C25934', '#EA580C', '#D97706'],
  },
  emerald: {
    dark: ['#ECFDF5', '#6EE7B7', '#34D399', '#10B981'],
    light: ['#065F46', '#059669', '#10B981', '#0D9488'],
  },
  amethyst: {
    dark: ['#F5F3FF', '#DDD6FE', '#A78BFA', '#7C3AED'],
    light: ['#5B21B6', '#7C3AED', '#9333EA', '#C084FC'],
  },
  amber: {
    dark: ['#FFFBEB', '#FDE68A', '#FBBF24', '#D97706'],
    light: ['#92400E', '#B45309', '#D97706', '#F59E0B'],
  },
  rose: {
    dark: ['#FFF1F2', '#FECDD3', '#FB7185', '#E11D48'],
    light: ['#9F1239', '#E11D48', '#F43F5E', '#FB7185'],
  },
};

const PRISM_RIM_OUTSET = 1.5;

export function computePrismRimLayout(cs, rimWidth = 1.75) {
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const bt = num(cs?.borderTopWidth);
  const br = num(cs?.borderRightWidth);
  const bb = num(cs?.borderBottomWidth);
  const bl = num(cs?.borderLeftWidth);
  const out = PRISM_RIM_OUTSET;
  const corner = (raw) => {
    const r = num(raw);
    return r > 0 ? `${r + out}px` : '0px';
  };
  return {
    outset: out,
    top: `${-(bt + out)}px`,
    right: `${-(br + out)}px`,
    bottom: `${-(bb + out)}px`,
    left: `${-(bl + out)}px`,
    padding: `${rimWidth}px`,
    borderTopLeftRadius: corner(cs?.borderTopLeftRadius),
    borderTopRightRadius: corner(cs?.borderTopRightRadius),
    borderBottomRightRadius: corner(cs?.borderBottomRightRadius),
    borderBottomLeftRadius: corner(cs?.borderBottomLeftRadius),
    cornerShape: typeof cs?.cornerShape === 'string' && cs.cornerShape ? cs.cornerShape : '',
  };
}

export function createPrismRimController({ getSettings }) {
  let hostCard = null;
  let shell = null;
  let canvas = null;
  let ctx = null;
  let rafId = 0;
  let mo = null;
  let ro = null;
  let disposed = false;

  const pointer = { x: -9999, y: -9999, inside: false, lastMoveAt: 0 };
  const smooth = { x: 0, y: 0, strength: 0 };
  let orbitAngle = 0;
  let completeFlashUntil = 0;
  let lastStreaming = false;
  let lastLayoutKey = '';

  const reducedMq = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function isRimActive() {
    const s = getSettings();
    if (!s.enabled || !s.prismRimEnabled || s.ambientGlow === 'off') return false;
    if (reducedMq && reducedMq.matches) return false;
    return true;
  }

  function resolvePaletteColors(s) {
    const eff = document.documentElement.getAttribute('data-op-effective-theme') || 'dark';
    const isDark = eff === 'dark';
    let key = s.accent && s.accent !== 'follow' ? s.accent : null;
    if (!key) {
      if (isDark) key = s.darkPreset === 'warm' ? 'warm' : 'obsidian';
      else key = s.lightPreset === 'alabaster' ? 'warm' : 'obsidian';
    }
    const entry = PRISM_RIM_PALETTES[key] || PRISM_RIM_PALETTES.obsidian;
    return { colors: isDark ? entry.dark : entry.light, isDark };
  }

  function unmount() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (ro) {
      ro.disconnect();
      ro = null;
    }
    if (shell && shell.parentNode) shell.parentNode.removeChild(shell);
    else if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    shell = null;
    canvas = null;
    ctx = null;
    hostCard = null;
    lastLayoutKey = '';
  }

  function syncShellGeometry(cs, rimWidth) {
    if (!shell || !cs) return;
    const layout = computePrismRimLayout(cs, rimWidth);
    const key = [
      layout.top, layout.right, layout.bottom, layout.left,
      layout.padding,
      layout.borderTopLeftRadius, layout.borderTopRightRadius,
      layout.borderBottomRightRadius, layout.borderBottomLeftRadius,
      layout.cornerShape,
    ].join('|');
    if (key === lastLayoutKey) return;
    lastLayoutKey = key;
    shell.style.top = layout.top;
    shell.style.right = layout.right;
    shell.style.bottom = layout.bottom;
    shell.style.left = layout.left;
    shell.style.padding = layout.padding;
    shell.style.borderTopLeftRadius = layout.borderTopLeftRadius;
    shell.style.borderTopRightRadius = layout.borderTopRightRadius;
    shell.style.borderBottomRightRadius = layout.borderBottomRightRadius;
    shell.style.borderBottomLeftRadius = layout.borderBottomLeftRadius;
    if (layout.cornerShape) {
      shell.style.cornerShape = layout.cornerShape;
    } else if (shell.style.cornerShape) {
      shell.style.cornerShape = '';
    }
  }

  function resizeCanvas() {
    if (!hostCard || !canvas) return;
    const rect = (shell && shell.getBoundingClientRect) ? shell.getBoundingClientRect() : hostCard.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, rect.width || (hostCard.getBoundingClientRect().width + PRISM_RIM_OUTSET * 2));
    const h = Math.max(1, rect.height || (hostCard.getBoundingClientRect().height + PRISM_RIM_OUTSET * 2));
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
  }

  function drawFrame(now) {
    rafId = 0;
    if (disposed || document.hidden || !isRimActive() || !hostCard || !hostCard.isConnected || !shell || !shell.isConnected || !canvas || !ctx) {
      if (ctx && canvas && canvas.width > 0) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const s = getSettings();
    const rect = hostCard.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return;

    const streaming = document.documentElement.getAttribute('data-op-streaming') === '1';
    const focused = hostCard.contains(document.activeElement);
    const flashRemaining = Math.max(0, completeFlashUntil - now);
    const flashAlpha = flashRemaining > 0 ? Math.sin((flashRemaining / 950) * Math.PI) : 0;

    const rimWidth = flashAlpha > 0.01 ? 2.4 : (streaming || s.ambientGlow === 'rich' ? 2.1 : 1.75);
    const cs = getComputedStyle(hostCard);
    syncShellGeometry(cs, rimWidth);
    resizeCanvas();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Proximity to composer card
    const localX = pointer.x - rect.left + PRISM_RIM_OUTSET;
    const localY = pointer.y - rect.top + PRISM_RIM_OUTSET;
    const nearX = Math.max(0, rect.left - pointer.x, pointer.x - rect.right);
    const nearY = Math.max(0, rect.top - pointer.y, pointer.y - rect.bottom);
    const dist = Math.hypot(nearX, nearY);
    const pointerRecent = now - pointer.lastMoveAt < 2600;
    const proximity = pointerRecent && dist < 160 ? Math.max(0, 1 - dist / 160) : 0;

    const targetStrength = Math.max(
      proximity * (s.ambientGlow === 'rich' ? 0.95 : 0.72),
      streaming ? 0.85 : 0,
      focused ? (s.ambientGlow === 'rich' ? 0.42 : 0.28) : 0,
      flashAlpha * 0.95,
    );

    smooth.strength += (targetStrength - smooth.strength) * 0.14;
    if (proximity > 0.01) {
      smooth.x += (localX - smooth.x) * 0.2;
      smooth.y += (localY - smooth.y) * 0.2;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (smooth.strength < 0.015 && !streaming && flashAlpha <= 0.01) {
      ctx.restore();
      return; // Sleep at 0fps
    }

    const { colors, isDark } = resolvePaletteColors(s);
    const richBoost = s.ambientGlow === 'rich' ? 1.2 : 0.92;

    // 1. Pointer specular prism hotspot along border (clipped cleanly by .op-prism-rim-shell CSS mask)
    if (proximity > 0.01 || smooth.strength > 0.04) {
      const gx = proximity > 0.01 ? smooth.x : w * 0.5;
      const gy = proximity > 0.01 ? smooth.y : 0;
      const spotR = Math.max(120, Math.min(260, w * 0.38));
      const rad = ctx.createRadialGradient(gx, gy, 4, gx, gy, spotR);
      rad.addColorStop(0, colors[0]);
      rad.addColorStop(0.28, colors[1]);
      rad.addColorStop(0.62, colors[2] || colors[1]);
      rad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.globalAlpha = Math.min(0.92, smooth.strength * (isDark ? 0.75 : 0.62) * richBoost);
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 2. Streaming orbital prism sweep
    if (streaming) {
      orbitAngle = (orbitAngle + 0.036) % (Math.PI * 2);
      const cx = w * 0.5 + Math.cos(orbitAngle) * (w * 0.48);
      const cy = h * 0.5 + Math.sin(orbitAngle) * (h * 0.56);
      const sweepR = Math.max(150, w * 0.42);
      const sweep = ctx.createRadialGradient(cx, cy, 4, cx, cy, sweepR);
      sweep.addColorStop(0, colors[0]);
      sweep.addColorStop(0.32, colors[1]);
      sweep.addColorStop(0.65, colors[2] || colors[1]);
      sweep.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.globalAlpha = isDark ? 0.82 : 0.68;
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 3. Completion shimmer glint
    if (flashAlpha > 0.01) {
      const progress = 1 - flashRemaining / 950;
      const gx = w * (-0.15 + progress * 1.3);
      const glint = ctx.createLinearGradient(gx - 120, 0, gx + 120, h * 0.4);
      glint.addColorStop(0, 'rgba(0, 0, 0, 0)');
      glint.addColorStop(0.5, colors[0]);
      glint.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.globalAlpha = flashAlpha * (isDark ? 0.85 : 0.72);
      ctx.fillStyle = glint;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    ctx.restore();

    const shouldKeepRunning =
      streaming ||
      flashRemaining > 0 ||
      Math.abs(targetStrength - smooth.strength) > 0.012 ||
      (proximity > 0.01 && now - pointer.lastMoveAt < 650);

    if (shouldKeepRunning) {
      rafId = requestAnimationFrame(drawFrame);
    }
  }

  function kick() {
    if (disposed || document.hidden || !isRimActive()) return;
    if (!rafId) rafId = requestAnimationFrame(drawFrame);
  }

  function ensureMounted() {
    if (disposed) return;
    if (!isRimActive()) {
      unmount();
      return;
    }
    const card = findMainComposerCard(document);
    if (!card || !card.isConnected) {
      unmount();
      return;
    }
    if (hostCard !== card || !shell || !shell.isConnected || !canvas || !canvas.isConnected) {
      unmount();
      hostCard = card;
      shell = document.createElement('div');
      shell.className = 'op-prism-rim-shell';
      shell.setAttribute('data-op-ui', '1');
      shell.setAttribute('aria-hidden', 'true');
      canvas = document.createElement('canvas');
      canvas.className = 'op-prism-rim-canvas';
      canvas.setAttribute('data-op-ui', '1');
      canvas.setAttribute('aria-hidden', 'true');
      shell.appendChild(canvas);
      card.appendChild(shell);
      ctx = canvas.getContext('2d');
      if (typeof getComputedStyle === 'function') {
        syncShellGeometry(getComputedStyle(card), 1.75);
      }
      resizeCanvas();
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          lastLayoutKey = '';
          resizeCanvas();
          kick();
        });
        ro.observe(card);
      }
      kick();
    }
  }

  function onPointerMove(ev) {
    pointer.x = ev.clientX;
    pointer.y = ev.clientY;
    pointer.lastMoveAt = performance.now();
    kick();
  }

  function onFocusChange() {
    kick();
  }

  function onVisibilityChange() {
    if (document.hidden && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!document.hidden) {
      kick();
    }
  }

  function triggerCompletionGlint() {
    if (!isRimActive()) return;
    completeFlashUntil = performance.now() + 950;
    kick();
  }

  function notifyStreamingChange(streaming) {
    const next = Boolean(streaming);
    if (lastStreaming && !next) {
      triggerCompletionGlint();
    } else if (next) {
      ensureMounted();
      kick();
    }
    lastStreaming = next;
  }

  function start() {
    ensureMounted();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('focusin', onFocusChange, true);
    document.addEventListener('focusout', onFocusChange, true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        ensureMounted();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  function refresh() {
    lastLayoutKey = '';
    ensureMounted();
    if (hostCard && shell && typeof getComputedStyle === 'function') {
      syncShellGeometry(getComputedStyle(hostCard), 1.75);
      resizeCanvas();
    }
    kick();
  }

  function dispose() {
    disposed = true;
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('focusin', onFocusChange, true);
    document.removeEventListener('focusout', onFocusChange, true);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (mo) {
      mo.disconnect();
      mo = null;
    }
    unmount();
  }

  return { start, refresh, triggerCompletionGlint, notifyStreamingChange, dispose };
}
