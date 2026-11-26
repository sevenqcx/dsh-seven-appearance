// Interactive WebGL2 ASCII Matrix Ripple & Brand Horizon Glow controller for DeepSeek Harness
// Powered by vendored Obsidian Prism ripple-core.js (GPL-3.0-only), adapted to DSH [data-phase="hero"] & [data-phase="active"]

const INTRO_MS = 1600;
const IDLE_MS = 1200;
const CONV_PROFILES = {
  // [alphaScale, nebulaLift, auraLift, auraStrength, moveThrottleMs, minSpeed, carryStep, auraRadius, prismStrength, clickDuration, clickWeight]
  subtle: [0.58, 0.38, 0.42, 0.52, 32, 340, 72, 196, 0.6, 0.28, 0.72],
  medium: [0.84, 0.72, 0.74, 0.8, 22, 270, 54, 215, 0.84, 0.34, 0.88],
};

const cl = (v, a, b) => Math.max(a, Math.min(b, v));

function prefersReducedMotion() {
  try {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

function isDarkEffective() {
  return document.documentElement.getAttribute('data-op-effective-theme') === 'dark';
}

function isStreamingNow() {
  return document.documentElement.getAttribute('data-op-streaming') === '1';
}

function hasActiveWallpaper(s) {
  return Boolean(s && s.wallpaperId && s.wallpaperKind && s.wallpaperKind !== 'none');
}

function resolveAmbientValue(s) {
  if (!s || !s.enabled) return 0;
  if (s.ambientGlow === 'off') return 0;
  if (s.ambientGlow === 'rich') return 1;
  return 0.65;
}

function resolveSpectrumMode(s, dark) {
  if (!s) return 'default';
  const accent = s.accent || 'follow';
  if (accent === 'cobalt') return 'cobalt';
  if (accent === 'amethyst') return 'iris';
  if (accent === 'amber') return 'amber';
  if (accent === 'terracotta') return 'warm';
  if (accent === 'follow') {
    if (dark && s.darkPreset === 'warm') return 'warm';
    if (!dark && s.lightPreset === 'alabaster') return 'warm';
  }
  return 'default';
}

function isIgnoredConvTarget(target, isPress) {
  if (!target || typeof target.closest !== 'function') return false;
  if (target.closest('.op-drawer, .op-fab, .op-outline-rail, [data-composer-card], [role="menu"], [role="dialog"]')) {
    return true;
  }
  if (isPress && target.closest('button, a, input, textarea, select, [contenteditable="true"], pre, code, [data-message-bubble]')) {
    return true;
  }
  return false;
}

export function createRippleController({ getRippleCore, getSettings }) {
  let mount = null;
  let domObserver = null;
  let syncRaf = 0;
  let disposed = false;

  function resolveTarget(s) {
    if (!s || !s.enabled) return null;
    const hero = document.querySelector('[data-phase="hero"]');
    if (hero) {
      if (!s.homeRipple) return null;
      return { mode: 'home', root: hero, convLevel: 'off' };
    }
    const convLevel = s.convRipple === 'subtle' || s.convRipple === 'medium' ? s.convRipple : 'off';
    if (convLevel === 'off') return null;
    if (prefersReducedMotion() || hasActiveWallpaper(s)) return null;
    const active = document.querySelector('[data-phase="active"]');
    if (!active) return null;
    const convHost = active.querySelector('[data-conversation-content]') || active;
    return { mode: 'conv', root: convHost, convLevel };
  }

  function sampleTokens(rippleCore, canvas, s) {
    const dark = isDarkEffective();
    const spec = resolveSpectrumMode(s, dark);
    const defaultWaveLight = spec === 'iris'
      ? [124, 58, 237]
      : spec === 'amber'
        ? [217, 119, 6]
        : spec === 'warm'
          ? [194, 89, 52]
          : [37, 99, 235];
    const fallback = {
      ink: dark ? [146, 148, 156] : [104, 114, 134],
      wave: dark ? [214, 218, 228] : defaultWaveLight,
      dark,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    };
    try {
      const cs = getComputedStyle(canvas);
      const ink = rippleCore.parseCssColorToRgb(cs.getPropertyValue('--op-ripple-ink'));
      const wave = rippleCore.parseCssColorToRgb(cs.getPropertyValue('--op-ripple-wave'));
      const mono = cs.getPropertyValue('--op-code-font')?.trim();
      if (ink) fallback.ink = ink;
      if (wave) fallback.wave = wave;
      if (mono) fallback.fontFamily = mono;
    } catch {
      // use fallback palette tokens
    }
    return fallback;
  }

  function unmount() {
    if (!mount) return;
    const m = mount;
    mount = null;
    try { m.destroy(); } catch { /* ignore cleanup error */ }
  }

  function mountHost(target) {
    const rippleCore = getRippleCore?.();
    if (!rippleCore || typeof rippleCore.createGlyphField !== 'function') return;

    const { mode, root, convLevel } = target;
    const host = document.createElement('div');
    host.className = 'op-ripple-host';
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('data-ripple-mode', mode);
    if (mode === 'conv') host.setAttribute('data-conv-level', convLevel);

    const canvas = document.createElement('canvas');
    canvas.className = 'op-ripple-canvas';

    let glowCanvas = null;
    if (mode === 'home' && typeof rippleCore.mountBrandHorizonGlow === 'function') {
      glowCanvas = document.createElement('canvas');
      glowCanvas.className = 'op-brand-glow';
      host.appendChild(glowCanvas);
    }
    host.appendChild(canvas);

    if (mode === 'conv') {
      root.setAttribute('data-op-conv-ripple-host', '1');
      root.prepend(host);
    } else {
      root.prepend(host);
    }

    let curCanvas = canvas;
    let curGlowCanvas = glowCanvas;
    let width = -1;
    let height = -1;
    let dpr = 0;
    let pw = 0;
    let ph = 0;
    let shrunk = false;
    let drawn = false;
    let force1 = true;
    let sleeping = false;
    let winBlurred = false;
    let fLost = false;
    let gLost = false;
    let recTries = 0;
    let recTimer = 0;
    let rafId = 0;
    let resizeRaf = 0;
    let wanted = false;
    let gZero = false;
    let aT = null;
    let prev = performance.now();
    let mountedAt = prev;
    let wokeFromSleep = 0;
    let auraWakeAt = 0;
    let lastSkimAt = 0;
    let lastConvMoveAt = 0;
    let lx = null;
    let ly = null;
    let carry = 0;
    let cRect = null;
    let cRectAt = 0;
    let tokens = null;
    const auraState = { x: 0, y: 0, active: false, f: 0 };

    let waves = { active: () => false, disturb() {}, advance() {}, skimmer() {} };
    let field = { mode: 'none', dispose() {}, invalidate() {}, draw() {}, needsDraw: () => false, busy: () => false };
    let glow = null;

    const hasSz = (c) => Boolean(c && c.width > 0 && c.height > 0);
    const isLost = (cv, inst) => Boolean(inst?.isContextLost?.() || (inst?.mode !== '2d' && cv?.getContext?.('webgl2')?.isContextLost?.()));
    const isHardPaused = () => Boolean(document.hidden || winBlurred || (mode === 'conv' && (isStreamingNow() || hasActiveWallpaper(getSettings()) || prefersReducedMotion())));

    function swapCanvas(oldEl, cls, beforeCanvas) {
      const next = document.createElement('canvas');
      next.className = cls;
      if (oldEl?.replaceWith) oldEl.replaceWith(next);
      else if (oldEl?.parentNode) oldEl.parentNode.replaceChild(next, oldEl);
      else if (beforeCanvas) host.insertBefore(next, curCanvas);
      else host.appendChild(next);
      return next;
    }

    function onContextLost(isField) {
      if (disposed || mount?.host !== host) return;
      if (isField) {
        fLost = true;
        curCanvas.style.display = 'none';
      } else {
        gLost = true;
        if (curGlowCanvas) curGlowCanvas.style.display = 'none';
      }
      if (recTries >= 3 || recTimer) return;
      recTimer = window.setTimeout(() => {
        recTimer = 0;
        recoverLost();
      }, 40);
    }

    function mountGlow(prefer2D, doSwap) {
      if (!curGlowCanvas || typeof rippleCore.mountBrandHorizonGlow !== 'function') return;
      if (doSwap) {
        try { glow?.dispose?.(true); } catch { /* ignore */ }
        curGlowCanvas = swapCanvas(curGlowCanvas, 'op-brand-glow', true);
      }
      const mk = (p2d) => rippleCore.mountBrandHorizonGlow(curGlowCanvas, {
        prefer2D: Boolean(p2d),
        width: 0,
        height: 0,
        onContextLost: () => onContextLost(false),
      });
      let g = mk(prefer2D);
      if (g?.mode === 'none' && !prefer2D) {
        try { g.dispose?.(true); } catch { /* ignore */ }
        curGlowCanvas = swapCanvas(curGlowCanvas, 'op-brand-glow', true);
        g = mk(true);
      }
      glow = g;
      gLost = false;
      curGlowCanvas.style.display = g?.mode === 'none' ? 'none' : '';
    }

    function setCanvasSize(cols, rows) {
      curCanvas.width = pw;
      curCanvas.height = ph;
      curCanvas.style.width = `${cols * rippleCore.RIPPLE.cellWidth}px`;
      curCanvas.style.height = `${rows * rippleCore.RIPPLE.cellHeight}px`;
    }

    function mountField(cols, rows, prefer2D, doSwap) {
      if (doSwap) curCanvas = swapCanvas(curCanvas, 'op-ripple-canvas', false);
      setCanvasSize(cols, rows);
      const mk = (p2d) => rippleCore.createGlyphField(curCanvas, cols, rows, waves, {
        prefer2D: Boolean(p2d),
        onContextLost: () => onContextLost(true),
      });
      let f = mk(prefer2D);
      if (cols > 0 && rows > 0 && f?.mode === 'none' && !prefer2D) {
        try { f.dispose?.(true); } catch { /* ignore */ }
        curCanvas = swapCanvas(curCanvas, 'op-ripple-canvas', false);
        setCanvasSize(cols, rows);
        f = mk(true);
      }
      fLost = false;
      curCanvas.style.display = cols > 0 && rows > 0 && f?.mode === 'none' ? 'none' : '';
      return f;
    }

    function syncGlowSize(w, h) {
      if (!curGlowCanvas || w <= 0 || h <= 0) return;
      if (gLost || isLost(curGlowCanvas, glow)) mountGlow(recTries >= 2, true);
      if (!curGlowCanvas || glow?.mode === 'none') return;
      glow?.resize?.(w, h, 0.6);
      if (!curGlowCanvas.width || !curGlowCanvas.height) {
        curGlowCanvas.width = Math.max(1, Math.round(w * 0.6));
        curGlowCanvas.height = Math.max(1, Math.round(h * 0.6));
      }
    }

    function updateCalmZones() {
      if (mode !== 'home' || !field?.setCalmZones) return;
      const c = curCanvas.getBoundingClientRect();
      cRect = c;
      cRectAt = performance.now();
      if (!c.width || !c.height) return;
      const zones = [];
      const mark = root.querySelector('[data-slot="conversation.hero.brand.mark"]');
      const headline = (mark && (mark.closest('[class*="headline"]') || mark.parentElement?.parentElement))
        || root.querySelector('[data-composer-seat] [class*="headline"]')
        || root.querySelector('[data-composer-seat] svg')?.closest('div')
        || root.querySelector('h1, h2');
      if (headline) {
        const b = headline.getBoundingClientRect();
        if (b.width > 0 && b.height > 0) {
          zones.push({
            x: b.left - c.left - 40,
            y: b.top - c.top - 24,
            w: b.width + 80,
            h: b.height + 48,
            alpha: 0.04,
            feather: 46,
          });
        }
      }
      field.setCalmZones(zones);
    }

    function enterIdleSleep() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      wanted = false;
      wokeFromSleep = 1;
      sleeping = true;
      host.setAttribute('data-ripple-sleep', '1');
    }

    function reclaim() {
      enterIdleSleep();
      if (shrunk && !hasSz(curCanvas) && !hasSz(curGlowCanvas)) return;
      try { glow?.releaseBackingStore?.(); } catch { /* ignore */ }
      curCanvas.width = 0;
      curCanvas.height = 0;
      if (curGlowCanvas) {
        curGlowCanvas.width = 0;
        curGlowCanvas.height = 0;
      }
      shrunk = true;
      force1 = true;
      drawn = false;
    }

    function layout() {
      if (document.hidden) return reclaim();
      const w = Math.max(0, Number(root.clientWidth) || 0);
      const h = Math.max(0, Number(root.clientHeight) || 0);
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      const lostF = fLost || isLost(curCanvas, field);

      if (w === width && h === height && nextDpr === dpr && !lostF) {
        cRect = null;
        if (shrunk || gLost || isLost(curGlowCanvas, glow) || (pw > 0 && ph > 0 && (!hasSz(curCanvas) || (curGlowCanvas && !hasSz(curGlowCanvas))))) {
          shrunk = false;
          drawn = false;
          force1 = true;
          curCanvas.width = pw;
          curCanvas.height = ph;
          syncGlowSize(w, h);
          field?.invalidate?.();
          glow?.invalidate?.();
        }
        return;
      }

      const cw = rippleCore.RIPPLE.cellWidth;
      const ch = rippleCore.RIPPLE.cellHeight;
      const cols = Math.ceil(w / cw);
      const rows = Math.ceil(h / ch);
      const was2d = field?.mode === '2d';
      width = w;
      height = h;
      dpr = nextDpr;
      pw = Math.round(cols * cw * dpr);
      ph = Math.round(rows * ch * dpr);
      shrunk = false;
      drawn = false;
      force1 = true;
      try { field.dispose(true); } catch { /* ignore */ }
      syncGlowSize(w, h);
      waves = rippleCore.createWaveField(cols, rows);
      field = mountField(cols, rows, was2d && !lostF, lostF);
      tokens = sampleTokens(rippleCore, curCanvas, getSettings());
      cRect = null;
      updateCalmZones();
    }

    function recoverLost() {
      if (disposed || (!fLost && !gLost)) return;
      if (document.hidden) return reclaim();
      const needField = fLost;
      const needGlow = gLost;
      fLost = false;
      gLost = false;
      const prefer2D = ++recTries >= 2;
      if (needField && width > 0 && height > 0) {
        try { field.dispose(true); } catch { /* ignore */ }
        const cols = Math.ceil(width / rippleCore.RIPPLE.cellWidth);
        const rows = Math.ceil(height / rippleCore.RIPPLE.cellHeight);
        field = mountField(cols, rows, prefer2D, true);
        tokens = sampleTokens(rippleCore, curCanvas, getSettings());
        cRect = null;
        updateCalmZones();
      }
      if (needGlow && curGlowCanvas && mode === 'home') {
        mountGlow(prefer2D, true);
        if (width > 0 && height > 0 && glow?.mode !== 'none') glow?.resize?.(width, height, 0.6);
      }
      force1 = true;
      drawn = false;
      field?.invalidate?.();
      glow?.invalidate?.();
      wake();
    }

    function buildPalette(s, now, amb) {
      const tok = tokens || sampleTokens(rippleCore, curCanvas, s);
      const sp = resolveSpectrumMode(s, tok.dark);
      const isConv = mode === 'conv';
      const cp = isConv ? CONV_PROFILES[convLevel] || CONV_PROFILES.subtle : null;
      const radius = cp ? cp[7] : 230;
      const fd = auraState.f ?? 1;
      const reduced = prefersReducedMotion();
      const auraOn = Boolean(auraState.active && fd > 0.005 && !reduced && amb > 0.001);
      return {
        ink: tok.ink,
        wave: tok.wave,
        dark: tok.dark,
        fontFamily: tok.fontFamily,
        conv: isConv,
        alphaScale: cp ? (amb <= 0.001 ? 0 : cp[0]) : 1,
        nebulaLiftScale: cp ? cp[1] : 1,
        auraLiftScale: cp ? cp[2] : 1,
        prismStrength: amb * (cp ? cp[8] : 1),
        ambientIntensity: amb,
        spectrum: sp,
        nebula: amb <= 0.001 ? false : undefined,
        aura: auraOn
          ? { x: auraState.x, y: auraState.y, radius, strength: amb * (cp ? cp[3] : 1) * fd, active: true }
          : { x: 0, y: 0, radius, strength: 0, active: false },
        auraPhase: (now || 0) * (cp ? 0.00045 + 0.00015 * cp[3] : 0.0006),
      };
    }

    function drawFrame(now) {
      rafId = 0;
      wanted = false;
      if (disposed || mount?.host !== host) return;
      if (document.hidden) return reclaim();

      const s = getSettings();
      const streaming = mode === 'conv' && isStreamingNow();
      if (streaming) auraState.active = false;
      const still = prefersReducedMotion() || streaming;
      const dtMs = still ? 0 : wokeFromSleep ? Math.min(16, Math.max(0, now - prev)) : cl(now - prev, 0, 50);
      aT = aT === null ? now : aT + dtMs;
      wokeFromSleep = 0;
      waves.advance(still ? 0 : cl(dtMs / 1000, 0, 0.05));
      prev = now;

      // When ripple is explicitly enabled (home or conv), keep a subtle floor even if ambientGlow === 'off'
      // so toggling ripple on always yields clear optical feedback while 'subtle'/'rich' scale intensity up.
      const baseAmb = resolveAmbientValue(s);
      const amb = baseAmb > 0 ? baseAmb : 0.45;
      if (amb <= 0.001 && auraState.active) auraState.active = false;

      let auraSettled = false;
      if (!streaming && amb > 0.001 && auraState.active && lastSkimAt > 0) {
        const age = Math.max(0, now - lastSkimAt);
        if (age >= IDLE_MS) {
          auraState.active = false;
          auraState.f = 0;
          auraSettled = true;
        } else {
          const u = age <= 750 ? 1 : (IDLE_MS - age) / 450;
          const ramp = auraWakeAt && now - auraWakeAt < 180 ? cl((now - auraWakeAt) / 180, 0.12, 1) : 1;
          auraState.f = u * u * (3 - 2 * u) * ramp;
        }
      }

      const auraRecent = !streaming && amb > 0.001 && auraState.active && lastSkimAt > 0 && now - lastSkimAt < IDLE_MS;
      const inIntro = mode === 'home' && !still && amb > 0.001 && now - mountedAt < INTRO_MS;
      const busy = !streaming && Boolean(field?.busy?.());
      const needDraw = force1 || !drawn || auraSettled || (Boolean(curGlowCanvas) && amb <= 0.001 && !gZero) || inIntro || auraRecent || (!streaming && Boolean(field?.needsDraw?.(aT, still)));

      if (hasSz(curCanvas) && needDraw) {
        force1 = false;
        if (!tokens) tokens = sampleTokens(rippleCore, curCanvas, s);
        const pal = buildPalette(s, aT, amb);
        if (hasSz(curGlowCanvas)) {
          if (amb <= 0.001) {
            if (!gZero) {
              glow?.clear?.();
              gZero = true;
            }
          } else {
            gZero = false;
            glow?.draw?.(aT, {
              dark: pal.dark,
              still,
              strength: 1,
              reach: 0.47,
              ambientIntensity: amb,
              spectrum: pal.spectrum,
            });
          }
        }
        field.draw(aT, pal, still);
        drawn = true;
      }

      if (disposed || isHardPaused() || still || !(busy || inIntro || auraRecent)) {
        enterIdleSleep();
      } else {
        wake();
      }
    }

    function wake() {
      if (disposed || wanted) return;
      if (document.hidden) return reclaim();
      if (shrunk) layout();
      sleeping = false;
      host.removeAttribute('data-ripple-sleep');
      if (isHardPaused()) {
        if ((!drawn || force1) && hasSz(curCanvas)) drawFrame(performance.now());
        return enterIdleSleep();
      }
      wanted = true;
      rafId = requestAnimationFrame(drawFrame);
    }

    function onPointerMove(ev) {
      if (prefersReducedMotion() || isHardPaused()) return;
      const isConv = mode === 'conv';
      const cp = isConv ? CONV_PROFILES[convLevel] || CONV_PROFILES.subtle : null;
      const now = performance.now();
      if (isConv) {
        if ((lastConvMoveAt > 0 && now - lastConvMoveAt < cp[4]) || isIgnoredConvTarget(ev.target, false)) return;
        lastConvMoveAt = now;
      }
      if (!cRect || now - cRectAt > 1500) {
        cRect = curCanvas.getBoundingClientRect();
        cRectAt = now;
      }
      const x = ev.clientX - cRect.left;
      const y = ev.clientY - cRect.top;
      if (x < 0 || y < 0 || x > cRect.width || y > cRect.height) {
        lx = ly = null;
        carry = 0;
        if (auraState.active) {
          auraState.active = false;
          force1 = true;
          if (field?.mode !== 'webgl2') field?.invalidate?.();
          wake();
        }
        return;
      }
      if (lx !== null && ly !== null) {
        const dist = Math.hypot(x - lx, y - ly);
        const spd = dist / Math.max(0.004, (now - lastSkimAt) / 1000);
        const minSpd = cp ? cp[5] : 220;
        const carryStep = cp ? cp[6] : 42;
        if (spd >= minSpd) {
          carry += dist;
          if (carry >= carryStep) {
            carry = Math.min(20, carry - carryStep);
            waves.skimmer?.(
              Math.floor(x / rippleCore.RIPPLE.cellWidth),
              Math.floor(y / rippleCore.RIPPLE.cellHeight),
              cl((spd - minSpd) / 1800, 0.05, 1) * (cp ? cp[3] : 1),
            );
          }
        }
      }
      lx = x;
      ly = y;
      if (!auraState.active) auraWakeAt = now;
      auraState.x = x;
      auraState.y = y;
      auraState.active = true;
      lastSkimAt = now;
      if (sleeping) prev = now;
      if (field?.mode !== 'webgl2') field?.invalidate?.();
      wake();
    }

    function onPointerLeave() {
      lx = ly = null;
      carry = 0;
    }

    function onPointerDown(ev) {
      if (prefersReducedMotion() || isHardPaused()) return;
      const isConv = mode === 'conv';
      if (isConv && isIgnoredConvTarget(ev.target, true)) return;
      const cp = isConv ? CONV_PROFILES[convLevel] || CONV_PROFILES.subtle : null;
      const r = curCanvas.getBoundingClientRect();
      cRect = r;
      cRectAt = performance.now();
      if (sleeping) prev = cRectAt;
      waves.disturb(
        Math.floor((ev.clientX - r.left) / rippleCore.RIPPLE.cellWidth),
        Math.floor((ev.clientY - r.top) / rippleCore.RIPPLE.cellHeight),
        cp ? { amplitudeScale: cp[3], radiusScale: 0.72 + 0.28 * cp[3], duration: cp[9], loadWeight: cp[10] } : undefined,
      );
      field?.invalidate?.();
      wake();
    }

    function onVisibility() {
      if (document.hidden) return reclaim();
      const wasShrunk = shrunk;
      if (wasShrunk || !hasSz(curCanvas)) layout();
      if (!isHardPaused()) {
        prev = performance.now();
        force1 = true;
        wasShrunk && hasSz(curCanvas) ? drawFrame(prev) : wake();
      } else {
        enterIdleSleep();
      }
    }

    function onBlur() {
      winBlurred = true;
      enterIdleSleep();
    }

    function onFocus() {
      winBlurred = false;
      onVisibility();
    }

    if (mode === 'home') mountGlow(false, false);

    root.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerleave', onPointerLeave, { passive: true });
    root.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    const ro = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => {
          resizeRaf = 0;
          if (!disposed && mount?.host === host) {
            layout();
            wake();
          }
        });
      })
      : null;
    ro?.observe(root);

    layout();
    wake();

    mount = {
      mode,
      root,
      convLevel,
      host,
      refreshTheme() {
        tokens = sampleTokens(rippleCore, curCanvas, getSettings());
        updateCalmZones();
        force1 = true;
        field?.invalidate?.();
        glow?.invalidate?.();
        document.hidden ? reclaim() : wake();
      },
      refreshCalmZones() {
        updateCalmZones();
        force1 = true;
        field?.invalidate?.();
        if (!document.hidden) wake();
      },
      destroy() {
        if (rafId) cancelAnimationFrame(rafId);
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        if (recTimer) clearTimeout(recTimer);
        ro?.disconnect();
        root.removeEventListener('pointermove', onPointerMove);
        root.removeEventListener('pointerleave', onPointerLeave);
        root.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('focus', onFocus);
        try { field?.dispose?.(); } catch { /* ignore */ }
        try { glow?.dispose?.(); } catch { /* ignore */ }
        if (mode === 'conv') root.removeAttribute('data-op-conv-ripple-host');
        if (host.parentNode) host.parentNode.removeChild(host);
      },
    };
  }

  function syncNow() {
    syncRaf = 0;
    if (disposed) return;
    const s = getSettings();
    const target = resolveTarget(s);
    if (!target) {
      unmount();
      return;
    }
    if (
      mount &&
      mount.root === target.root &&
      mount.mode === target.mode &&
      mount.convLevel === target.convLevel &&
      mount.host.isConnected
    ) {
      mount.refreshTheme();
      return;
    }
    unmount();
    mountHost(target);
  }

  function scheduleSync() {
    if (disposed || syncRaf) return;
    syncRaf = requestAnimationFrame(syncNow);
  }

  function start() {
    syncNow();
    if (typeof MutationObserver !== 'undefined') {
      domObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes' && m.attributeName === 'data-phase') {
            scheduleSync();
            return;
          }
          if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
            if (!mount || !mount.root.isConnected || !mount.host.isConnected || document.querySelector('[data-phase="hero"]') !== (mount.mode === 'home' ? mount.root : null)) {
              scheduleSync();
              return;
            }
            if (mount.mode === 'home' && mount.root.contains(m.target)) {
              mount.refreshCalmZones?.();
              return;
            }
          }
        }
      });
      domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-phase'],
      });
    }
  }

  function refresh() {
    scheduleSync();
  }

  function refreshTheme() {
    if (mount) mount.refreshTheme();
    else scheduleSync();
  }

  function dispose() {
    disposed = true;
    if (syncRaf) {
      cancelAnimationFrame(syncRaf);
      syncRaf = 0;
    }
    if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
    unmount();
  }

  return { start, refresh, refreshTheme, dispose };
}
