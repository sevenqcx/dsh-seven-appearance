import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

import {
  createHostHandlers,
  deleteWallpaper,
  getDataDirs,
  listWallpapers,
  readHostSettings,
  saveWallpaperBuffer,
  serveWallpaperMedia,
  writeHostSettings,
} from '../index.js';
import {
  BACKUP_SCHEMA_ID,
  DEFAULT_SETTINGS,
  SCENE_PRESETS,
  detectActiveScenePreset,
  exportSettingsBackup,
  getScenePresetPatch,
  parseSettingsBackup,
  sanitizeSettings,
} from '../src/settings-store.js';
import { buildStylesheet } from '../src/theme-css.js';
import { isZhUi, resolveUiLang } from '../src/i18n.js';
import { formatSelectionQuote } from '../src/selection-ask-controller.js';

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'dsh-op-test-'));
}

test('host settings read/write round-trip', async () => {
  const dir = makeTempDir();
  try {
    const dirs = getDataDirs(dir);
    assert.equal(await readHostSettings(dirs), null);

    const saved = await writeHostSettings(dirs, { darkPreset: 'warm', mascotSpec: 'quad' });
    assert.equal(saved.darkPreset, 'warm');

    const loaded = await readHostSettings(dirs);
    assert.deepEqual(loaded, { darkPreset: 'warm', mascotSpec: 'quad' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wallpaper save, list, full & Range 206 streaming, path traversal block, and delete', async () => {
  const dir = makeTempDir();
  try {
    const dirs = getDataDirs(dir);
    const payload = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
    const saved = await saveWallpaperBuffer(dirs, {
      buffer: payload,
      filename: 'nebula.mp4',
      mimeType: 'video/mp4',
    });
    assert.equal(saved.kind, 'video');
    assert.equal(saved.mime, 'video/mp4');
    assert.equal(saved.size, payload.length);

    const list = await listWallpapers(dirs);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, saved.id);

    // Full 200 response
    const fullRes = await serveWallpaperMedia(
      dirs,
      new Request(`http://localhost/api/dsh-obsidian-prism/wallpaper-media?id=${encodeURIComponent(saved.id)}`),
    );
    assert.equal(fullRes.status, 200);
    assert.equal(fullRes.headers.get('accept-ranges'), 'bytes');
    assert.equal(Buffer.from(await fullRes.arrayBuffer()).toString(), payload.toString());

    // Partial 206 Range response
    const rangeRes = await serveWallpaperMedia(
      dirs,
      new Request(`http://localhost/api/dsh-obsidian-prism/wallpaper-media?id=${encodeURIComponent(saved.id)}`, {
        headers: { range: 'bytes=4-9' },
      }),
    );
    assert.equal(rangeRes.status, 206);
    assert.equal(rangeRes.headers.get('content-range'), `bytes 4-9/${payload.length}`);
    assert.equal(Buffer.from(await rangeRes.arrayBuffer()).toString(), '456789');

    // Path traversal rejected
    const badRes = await serveWallpaperMedia(
      dirs,
      new Request('http://localhost/api/dsh-obsidian-prism/wallpaper-media?id=../settings.json'),
    );
    assert.equal(badRes.status, 400);

    // Delete
    await deleteWallpaper(dirs, saved.id);
    assert.equal((await listWallpapers(dirs)).length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('host HTTP handlers respond correctly', async () => {
  const dir = makeTempDir();
  try {
    const handlers = createHostHandlers(dir);
    const settingsHandler = handlers.find((h) => h.path === '/api/dsh-obsidian-prism/settings');
    assert.ok(settingsHandler);

    const postRes = await settingsHandler.fetch(
      new Request('http://localhost/api/dsh-obsidian-prism/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings: { accent: 'prism', enabled: true } }),
      }),
    );
    const postJson = await postRes.json();
    assert.equal(postJson.ok, true);
    assert.equal(postJson.value.accent, 'prism');

    const getRes = await settingsHandler.fetch(new Request('http://localhost/api/dsh-obsidian-prism/settings'));
    const getJson = await getRes.json();
    assert.equal(getJson.ok, true);
    assert.equal(getJson.value.accent, 'prism');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sanitizeSettings clamps bounds and rejects invalid values', () => {
  const s = sanitizeSettings({
    darkPreset: 'invalid',
    accent: 'amethyst',
    mascotSpec: 'r:w1',
    homeRipple: false,
    convRipple: 'medium',
    smokedFacets: false,
    wallpaperOpacity: 99,
    wallpaperBlur: -10,
    codeFoldThreshold: 999,
  });
  assert.equal(s.darkPreset, DEFAULT_SETTINGS.darkPreset);
  assert.equal(s.accent, 'amethyst');
  assert.equal(s.mascotSpec, 'r:w1');
  assert.equal(s.homeRipple, false);
  assert.equal(s.convRipple, 'medium');
  assert.equal(s.smokedFacets, false);
  assert.equal(s.wallpaperOpacity, 0.65);
  assert.equal(s.wallpaperBlur, 0);
  assert.equal(s.codeFoldThreshold, 80);

  const fallback = sanitizeSettings({ convRipple: 'bogus' });
  assert.equal(fallback.convRipple, 'off');
  assert.equal(fallback.homeRipple, true);
  assert.equal(fallback.smokedFacets, true);
});

test('scene presets apply and detect cleanly while preserving palette and wallpaper', () => {
  const presetIds = Object.keys(SCENE_PRESETS);
  assert.deepEqual(presetIds, ['ultra', 'focus', 'eco']);
  const base = sanitizeSettings({
    darkPreset: 'warm',
    accent: 'terracotta',
    wallpaperId: 'wp-local.png',
    wallpaperKind: 'image',
  });

  for (const presetId of presetIds) {
    const patch = getScenePresetPatch(presetId, base);
    assert.ok(patch);
    const merged = sanitizeSettings({ ...base, ...patch });
    assert.equal(detectActiveScenePreset(merged), presetId);
    assert.equal(merged.darkPreset, 'warm');
    assert.equal(merged.accent, 'terracotta');
    assert.equal(merged.wallpaperId, 'wp-local.png');
  }

  const custom = sanitizeSettings({ ...base, ...getScenePresetPatch('ultra', base), homeRipple: false });
  assert.equal(detectActiveScenePreset(custom), null);
});

test('settings JSON backup export/import round-trips and preserves local wallpaper', () => {
  const current = sanitizeSettings({
    darkPreset: 'warm',
    accent: 'prism',
    homeRipple: true,
    convRipple: 'subtle',
    smokedFacets: true,
    wallpaperId: 'wp-my-local.mp4',
    wallpaperKind: 'video',
  });

  const exportedText = exportSettingsBackup(current);
  const parsedRaw = JSON.parse(exportedText);
  assert.equal(parsedRaw.schema, BACKUP_SCHEMA_ID);
  assert.equal('wallpaperId' in parsedRaw.settings, false);
  assert.equal('wallpaperKind' in parsedRaw.settings, false);

  const receiverCurrent = sanitizeSettings({
    wallpaperId: 'wp-host-existing.png',
    wallpaperKind: 'image',
  });
  const imported = parseSettingsBackup(exportedText, receiverCurrent);
  assert.equal(imported.ok, true);
  assert.equal(imported.settings.darkPreset, 'warm');
  assert.equal(imported.settings.convRipple, 'subtle');
  assert.equal(imported.settings.wallpaperId, 'wp-host-existing.png');
  assert.equal(imported.settings.wallpaperKind, 'image');

  const bad = parseSettingsBackup('{not-json', receiverCurrent);
  assert.equal(bad.ok, false);
});

test('theme stylesheet contains all 4 palettes, ripple host, Smoked Obsidian facets, and studio presets', () => {
  const css = buildStylesheet();
  assert.match(css, /data-op-dark-preset="obsidian"/);
  assert.match(css, /data-op-dark-preset="warm"/);
  assert.match(css, /data-op-light-preset="crystal"/);
  assert.match(css, /data-op-light-preset="alabaster"/);
  assert.match(css, /\.ag-cs-dual-stage/);
  assert.match(css, /--dsw-alias-bg-base/);
  assert.match(css, /\.op-ripple-host/);
  assert.match(css, /\.op-brand-glow/);
  assert.match(css, /\.op-ripple-canvas/);
  assert.match(css, /data-op-facets="1"/);
  assert.match(css, /\[data-message-bubble\]/);
  assert.match(css, /\[data-presented-file\]/);
  assert.match(css, /\.op-preset-grid/);
});

test('built client.js loads cleanly via window.__ModuleLoader__', () => {
  const code = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  let registered = null;
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(mod) {
          registered = mod;
        },
      },
    },
    globalThis: {},
    console,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  assert.ok(registered);
  assert.equal(registered.id, 'dsh-obsidian-prism');
  const plugin = registered.factory((name) => {
    if (name === 'react') return { createElement: () => null, useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), Fragment: Symbol('Fragment') };
    if (name === 'react-dom') return { createPortal: (x) => x };
    throw new Error(`Unexpected require: ${name}`);
  });
  assert.equal(typeof plugin.apply, 'function');
  assert.deepEqual(Array.from(plugin.inject), ['slots']);
  assert.match(code, /createRippleController/);
  assert.match(code, /mountBrandHorizonGlow/);
  assert.match(code, /createSelectionAskController/);
  assert.match(code, /createChoreographyController/);
  assert.match(code, /createPrismRimController/);
  assert.match(code, /createStatusVialController/);
  assert.match(code, /resolveUiLang/);
});

test('v0.3.0 i18n resolver handles auto, zh, and en modes', () => {
  assert.equal(resolveUiLang({ uiLanguage: 'zh' }), 'zh');
  assert.equal(resolveUiLang({ uiLanguage: 'en' }), 'en');
  assert.equal(isZhUi({ uiLanguage: 'zh' }), true);
  assert.equal(isZhUi({ uiLanguage: 'en' }), false);
  const autoLang = resolveUiLang({ uiLanguage: 'auto' });
  assert.ok(autoLang === 'zh' || autoLang === 'en');
});

test('v0.3.0 settings defaults, sanitization, and scene presets include new optics & interaction fields', () => {
  assert.equal(DEFAULT_SETTINGS.uiLanguage, 'auto');
  assert.equal(DEFAULT_SETTINGS.prismRimEnabled, true);
  assert.equal(DEFAULT_SETTINGS.streamChoreography, true);
  assert.equal(DEFAULT_SETTINGS.statusVialEnabled, false);
  assert.equal(DEFAULT_SETTINGS.selectionAskEnabled, true);

  const sanitized = sanitizeSettings({
    uiLanguage: 'invalid-lang',
    prismRimEnabled: false,
    streamChoreography: false,
    statusVialEnabled: true,
    selectionAskEnabled: false,
  });
  assert.equal(sanitized.uiLanguage, 'auto');
  assert.equal(sanitized.prismRimEnabled, false);
  assert.equal(sanitized.streamChoreography, false);
  assert.equal(sanitized.statusVialEnabled, false);
  assert.equal(sanitized.selectionAskEnabled, false);

  const ultra = getScenePresetPatch('ultra');
  assert.equal(ultra.prismRimEnabled, true);
  assert.equal(ultra.streamChoreography, true);
  assert.equal(ultra.statusVialEnabled, false);
  assert.equal('selectionAskEnabled' in ultra, false);

  const focus = getScenePresetPatch('focus');
  assert.equal(focus.prismRimEnabled, true);
  assert.equal(focus.streamChoreography, true);
  assert.equal(focus.statusVialEnabled, false);

  const eco = getScenePresetPatch('eco');
  assert.equal(eco.prismRimEnabled, false);
  assert.equal(eco.streamChoreography, false);
  assert.equal(eco.statusVialEnabled, false);
});

test('v0.3.0 selection quote formatter handles quote & explain modes in zh/en', () => {
  const quoteEn = formatSelectionQuote('const x = 1;\nconst y = 2;', 'quote', false);
  assert.match(quoteEn, /^> const x = 1;\n> const y = 2;\n\n$/);

  const explainZh = formatSelectionQuote('WebGL2 shader', 'explain', true);
  assert.match(explainZh, /详细解释.*> WebGL2 shader/s);

  const explainEn = formatSelectionQuote('WebGL2 shader', 'explain', false);
  assert.match(explainEn, /Please explain.*> WebGL2 shader/s);

  const longText = 'a'.repeat(2100);
  assert.equal(formatSelectionQuote(longText, 'quote', false), `> ${longText}\n\n`);
});

test('v0.3.0 stylesheet includes selection pill, choreography, prism rim, status vial, searchable outline, and lang toggle', () => {
  const css = buildStylesheet();
  assert.match(css, /\.op-selection-pill/);
  assert.match(css, /\.op-selection-toast/);
  assert.match(css, /data-op-choreography="1"/);
  assert.match(css, /@keyframes op-block-arrive/);
  assert.match(css, /@keyframes op-details-unfold/);
  assert.match(css, /\.op-prism-rim-canvas/);
  assert.match(css, /\.op-status-vial/);
  assert.match(css, /\.op-status-vial\[data-vial-docked="1"\]/);
  assert.match(css, /\.op-vial-close/);
  assert.match(css, /:not\(\.op-selection-pill\):not\(\.op-selection-toast\)/);
  assert.match(css, /html\[data-op-enabled="1"\]\[data-op-choreography="1"\]\[data-op-complete-pulse="1"\] \[data-composer-card\]/);
  assert.match(css, /\.op-outline-search/);
  assert.match(css, /\.op-outline-tabs/);
  assert.match(css, /\.op-lang-btn/);
});

test('v0.3.0 regression: prism-rim exports notifyStreamingChange and selection-ask dispatches Lexical paste', async () => {
  const { createPrismRimController } = await import('../src/prism-rim-controller.js');
  const { insertTextIntoComposer } = await import('../src/selection-ask-controller.js');

  const rim = createPrismRimController({ getSettings: () => ({ ...DEFAULT_SETTINGS }) });
  assert.equal(typeof rim.notifyStreamingChange, 'function');

  // Verify insertTextIntoComposer dispatches synthetic ClipboardEvent('paste') for Lexical contenteditable
  let pastedText = null;
  let focused = false;
  const fakeComposer = {
    tagName: 'DIV',
    isConnected: true,
    textContent: '',
    getAttribute(attr) {
      return attr === 'contenteditable' ? 'true' : null;
    },
    focus() {
      focused = true;
    },
    dispatchEvent(ev) {
      if (ev.type === 'paste' && ev.clipboardData) {
        pastedText = ev.clipboardData.getData('text/plain');
        ev.preventDefault();
        return false;
      }
      return true;
    },
  };
  const prevDocument = globalThis.document;
  const prevWindow = globalThis.window;
  const prevClipboardEvent = globalThis.ClipboardEvent;
  const prevDataTransfer = globalThis.DataTransfer;
  try {
    globalThis.document = {
      createRange() {
        return { selectNodeContents() {}, collapse() {} };
      },
      execCommand() {
        return false;
      },
    };
    globalThis.window = {
      getSelection() {
        return { removeAllRanges() {}, addRange() {} };
      },
    };
    globalThis.DataTransfer = class FakeDataTransfer {
      constructor() {
        this._map = new Map();
      }
      setData(type, val) {
        this._map.set(type, String(val));
      }
      getData(type) {
        return this._map.get(type) || '';
      }
    };
    globalThis.ClipboardEvent = class FakeClipboardEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.bubbles = Boolean(init.bubbles);
        this.cancelable = Boolean(init.cancelable);
        this.clipboardData = init.clipboardData || null;
        this.defaultPrevented = false;
      }
      preventDefault() {
        this.defaultPrevented = true;
      }
    };

    const ok = insertTextIntoComposer(fakeComposer, '> hello world\n\n');
    assert.equal(ok, true);
    assert.equal(focused, true);
    assert.equal(pastedText, '> hello world\n\n');

    // Verify textarea path still works cleanly
    const events = [];
    const fakeTextarea = {
      tagName: 'TEXTAREA',
      value: 'existing',
      focus() {},
      setSelectionRange() {},
      dispatchEvent(ev) {
        events.push(ev.type);
      },
    };
    assert.equal(insertTextIntoComposer(fakeTextarea, '> quoted\n\n'), true);
    assert.equal(fakeTextarea.value, 'existing\n\n> quoted\n\n');
    assert.deepEqual(events, ['input', 'change']);
  } finally {
    globalThis.document = prevDocument;
    globalThis.window = prevWindow;
    globalThis.ClipboardEvent = prevClipboardEvent;
    globalThis.DataTransfer = prevDataTransfer;
  }
});

test('vendored vendor/ripple-core.js exports WebGL2 glyph field and horizon glow APIs', () => {
  const rippleCode = readFileSync(new URL('../vendor/ripple-core.js', import.meta.url), 'utf8');
  const mod = { exports: {} };
  const sandbox = { module: mod, exports: mod.exports, globalThis: {}, console, Math };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(rippleCode, sandbox);
  assert.equal(typeof mod.exports.createWaveField, 'function');
  assert.equal(typeof mod.exports.createGlyphField, 'function');
  assert.equal(typeof mod.exports.mountBrandHorizonGlow, 'function');
  assert.equal(typeof mod.exports.parseCssColorToRgb, 'function');
  assert.deepEqual(Array.from(mod.exports.parseCssColorToRgb('#669DF6')), [102, 157, 246]);
});

test('vendored vendor/crystal-prism-core.js exports Cut-Crystal refraction APIs', () => {
  const code = readFileSync(new URL('../vendor/crystal-prism-core.js', import.meta.url), 'utf8');
  const mod = { exports: {} };
  const sandbox = { module: mod, exports: mod.exports, globalThis: {}, console, Math };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  assert.equal(typeof mod.exports.mountCrystalPrismBar, 'function');
  assert.equal(typeof mod.exports.resolveCrystalAccentCode, 'function');
  assert.equal(typeof mod.exports.computeProximityFactor, 'function');
  assert.equal(typeof mod.exports.evaluateDeterministicGlints, 'function');
  assert.equal(mod.exports.resolveCrystalAccentCode('default'), 0);
  assert.equal(mod.exports.resolveCrystalAccentCode('warm'), 1);
  assert.equal(mod.exports.resolveCrystalAccentCode('cobalt'), 2);
  assert.equal(mod.exports.resolveCrystalAccentCode('iris'), 3);
  assert.equal(mod.exports.resolveCrystalAccentCode('amber'), 4);
  assert.equal(mod.exports.resolveCrystalAccentCode('mono'), 5);
});

test('unified model picker & reasoning effort slider: localization, search scoring, fixed width & theme CSS', async () => {
  const {
    buildEffortLevels,
    localizeEffortLabel,
    computeEffortVisualState,
    computeKnobFillRatio,
    resolveCrystalAccentForSettings,
    scoreModelRow,
  } = await import('../src/effort-slider-controller.js');

  assert.equal(DEFAULT_SETTINGS.effortSliderEnabled, true);
  assert.equal(DEFAULT_SETTINGS.effortSliderCrystal, true);
  assert.equal(getScenePresetPatch('eco').effortSliderCrystal, false);
  assert.equal(getScenePresetPatch('ultra').effortSliderCrystal, true);

  // ZH / EN localization for standard effort levels
  assert.equal(localizeEffortLabel('off', true), '关闭');
  assert.equal(localizeEffortLabel('low', true), '低');
  assert.equal(localizeEffortLabel('medium', true), '中');
  assert.equal(localizeEffortLabel('high', true), '高');
  assert.equal(localizeEffortLabel('xhigh', true), '极高');
  assert.equal(localizeEffortLabel('max', true), '最高');
  assert.equal(localizeEffortLabel({ isDefault: true }, true), '默认');
  assert.equal(localizeEffortLabel('xhigh', false), 'XHigh');
  assert.equal(localizeEffortLabel({ isDefault: true }, false), 'Default');

  // Model with 4 explicit efforts and defaultEffort defined
  const snap4 = {
    current: { provider: 'openai', model: 'o3', reasoningEffort: 'high' },
    groups: [
      {
        id: 'openai',
        models: [
          {
            id: 'o3',
            reasoning: {
              defaultEffort: 'medium',
              efforts: [
                { id: 'low', name: 'Low' },
                { id: 'medium', name: 'Medium' },
                { id: 'high', name: 'High' },
                { id: 'max', name: 'Max' },
              ],
            },
          },
        ],
      },
    ],
  };
  const parsed4 = buildEffortLevels(snap4);
  assert.equal(parsed4.levels.length, 4);
  assert.deepEqual(parsed4.levels.map((l) => l.label), ['Low', 'Medium', 'High', 'Max']);
  assert.equal(parsed4.activeIndex, 2);

  const parsed4Zh = buildEffortLevels(snap4, { zh: true });
  assert.deepEqual(parsed4Zh.levels.map((l) => l.label), ['低', '中', '高', '最高']);
  assert.equal(parsed4Zh.activeIndex, 2);

  // Model without reasoning efforts yields empty levels
  const snapNone = {
    current: { provider: 'p', model: 'plain' },
    groups: [{ id: 'p', models: [{ id: 'plain' }] }],
  };
  assert.equal(buildEffortLevels(snapNone).levels.length, 0);

  // Search scoring ranks exact/prefix ahead of substring and boosts favorites
  const rowA = { provider: 'anthropic', providerName: 'Anthropic', model: { id: 'claude-opus-4-7', name: 'Claude Opus 4.7' }, favorite: false };
  const rowB = { provider: 'anthropic', providerName: 'Anthropic', model: { id: 'claude-opus-4-7', name: 'Claude Opus 4.7' }, favorite: true };
  assert.ok(scoreModelRow(rowA, 'opus') !== null);
  assert.ok(scoreModelRow(rowB, 'opus') < scoreModelRow(rowA, 'opus'));
  assert.equal(scoreModelRow(rowA, 'nonexistent-xyz'), null);

  // Visual state escalates stars, energy, speed, and tier with level ratio
  const lowVis = computeEffortVisualState(0, 4, 'low');
  const maxVis = computeEffortVisualState(3, 4, 'max');
  const offVis = computeEffortVisualState(0, 4, 'off');
  assert.equal(offVis.tier, 'off');
  assert.equal(offVis.starCount, 0);
  assert.equal(lowVis.tier, 'low');
  assert.equal(maxVis.tier, 'max');
  assert.ok(maxVis.starCount > lowVis.starCount);
  assert.ok(maxVis.energy > lowVis.energy);
  assert.ok(maxVis.speedFactor > lowVis.speedFactor);

  assert.ok(computeKnobFillRatio(0, 328, 24) > 0 && computeKnobFillRatio(0, 328, 24) < 0.15);
  assert.ok(computeKnobFillRatio(1, 328, 24) > 0.85 && computeKnobFillRatio(1, 328, 24) < 1);
  assert.equal(resolveCrystalAccentForSettings({ accent: 'amethyst' }, 'low', true), 'iris');
  assert.equal(resolveCrystalAccentForSettings({ accent: 'follow', darkPreset: 'warm' }, 'high', true), 'warm');
  assert.equal(resolveCrystalAccentForSettings({ accent: 'follow', darkPreset: 'warm' }, 'max', true), 'amber');
  assert.equal(resolveCrystalAccentForSettings({ accent: 'follow', darkPreset: 'obsidian' }, 'max', true), 'default');

  const css = buildStylesheet();
  assert.match(css, /\.op-mp-panel[\s\S]*width:\s*356px;/);
  assert.match(css, /\.op-mp-effort-dock/);
  assert.match(css, /\.op-effort-crystal-cv/);
  assert.match(css, /\.op-effort-stars/);
  assert.match(css, /\.op-effort-stop\[data-active="1"\]/);

  const builtClient = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  assert.match(builtClient, /conversation\.input\.model/);
  assert.match(builtClient, /priority:\s*-1/);
  assert.match(builtClient, /createEffortSliderSlotComponent/);
  assert.match(builtClient, /mountCrystalPrismBar/);
  assert.match(builtClient, /PROVIDER_BRAND_LOGOS/);
  assert.match(builtClient, /onDoubleClick:/);
  assert.match(builtClient, /chooseModel\(row,\s*\{\s*close:\s*false\s*\}\)/);
  assert.match(builtClient, /chooseModel\(row,\s*\{\s*close:\s*true\s*\}\)/);
  assert.doesNotMatch(builtClient, /createContextVialController/);
});

test('provider-logos resolves real brand SVGs for providers & gateway models and scopes gradient IDs', async () => {
  const {
    PROVIDER_BRAND_LOGOS,
    resolveProviderBrandKey,
    getProviderBrandSpec,
    renderProviderLogoSvg,
  } = await import('../src/provider-logos.js');

  assert.ok(Object.keys(PROVIDER_BRAND_LOGOS).length >= 30);

  // Provider rail resolution (including Magpie virtual upstream groups)
  assert.equal(resolveProviderBrandKey('deepseek-account', 'DeepSeek Account'), 'deepseek');
  assert.equal(resolveProviderBrandKey('magpie', 'Magpie'), 'magpie');
  assert.equal(resolveProviderBrandKey('magpie-group:group', '路由组'), 'routegroup');
  assert.equal(resolveProviderBrandKey('magpie-group:codex', 'Codex'), 'codex');
  assert.equal(resolveProviderBrandKey('magpie-group:agy-cli', 'Antigravity'), 'antigravity');
  assert.equal(resolveProviderBrandKey('magpie-group:aws-quick', 'AWS Quick'), 'aws-quick');
  assert.equal(resolveProviderBrandKey('magpie-responses', 'Magpie · Responses'), 'openai');
  assert.equal(resolveProviderBrandKey('magpie-anthropic', 'Magpie · Anthropic'), 'anthropic');
  assert.equal(resolveProviderBrandKey('moonshot', 'Moonshot'), 'kimi');
  assert.equal(resolveProviderBrandKey('dashscope', 'Aliyun DashScope'), 'qwen');
  assert.equal(resolveProviderBrandKey('openrouter', 'OpenRouter'), 'openrouter');
  assert.equal(resolveProviderBrandKey('ollama', 'Ollama'), 'ollama');
  assert.equal(resolveProviderBrandKey('custom-internal-proxy', 'Internal Proxy'), null);

  // Model-level resolution inside multi-model gateways
  assert.equal(resolveProviderBrandKey('magpie-group:agy-cli', 'Antigravity', 'agy-cli/gemini-4-neon', 'Gemini 4 Neon'), 'gemini');
  assert.equal(resolveProviderBrandKey('magpie-group:agy-cli', 'Antigravity', 'agy-cli/claude-opus-5-5', 'Claude Opus 5.5'), 'claude');
  assert.equal(resolveProviderBrandKey('magpie-group:codex', 'Codex', 'codex/gpt-6.2-astra', 'GPT-6.2-Astra'), 'openai');
  assert.equal(resolveProviderBrandKey('magpie-group:aws-quick', 'AWS Quick', 'aws-quick/fast', 'AWS(Haiku, Luna)'), 'aws-quick');
  assert.equal(resolveProviderBrandKey('magpie-group:group', '路由组', 'group/smart-split', '🚀 智能'), 'routegroup');

  // Gradient ID scoping (zero collisions, no raw {{ID}} placeholder left)
  const fakeH = (type, props, ...children) => ({ type, props: props || {}, children: children.flat() });
  const geminiSpec = getProviderBrandSpec('magpie-group:agy-cli', 'Antigravity', 'agy-cli/gemini-4-neon', 'Gemini 4 Neon');
  assert.equal(geminiSpec.key, 'gemini');
  const agySpec = getProviderBrandSpec('magpie-group:agy-cli', 'Antigravity');
  assert.equal(agySpec.key, 'antigravity');
  const tree1 = renderProviderLogoSvg(fakeH, geminiSpec, { size: 16, uid: 'u1' });
  const tree2 = renderProviderLogoSvg(fakeH, agySpec, { size: 16, uid: 'u2' });
  const s1 = JSON.stringify(tree1);
  const s2 = JSON.stringify(tree2);
  assert.ok(s1.includes('u1-g0') && s1.includes('url(#u1-g0)'));
  assert.ok(s2.includes('u2-g0') && s2.includes('url(#u2-g0)'));
  assert.equal(s1.includes('{{ID}}'), false);
  assert.equal(s2.includes('{{ID}}'), false);
});

test('buildModelPickerCatalog regroups Magpie protocol buckets into Magpie logical groups in exact order while preserving real DSH provider IDs', async () => {
  const { buildModelPickerCatalog } = await import('../src/effort-slider-controller.js');
  const { resolveProviderBrandKey } = await import('../src/provider-logos.js');

  const rawGroups = [
    {
      id: 'deepseek-account',
      name: 'DeepSeek',
      models: [{ id: 'deepseek-reasoner', name: 'DeepSeek R1' }],
    },
    {
      id: 'magpie',
      name: 'Magpie',
      models: [
        { id: 'group/smart-split', name: '🚀 智能' },
        { id: 'group/fastest-first', name: '🎁 免费' },
        { id: 'aws-quick/fast', name: 'AWS(Haiku, Luna）' },
        { id: 'aws-quick/balanced', name: 'AWS(Sonnet, Terra）' },
        { id: 'aws-quick/smart', name: 'AWS((Opus,Sol）' },
      ],
    },
    {
      id: 'magpie-responses',
      name: 'Magpie · Responses',
      models: [
        { id: 'codex/gpt-6.1-terra', name: 'GPT-6.1 Terra' },
        { id: 'codex/gpt-6.2-sol', name: 'GPT-6.2-Sol' },
        { id: 'codex/gpt-6.2-astra', name: 'GPT-6.2-Astra' },
      ],
    },
    {
      id: 'magpie-anthropic',
      name: 'Magpie · Anthropic',
      models: [
        { id: 'agy-cli/gemini-4-neon', name: 'Gemini 4 Neon' },
        { id: 'agy-cli/gemini-4-hydrogen', name: 'Gemini 4 Hydrogen' },
        { id: 'agy-cli/claude-opus-5-5', name: 'Claude Opus 5.5' },
        { id: 'agy-cli/claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
      ],
    },
    {
      id: 'ollama',
      name: 'Ollama',
      models: [{ id: 'qwen3:32b', name: 'Qwen3 32B' }],
    },
  ];

  const { displayGroups, allRows } = buildModelPickerCatalog(rawGroups, {
    zh: true,
    favoriteKeys: new Set(['magpie-anthropic\0agy-cli/gemini-4-neon']),
    routableKnown: true,
    routableSet: new Set(['deepseek-account', 'magpie', 'magpie-responses', 'magpie-anthropic']),
  });

  // Exact group order: native before -> Magpie (路由组 -> Codex -> Antigravity -> AWS Quick) -> native after
  assert.deepEqual(
    displayGroups.map((g) => g.id),
    ['deepseek-account', 'magpie-group:group', 'magpie-group:codex', 'magpie-group:agy-cli', 'magpie-group:aws-quick', 'ollama'],
  );
  assert.deepEqual(
    displayGroups.map((g) => g.name),
    ['DeepSeek', '路由组', 'Codex', 'Antigravity', 'AWS Quick', 'Ollama'],
  );
  assert.equal(displayGroups[3].tooltip, 'Antigravity (local agy CLI)');
  assert.deepEqual(
    displayGroups.map((g) => g.count),
    [1, 2, 3, 4, 3, 1],
  );

  // Rail icons match Magpie (NOT Anthropic on Antigravity!)
  assert.deepEqual(
    displayGroups.map((g) => resolveProviderBrandKey(g.id, g.name)),
    ['deepseek', 'routegroup', 'codex', 'antigravity', 'aws-quick', 'ollama'],
  );

  // Real DSH provider IDs, favorites, and routability are preserved on every row
  const neonRow = allRows.find((r) => r.model.id === 'agy-cli/gemini-4-neon');
  assert.equal(neonRow.provider, 'magpie-anthropic');
  assert.equal(neonRow.displayGroupId, 'magpie-group:agy-cli');
  assert.equal(neonRow.favorite, true);
  assert.equal(neonRow.unavailable, false);

  const awsRow = allRows.find((r) => r.model.id === 'aws-quick/fast');
  assert.equal(awsRow.provider, 'magpie');
  assert.equal(awsRow.displayGroupId, 'magpie-group:aws-quick');

  const ollamaGroup = displayGroups.find((g) => g.id === 'ollama');
  assert.equal(ollamaGroup.unavailable, true);
});

test('status-vial-controller permanently disables status capsule and sweeps stale nodes', async () => {
  const { createStatusVialController } = await import('../src/status-vial-controller.js');
  const prevDocument = globalThis.document;
  try {
    const staleVials = [];
    const parent = {
      removeChild(el) {
        const idx = staleVials.indexOf(el);
        if (idx >= 0) staleVials.splice(idx, 1);
        el.parentNode = null;
      },
    };
    staleVials.push({ className: 'op-status-vial', parentNode: parent });
    staleVials.push({ className: 'op-status-vial', parentNode: parent });

    globalThis.document = {
      querySelectorAll(sel) {
        return sel === '.op-status-vial' ? [...staleVials] : [];
      },
    };

    const ctrl = createStatusVialController();
    ctrl.start();
    assert.equal(staleVials.length, 0);
    ctrl.refresh();
    ctrl.notifyStreamingChange(true);
    ctrl.dispose();
    assert.equal(staleVials.length, 0);
  } finally {
    globalThis.document = prevDocument;
  }
});

test('mascot-controller prevents duplicate stages across reloads/orphans and leaves zero stages when off', async () => {
  const { createMascotController } = await import('../src/mascot-controller.js');
  const prevDocument = globalThis.document;
  const prevWindow = globalThis.window;
  try {
    const attrs = new Map();
    const docEl = {
      setAttribute(k, v) { attrs.set(k, String(v)); },
      removeAttribute(k) { attrs.delete(k); },
      hasAttribute(k) { return attrs.has(k); },
      getAttribute(k) { return attrs.get(k) ?? null; },
    };
    const makeEl = (tag) => ({
      tagName: tag.toUpperCase(),
      className: '',
      attrs: new Map(),
      children: [],
      parentNode: null,
      get isConnected() { return this.parentNode !== null || this === card; },
      setAttribute(k, v) { this.attrs.set(k, String(v)); },
      getAttribute(k) { return this.attrs.get(k) ?? null; },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) this.children.splice(idx, 1);
        child.parentNode = null;
        return child;
      },
      querySelector() { return null; },
    });

    const card = makeEl('div');
    // Seed an orphan mascot stage left behind from a prior reload
    const orphanStage = makeEl('div');
    orphanStage.className = 'ag-cs-crab ag-cs-dual-stage';
    orphanStage.setAttribute('data-op-mascot-stage', '1');
    card.appendChild(orphanStage);

    globalThis.window = {
      matchMedia: () => ({ matches: false }),
      addEventListener() {},
      removeEventListener() {},
    };
    globalThis.document = {
      hidden: false,
      documentElement: docEl,
      body: null,
      createElement: makeEl,
      querySelector(sel) {
        return sel === '[data-composer-card]' ? card : null;
      },
      querySelectorAll(sel) {
        if (sel.includes('data-op-mascot-stage')) {
          return card.children.filter(
            (c) => c.getAttribute('data-op-mascot-stage') === '1' || c.className.includes('ag-cs-dual-stage')
          );
        }
        return [];
      },
    };

    let mountedRigCount = 0;
    let disposedRigCount = 0;
    const fakeRigApi = {
      mountDualMascotStage() {
        mountedRigCount += 1;
        return {
          setState() {},
          dispose() { disposedRigCount += 1; },
        };
      },
    };

    let settings = { enabled: true, mascotSpec: 'r:w1', accent: 'follow', darkPreset: 'obsidian', themeMode: 'auto' };
    const ctrl1 = createMascotController({
      getRig: () => fakeRigApi,
      getSettings: () => settings,
    });
    ctrl1.start();
    // Orphan stage must have been swept; strictly 1 stage mounted
    assert.equal(card.children.length, 1);
    assert.equal(mountedRigCount, 1);

    // Simulate HMR / duplicate plugin start without calling ctrl1.dispose()
    const ctrl2 = createMascotController({
      getRig: () => fakeRigApi,
      getSettings: () => settings,
    });
    ctrl2.start();
    // ctrl1 must have been auto-disposed and strictly 1 stage remains
    assert.equal(disposedRigCount, 1);
    assert.equal(card.children.length, 1);
    assert.equal(mountedRigCount, 2);

    // Turning mascots off must leave 0 stages even if a stray stage exists
    const strayStage = makeEl('div');
    strayStage.className = 'ag-cs-crab ag-cs-dual-stage';
    card.appendChild(strayStage);
    assert.equal(card.children.length, 2);

    settings = { ...settings, mascotSpec: 'off' };
    ctrl2.refresh();
    assert.equal(card.children.length, 0);
    assert.equal(disposedRigCount, 2);
    assert.equal(attrs.has('data-op-mascot-active'), false);

    ctrl2.dispose();
  } finally {
    globalThis.document = prevDocument;
    globalThis.window = prevWindow;
  }
});

