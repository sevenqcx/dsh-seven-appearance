// Settings store & host sync for dsh-obsidian-prism

const STORAGE_KEY = 'dsh-obsidian-prism:settings:v1';

const DARK_PRESETS = ['obsidian', 'warm'];
const LIGHT_PRESETS = ['crystal', 'alabaster'];
const THEME_MODES = ['auto', 'dark', 'light'];
const ACCENTS = ['follow', 'prism', 'cobalt', 'terracotta', 'emerald', 'amethyst', 'amber', 'rose'];
const CORNER_STYLES = ['default', 'soft', 'sharp'];
const CODE_FONTS = ['system', 'jetbrains', 'fira', 'cascadia', 'maple'];
const AMBIENT_LEVELS = ['off', 'subtle', 'rich'];
const CONV_RIPPLE_LEVELS = ['off', 'subtle', 'medium'];
const UI_LANGUAGES = ['auto', 'zh', 'en'];
const MASCOT_PRESETS = new Set([
  'off',
  'dual',
  'minis',
  'quad',
  'quad-minis',
  'r:c1',
  'r:k1',
  'r:d1',
  'r:w1',
]);

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  uiLanguage: 'auto',
  themeMode: 'auto',
  darkPreset: 'obsidian',
  lightPreset: 'crystal',
  accent: 'follow',
  cornerStyle: 'default',
  codeFont: 'system',
  ambientGlow: 'subtle',
  prismRimEnabled: true,
  homeRipple: true,
  convRipple: 'off',
  smokedFacets: true,
  streamFade: true,
  streamChoreography: true,
  smoothCaret: true,
  statusVialEnabled: false,
  effortSliderEnabled: true,
  effortSliderCrystal: true,
  mascotSpec: 'dual',
  wallpaperId: '',
  wallpaperKind: 'none',
  wallpaperOpacity: 0.24,
  wallpaperBlur: 4,
  wallpaperSurfaceGlass: true,
  selectionAskEnabled: true,
  codeFoldEnabled: true,
  codeFoldThreshold: 24,
  turnOutlineEnabled: true,
  quickTriggerVisible: true,
});

export const BACKUP_SCHEMA_ID = 'dsh-obsidian-prism-settings';

export const SCENE_PRESETS = Object.freeze({
  ultra: Object.freeze({
    ambientGlow: 'rich',
    prismRimEnabled: true,
    homeRipple: true,
    convRipple: 'subtle',
    smokedFacets: true,
    streamFade: true,
    streamChoreography: true,
    smoothCaret: true,
    statusVialEnabled: false,
    effortSliderCrystal: true,
  }),
  focus: Object.freeze({
    ambientGlow: 'subtle',
    prismRimEnabled: true,
    homeRipple: false,
    convRipple: 'off',
    smokedFacets: true,
    streamFade: true,
    streamChoreography: true,
    smoothCaret: true,
    statusVialEnabled: false,
    effortSliderCrystal: true,
    mascotSpec: 'off',
  }),
  eco: Object.freeze({
    ambientGlow: 'off',
    prismRimEnabled: false,
    homeRipple: false,
    convRipple: 'off',
    smokedFacets: true,
    streamFade: false,
    streamChoreography: false,
    smoothCaret: false,
    statusVialEnabled: false,
    effortSliderCrystal: false,
    mascotSpec: 'off',
  }),
});

export function getScenePresetPatch(presetId, currentSettings = DEFAULT_SETTINGS) {
  const base = SCENE_PRESETS[presetId];
  if (!base) return null;
  if (presetId === 'ultra') {
    const keepMascot = currentSettings && currentSettings.mascotSpec && currentSettings.mascotSpec !== 'off';
    return {
      ...base,
      mascotSpec: keepMascot ? currentSettings.mascotSpec : 'dual',
    };
  }
  return { ...base };
}