test('computeMascotObstacles climbs QueueDock roof, hides when tall/overlay, and avoids right toBottom button', async () => {
  const { computeMascotObstacles } = await import('../src/mascot-controller.js');

  const makeBox = ({ rect, children = [], queryMap = {}, closestMap = {}, hidden = false } = {}) => ({
    hidden,
    children,
    firstElementChild: children[0] || null,
    getBoundingClientRect: () => rect,
    querySelector: (sel) => queryMap[sel]?.[0] || null,
    querySelectorAll: (sel) => {
      for (const [key, list] of Object.entries(queryMap)) {
        if (sel.includes(key)) return list;
      }
      return [];
    },
    closest: (sel) => {
      for (const [key, val] of Object.entries(closestMap)) {
        if (sel.includes(key)) return val;
      }
      return null;
    },
    contains: () => false,
  });

  // 1. Clean composer card with no obstacles
  const cardRect = { left: 100, right: 800, top: 600, bottom: 720, width: 700, height: 120 };
  const cleanSeat = makeBox({ rect: { left: 100, right: 800, top: 600, bottom: 720, width: 700, height: 120 } });
  const cleanScope = makeBox({ rect: { left: 0, right: 900, top: 0, bottom: 800, width: 900, height: 800 } });
  const cleanCard = makeBox({
    rect: cardRect,
    closestMap: { 'data-composer-seat': cleanSeat, 'data-conversation-scroll': cleanScope },
  });
  assert.deepEqual(computeMascotObstacles(cleanCard, cleanScope), {
    yieldMode: 'none',
    leapOffsetY: 0,
    popoverRightWidth: 0,
  });

  // 2. Single-row QueueDock above card (tucked 3px under card top) -> leap onto roof
  const queuePanel = makeBox({ rect: { left: 112, right: 788, top: 562, bottom: 603, width: 676, height: 41 } });
  const queueDock = makeBox({
    rect: { left: 112, right: 788, top: 562, bottom: 603, width: 676, height: 41 },
    children: [queuePanel],
  });
  const seatWithQueue = makeBox({
    rect: { left: 100, right: 800, top: 562, bottom: 720, width: 700, height: 158 },
    queryMap: { 'data-queue-dock': [queueDock] },
  });
  const cardWithQueue = makeBox({
    rect: cardRect,
    closestMap: { 'data-composer-seat': seatWithQueue, 'data-conversation-scroll': cleanScope },
  });
  assert.deepEqual(computeMascotObstacles(cardWithQueue, cleanScope), {
    yieldMode: 'leap',
    leapOffsetY: 38,
    popoverRightWidth: 0,
  });

  // 3. Expanded tall QueueDock (> 128px above card) -> auto-hide ('peek')
  const tallQueuePanel = makeBox({ rect: { left: 112, right: 788, top: 410, bottom: 603, width: 676, height: 193 } });
  const tallQueueDock = makeBox({
    rect: { left: 112, right: 788, top: 410, bottom: 603, width: 676, height: 193 },
    children: [tallQueuePanel],
  });
  const seatWithTallQueue = makeBox({
    rect: { left: 100, right: 800, top: 410, bottom: 720, width: 700, height: 310 },
    queryMap: { 'data-queue-dock': [tallQueueDock] },
  });
  const cardWithTallQueue = makeBox({
    rect: cardRect,
    closestMap: { 'data-composer-seat': seatWithTallQueue, 'data-conversation-scroll': cleanScope },
  });
  assert.deepEqual(computeMascotObstacles(cardWithTallQueue, cleanScope), {
    yieldMode: 'peek',
    leapOffsetY: 0,
    popoverRightWidth: 0,
  });

  // 4. Open composer overlay menu (e.g. slash command popup) -> hide immediately
  const overlayMenu = makeBox({ rect: { left: 100, right: 420, top: 380, bottom: 592, width: 320, height: 212 } });
  const overlayAnchor = makeBox({ rect: { left: 100, right: 800, top: 600, bottom: 600, width: 700, height: 0 }, children: [overlayMenu] });
  const cardWithOverlay = makeBox({
    rect: cardRect,
    queryMap: { '[data-composer-overlay]': [overlayAnchor] },
    closestMap: { 'data-composer-seat': cleanSeat, 'data-conversation-scroll': cleanScope },
  });
  assert.deepEqual(computeMascotObstacles(cardWithOverlay, cleanScope), {
    yieldMode: 'peek',
    leapOffsetY: 0,
    popoverRightWidth: 0,
  });

  // 5. Right-side "toBottom" button visible -> narrow patrol corridor via popoverRightWidth
  const toBottomBtn = makeBox({
    rect: { left: 750, right: 784, top: 550, bottom: 584, width: 34, height: 34 },
  });
  const scopeWithToBottom = makeBox({
    rect: { left: 0, right: 900, top: 0, bottom: 800, width: 900, height: 800 },
    queryMap: { toBottom: [toBottomBtn] },
  });
  const cardWithToBottom = makeBox({
    rect: cardRect,
    closestMap: { 'data-composer-seat': cleanSeat, 'data-conversation-scroll': scopeWithToBottom },
  });
  const obsToBottom = computeMascotObstacles(cardWithToBottom, scopeWithToBottom);
  assert.equal(obsToBottom.yieldMode, 'none');
  assert.equal(obsToBottom.leapOffsetY, 0);
  assert.equal(obsToBottom.popoverRightWidth, 62); // (800 - 750) + 12

  // 6. Both QueueDock (leap) and right-side toBottom button (corridor narrow) active together
  const toBottomAboveQueue = makeBox({
    rect: { left: 750, right: 784, top: 512, bottom: 546, width: 34, height: 34 },
  });
  const scopeCombined = makeBox({
    rect: { left: 0, right: 900, top: 0, bottom: 800, width: 900, height: 800 },
    queryMap: { toBottom: [toBottomAboveQueue] },
  });
  const cardCombined = makeBox({
    rect: cardRect,
    closestMap: { 'data-composer-seat': seatWithQueue, 'data-conversation-scroll': scopeCombined },
  });
  assert.deepEqual(computeMascotObstacles(cardCombined, scopeCombined), {
    yieldMode: 'leap',
    leapOffsetY: 38,
    popoverRightWidth: 62,
  });
});