export function detectActiveScenePreset(settings) {
  if (!settings || typeof settings !== 'object') return null;
  if (
    settings.ambientGlow === 'rich' &&
    settings.prismRimEnabled === true &&
    settings.homeRipple === true &&
    settings.convRipple !== 'off' &&
    settings.smokedFacets === true &&
    settings.streamFade === true &&
    settings.streamChoreography === true &&
    settings.smoothCaret === true &&
    settings.effortSliderCrystal === true &&
    settings.mascotSpec !== 'off'
  ) {
    return 'ultra';
  }
  if (
    settings.ambientGlow === 'subtle' &&
    settings.prismRimEnabled === true &&
    settings.homeRipple === false &&
    settings.convRipple === 'off' &&
    settings.smokedFacets === true &&
    settings.streamFade === true &&
    settings.streamChoreography === true &&
    settings.smoothCaret === true &&
    settings.effortSliderCrystal === true &&
    settings.mascotSpec === 'off'
  ) {
    return 'focus';
  }
  if (
    settings.ambientGlow === 'off' &&
    settings.prismRimEnabled === false &&
    settings.homeRipple === false &&
    settings.convRipple === 'off' &&
    settings.streamFade === false &&
    settings.streamChoreography === false &&
    settings.smoothCaret === false &&
    settings.statusVialEnabled === false &&
    settings.effortSliderCrystal === false &&
    settings.mascotSpec === 'off'
  ) {
    return 'eco';
  }
  return null;
}

export function exportSettingsBackup(settings) {
  const clean = sanitizeSettings(settings);
  // Strip machine-local wallpaper file binding so backup JSON stays portable and clean
  const portable = { ...clean };
  delete portable.wallpaperId;
  delete portable.wallpaperKind;
  return JSON.stringify(
    {
      schema: BACKUP_SCHEMA_ID,
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: portable,
    },
    null,
    2,
  );
}