test('measureContentEditableCaret tracks Lexical Shift+Enter <br> newlines and scrollport clipping', async () => {
  const { measureContentEditableCaret } = await import('../src/effects-controller.js');

  const scrollBox = {
    getBoundingClientRect: () => ({ left: 100, right: 700, top: 500, bottom: 640, width: 600, height: 140 }),
  };

  const textHello = { nodeType: 3, nodeValue: 'hello', parentElement: null };
  const spanHello = {
    nodeType: 1,
    tagName: 'SPAN',
    childNodes: [textHello],
    parentElement: null,
    getClientRects: () => [{ left: 114, right: 154, top: 506, bottom: 526, width: 40, height: 20 }],
    getBoundingClientRect: () => ({ left: 114, right: 154, top: 506, bottom: 526, width: 40, height: 20 }),
  };
  textHello.parentElement = spanHello;

  const brLine1 = {
    nodeType: 1,
    tagName: 'BR',
    childNodes: [],
    parentElement: null,
    getBoundingClientRect: () => ({ left: 154, right: 154, top: 506, bottom: 526, width: 0, height: 20 }),
  };
  const brLine2 = {
    nodeType: 1,
    tagName: 'BR',
    childNodes: [],
    parentElement: null,
    getBoundingClientRect: () => ({ left: 114, right: 114, top: 530, bottom: 550, width: 0, height: 20 }),
  };

  const p = {
    nodeType: 1,
    tagName: 'P',
    childNodes: [spanHello, brLine1, brLine2],
    parentElement: null,
    // Notice p.top is Line 1 (504) while p spans 2 lines (height 48)
    getBoundingClientRect: () => ({ left: 114, right: 690, top: 504, bottom: 552, width: 576, height: 48 }),
  };
  spanHello.parentElement = p;
  brLine1.parentElement = p;
  brLine2.parentElement = p;

  const fakeDoc = {
    createRange() {
      let startNode = null;
      let startOff = 0;
      return {
        setStart(n, o) { startNode = n; startOff = o; },
        setEnd() {},
        getClientRects() {
          if (startNode === textHello) {
            return [{ left: 114 + startOff * 8, right: 122 + startOff * 8, top: 506, bottom: 526, width: 8, height: 20 }];
          }
          return [];
        },
        getBoundingClientRect() {
          return this.getClientRects()[0] || { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
        },
      };
    },
  };

  const editorEl = {
    nodeType: 1,
    tagName: 'DIV',
    ownerDocument: fakeDoc,
    contains: (n) => n === editorEl || n === p || n === spanHello || n === textHello || n === brLine1 || n === brLine2,
    closest: (sel) => (sel.includes('data-input-scroll') ? scrollBox : null),
    getBoundingClientRect: () => ({ left: 100, right: 700, top: 500, bottom: 556, width: 600, height: 56 }),
  };
  p.parentElement = editorEl;

  const makeWin = (range) => ({
    getSelection: () => ({
      rangeCount: 1,
      isCollapsed: true,
      getRangeAt: () => range,
    }),
    getComputedStyle: () => ({
      paddingLeft: '14px',
      paddingTop: '4px',
      fontSize: '14px',
      lineHeight: '24px',
    }),
  });

  // 1. After Shift+Enter: collapsed at (<p>, 2) where Chromium returns empty getClientRects()
  //    MUST land on Line 2 (top ~530), NOT jump back to Line 1 (p.top = 504)!
  const afterNewline = measureContentEditableCaret(editorEl, makeWin({
    startContainer: p,
    startOffset: 2,
    getClientRects: () => [],
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
  }));
  assert.ok(afterNewline, 'caret must be measured after Shift+Enter');
  assert.equal(afterNewline.x, 114);
  assert.ok(afterNewline.y >= 528 && afterNewline.y <= 536, `expected line 2 y (~530), got ${afterNewline.y}`);

  // 2. End of line 1 right before <br>: collapsed at (<p>, 1) -> must stay at end of "hello" on Line 1
  const beforeBr = measureContentEditableCaret(editorEl, makeWin({
    startContainer: p,
    startOffset: 1,
    getClientRects: () => [],
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
  }));
  assert.ok(beforeBr);
  assert.equal(beforeBr.x, 154);
  assert.ok(beforeBr.y >= 504 && beforeBr.y <= 512, `expected line 1 y (~506), got ${beforeBr.y}`);

  // 3. Same-Y <br> engine quirk guard: if brLine2 reports same top as brLine1, advance by lineHeight (24px)
  const brSameY = {
    nodeType: 1,
    tagName: 'BR',
    childNodes: [],
    parentElement: p,
    getBoundingClientRect: () => ({ left: 114, right: 114, top: 506, bottom: 526, width: 0, height: 20 }),
  };
  p.childNodes = [spanHello, brLine1, brSameY];
  const guarded = measureContentEditableCaret(editorEl, makeWin({
    startContainer: p,
    startOffset: 2,
    getClientRects: () => [],
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
  }));
  assert.ok(guarded);
  assert.equal(guarded.x, 114);
  assert.ok(guarded.y >= 528 && guarded.y <= 536, `expected guarded line 2 y (~532), got ${guarded.y}`);

  // 4. Scrolled out of [data-input-scroll] viewport -> clipped (returns null)
  const brOffscreen = {
    nodeType: 1,
    tagName: 'BR',
    childNodes: [],
    parentElement: p,
    getBoundingClientRect: () => ({ left: 114, right: 114, top: 680, bottom: 700, width: 0, height: 20 }),
  };
  p.childNodes = [spanHello, brLine1, brOffscreen];
  const clipped = measureContentEditableCaret(editorEl, makeWin({
    startContainer: p,
    startOffset: 2,
    getClientRects: () => [],
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
  }));
  assert.equal(clipped, null);
});

test('dual-mascot-rig syncs habitat prop and fxCanvas during QueueDock leap and toBottom avoidance', () => {
  const rigSrc = readFileSync(new URL('../vendor/dual-mascot-rig.js', import.meta.url), 'utf8');
  assert.match(rigSrc, /const syncHabitatLayout\s*=/);
  assert.match(rigSrc, /habitatCanvas\.style\.right\s*=\s*`\$\{rightPx\}px`/);
  assert.match(rigSrc, /habitatCanvas\.style\.transform\s*=\s*liftY\s*\?/);
  assert.match(rigSrc, /fxCanvas\.style\.transform\s*=\s*liftY\s*\?/);
  const builtClient = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  assert.match(builtClient, /const syncHabitatLayout\s*=/);
});

test('model group overrides from settings', async () => {
  const { parseModelGroupConfig } = await import('../src/settings-store.js');
  const { buildModelPickerCatalog } = await import('../src/effort-slider-controller.js');
  const { resolveProviderBrandKey, setProviderBrandOverrides } = await import('../src/provider-logos.js');
  const ov = parseModelGroupConfig('# c\nkiro = Kiro 组, 25, claude\ncodex = 我的Codex');
  assert.deepEqual(ov.kiro, { name: 'Kiro 组', order: 25, icon: 'claude' });
  const { displayGroups } = buildModelPickerCatalog([{ id: 'magpie', name: 'Magpie', models: [
    { id: 'kiro/a' }, { id: 'codex/b' }, { id: 'aws-quick/c' } ] }], { zh: true, groupOverrides: ov });
  const names = displayGroups.map((g) => g.name);
  assert.ok(names.indexOf('Kiro 组') > names.indexOf('我的Codex'));
  assert.ok(names.indexOf('Kiro 组') < names.indexOf('AWS Quick'));
  setProviderBrandOverrides(ov);
  assert.equal(resolveProviderBrandKey('magpie-group:kiro', 'Kiro 组'), 'claude');
  setProviderBrandOverrides({});
});