export function parseSettingsBackup(rawText, currentSettings = DEFAULT_SETTINGS) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return { ok: false, error: 'Empty JSON input' };
  }
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err?.message || 'parse error'}` };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Backup must be a JSON object' };
  }
  let candidate = parsed;
  if (parsed.schema === BACKUP_SCHEMA_ID) {
    if (!parsed.settings || typeof parsed.settings !== 'object' || Array.isArray(parsed.settings)) {
      return { ok: false, error: 'Backup envelope is missing a valid settings object' };
    }
    candidate = parsed.settings;
  } else if (parsed.settings && typeof parsed.settings === 'object' && !Array.isArray(parsed.settings)) {
    candidate = parsed.settings;
  }

  const knownKeys = Object.keys(DEFAULT_SETTINGS);
  const matched = knownKeys.filter((k) => Object.prototype.hasOwnProperty.call(candidate, k));
  if (matched.length === 0) {
    return { ok: false, error: 'No recognized Obsidian Prism settings keys found' };
  }

  const base = sanitizeSettings(currentSettings);
  const mergedInput = { ...DEFAULT_SETTINGS, ...candidate };
  if (!Object.prototype.hasOwnProperty.call(candidate, 'wallpaperId')) {
    mergedInput.wallpaperId = base.wallpaperId;
    mergedInput.wallpaperKind = base.wallpaperKind;
  }
  return {
    ok: true,
    settings: sanitizeSettings(mergedInput),
    matchedCount: matched.length,
  };
}

function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function isValidMascotSpec(raw) {
  if (typeof raw !== 'string') return false;
  if (MASCOT_PRESETS.has(raw)) return true;
  return /^r:(?:[ckdw][0-4](?:,[ckdw][0-4])*)?(?:\+m)?$/.test(raw);
}


export function sanitizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : d.enabled,
    uiLanguage: UI_LANGUAGES.includes(src.uiLanguage) ? src.uiLanguage : d.uiLanguage,
    themeMode: THEME_MODES.includes(src.themeMode) ? src.themeMode : d.themeMode,
    darkPreset: DARK_PRESETS.includes(src.darkPreset) ? src.darkPreset : d.darkPreset,
    lightPreset: LIGHT_PRESETS.includes(src.lightPreset) ? src.lightPreset : d.lightPreset,
    accent: ACCENTS.includes(src.accent) ? src.accent : d.accent,
    cornerStyle: CORNER_STYLES.includes(src.cornerStyle) ? src.cornerStyle : d.cornerStyle,
    codeFont: CODE_FONTS.includes(src.codeFont) ? src.codeFont : d.codeFont,
    ambientGlow: AMBIENT_LEVELS.includes(src.ambientGlow) ? src.ambientGlow : d.ambientGlow,
    prismRimEnabled: typeof src.prismRimEnabled === 'boolean' ? src.prismRimEnabled : d.prismRimEnabled,
    homeRipple: typeof src.homeRipple === 'boolean' ? src.homeRipple : d.homeRipple,
    convRipple: CONV_RIPPLE_LEVELS.includes(src.convRipple) ? src.convRipple : d.convRipple,
    smokedFacets: typeof src.smokedFacets === 'boolean' ? src.smokedFacets : d.smokedFacets,
    streamFade: typeof src.streamFade === 'boolean' ? src.streamFade : d.streamFade,
    streamChoreography: typeof src.streamChoreography === 'boolean' ? src.streamChoreography : d.streamChoreography,
    smoothCaret: typeof src.smoothCaret === 'boolean' ? src.smoothCaret : d.smoothCaret,
    statusVialEnabled: false,
    effortSliderEnabled: typeof src.effortSliderEnabled === 'boolean' ? src.effortSliderEnabled : d.effortSliderEnabled,
    effortSliderCrystal: typeof src.effortSliderCrystal === 'boolean' ? src.effortSliderCrystal : d.effortSliderCrystal,
    mascotSpec: isValidMascotSpec(src.mascotSpec) ? src.mascotSpec : d.mascotSpec,
    wallpaperId: typeof src.wallpaperId === 'string' && /^[a-zA-Z0-9._-]{0,120}$/.test(src.wallpaperId) ? src.wallpaperId : d.wallpaperId,
    wallpaperKind: ['none', 'image', 'video'].includes(src.wallpaperKind) ? src.wallpaperKind : d.wallpaperKind,
    wallpaperOpacity: Math.round(clampNum(src.wallpaperOpacity, 0.05, 0.65, d.wallpaperOpacity) * 100) / 100,
    wallpaperBlur: Math.round(clampNum(src.wallpaperBlur, 0, 24, d.wallpaperBlur)),
    wallpaperSurfaceGlass: typeof src.wallpaperSurfaceGlass === 'boolean' ? src.wallpaperSurfaceGlass : d.wallpaperSurfaceGlass,
    selectionAskEnabled: typeof src.selectionAskEnabled === 'boolean' ? src.selectionAskEnabled : d.selectionAskEnabled,
    codeFoldEnabled: typeof src.codeFoldEnabled === 'boolean' ? src.codeFoldEnabled : d.codeFoldEnabled,
    codeFoldThreshold: Math.round(clampNum(src.codeFoldThreshold, 12, 80, d.codeFoldThreshold)),
    turnOutlineEnabled: typeof src.turnOutlineEnabled === 'boolean' ? src.turnOutlineEnabled : d.turnOutlineEnabled,
    quickTriggerVisible: typeof src.quickTriggerVisible === 'boolean' ? src.quickTriggerVisible : d.quickTriggerVisible,
  };
}

export function createSettingsStore() {
  let state = { ...DEFAULT_SETTINGS };
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) state = sanitizeSettings(JSON.parse(cached));
  } catch {
    // ignore storage read error
  }

  const listeners = new Set();
  let saveTimer = null;

  function emit() {
    for (const fn of listeners) {
      try { fn(state); } catch { /* ignore listener error */ }
    }
  }

  function persistLocal(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota error
    }
  }

  function scheduleHostSave(next) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      fetch('/api/dsh-obsidian-prism/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings: next }),
      }).catch(() => {});
    }, 240);
  }

  function get() {
    return state;
  }

  function set(patch, opts = {}) {
    const merged = sanitizeSettings({ ...state, ...(typeof patch === 'function' ? patch(state) : patch) });
    if (JSON.stringify(merged) === JSON.stringify(state)) return state;
    state = merged;
    persistLocal(state);
    if (!opts.skipHostSync) scheduleHostSave(state);
    emit();
    return state;
  }

  function reset() {
    return set({ ...DEFAULT_SETTINGS });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  async function hydrateFromHost() {
    try {
      const res = await fetch('/api/dsh-obsidian-prism/settings', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (json && json.ok && json.value) {
        set(json.value, { skipHostSync: true });
      }
    } catch {
      // host endpoint unavailable; stay on localStorage
    }
  }

  function dispose() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    listeners.clear();
  }

  return {
    get,
    set,
    reset,
    subscribe,
    hydrateFromHost,
    dispose,
  };
}
