// Client entry orchestrator for dsh-obsidian-prism

import { createSettingsStore } from './settings-store.js';
import { STYLE_ID, buildStylesheet } from './theme-css.js';
import { isZhUi } from './i18n.js';
import { createMascotController } from './mascot-controller.js';
import { createEffectsController } from './effects-controller.js';
import { createRippleController } from './ripple-controller.js';
import { createWallpaperController } from './wallpaper-controller.js';
import { createWorkbenchController } from './workbench-controller.js';
import { createSelectionAskController } from './selection-ask-controller.js';
import { createContextMenuController } from './context-menu-controller.js';
import { createExplainPopover } from './explain-popover.js';
import { createPromptSuggestController } from './prompt-suggest-controller.js';
import { createChoreographyController } from './choreography-controller.js';
import { createPrismRimController } from './prism-rim-controller.js';
import { createStatusVialController } from './status-vial-controller.js';
import {
  createEffortSliderSlotComponent,
  createModelFavoritesStore,
  createRoutableProvidersStore,
  createPickerToggleRegistry,
} from './effort-slider-controller.js';
import { createStudioComponents } from './studio-ui.js';
import { createSidebarTools } from './sidebar-tools.js';

const HOST_THEME_PREV_KEY = 'dsh-obsidian-prism:host-theme-prev:v1';
const BUILTIN_HOST_PREFS = new Set(['light', 'dark', 'system']);

function readSavedHostThemePref(storage) {
  try {
    const raw = storage?.getItem?.(HOST_THEME_PREV_KEY);
    return BUILTIN_HOST_PREFS.has(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeSavedHostThemePref(storage, pref) {
  try {
    if (!storage) return;
    if (pref && BUILTIN_HOST_PREFS.has(pref)) storage.setItem(HOST_THEME_PREV_KEY, pref);
    else storage.removeItem(HOST_THEME_PREV_KEY);
  } catch {
    // ignore storage errors
  }
}

export function createHostThemeSync({ getSettings, setSettings, onThemeUpdated, storage = null, doc = null }) {
  const getStorage = () => storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const getDoc = () => doc || (typeof document !== 'undefined' ? document : null);
  let themeService = null;
  let syncingHost = false;
  let lastHostPref = null;
  let domBackup = null;

  function applyDomFallback(settings) {
    const d = getDoc();
    const html = d?.documentElement;
    const body = d?.body;
    if (!html || !body) return;
    const wantOverride = Boolean(settings?.enabled && (settings.themeMode === 'dark' || settings.themeMode === 'light'));
    if (wantOverride) {
      if (!domBackup) {
        domBackup = {
          hasDark: body.hasAttribute('data-ds-dark-theme'),
          themeSource: html.getAttribute('data-ds-theme-source'),
          colorScheme: html.style?.colorScheme || '',
        };
      }
      const isDark = settings.themeMode === 'dark';
      if (isDark) body.setAttribute('data-ds-dark-theme', '');
      else body.removeAttribute('data-ds-dark-theme');
      html.setAttribute('data-ds-theme-source', isDark ? 'dark' : 'light');
      if (html.style) html.style.colorScheme = isDark ? 'dark' : 'light';
    } else if (domBackup) {
      const b = domBackup;
      domBackup = null;
      if (b.hasDark) body.setAttribute('data-ds-dark-theme', '');
      else body.removeAttribute('data-ds-dark-theme');
      if (b.themeSource === null || b.themeSource === undefined) html.removeAttribute('data-ds-theme-source');
      else html.setAttribute('data-ds-theme-source', b.themeSource);
      if (html.style) html.style.colorScheme = b.colorScheme;
    }
  }

  function syncFromSettings(settings = getSettings()) {
    if (!themeService) {
      applyDomFallback(settings);
      return;
    }
    const wantOverride = Boolean(settings?.enabled && (settings.themeMode === 'dark' || settings.themeMode === 'light'));
    const curSnap = themeService.getTheme?.();
    const curPref = curSnap?.preference;
    if (wantOverride) {
      const target = settings.themeMode;
      const st = getStorage();
      if (!readSavedHostThemePref(st) && BUILTIN_HOST_PREFS.has(curPref) && curPref !== target) {
        writeSavedHostThemePref(st, curPref);
      }
      if (curPref !== target) {
        syncingHost = true;
        try {
          themeService.setTheme(target);
          lastHostPref = target;
        } catch {
          applyDomFallback(settings);
        } finally {
          syncingHost = false;
        }
      } else {
        lastHostPref = curPref;
      }
    } else {
      const st = getStorage();
      const saved = readSavedHostThemePref(st);
      if (saved) {
        writeSavedHostThemePref(st, null);
        if (curPref !== saved) {
          syncingHost = true;
          try {
            themeService.setTheme(saved);
            lastHostPref = saved;
          } catch {
            // ignore restore failure
          } finally {
            syncingHost = false;
          }
        }
      }
      if (domBackup) {
        applyDomFallback({ enabled: false, themeMode: 'auto' });
      }
    }
  }

  function handleHostThemeChange(snapshot) {
    if (syncingHost) return;
    const pref = snapshot?.preference;
    const prevSeen = lastHostPref;
    if (pref !== undefined) lastHostPref = pref;
    const s = getSettings();
    if (
      s?.enabled &&
      (s.themeMode === 'dark' || s.themeMode === 'light') &&
      pref !== undefined &&
      pref !== prevSeen &&
      pref !== s.themeMode
    ) {
      writeSavedHostThemePref(getStorage(), null);
      setSettings?.({ themeMode: 'auto' });
      return;
    }
    onThemeUpdated?.(snapshot);
  }

  function attach(theme) {
    themeService = theme || null;
    if (themeService) {
      domBackup = null;
      lastHostPref = themeService.getTheme?.()?.preference ?? null;
      syncFromSettings(getSettings());
    }
  }

  function detach() {
    themeService = null;
  }

  function dispose({ restore = false } = {}) {
    if (restore) {
      if (themeService) {
        const st = getStorage();
        const saved = readSavedHostThemePref(st);
        if (saved) {
          writeSavedHostThemePref(st, null);
          syncingHost = true;
          try {
            themeService.setTheme(saved);
          } catch {
            // ignore
          } finally {
            syncingHost = false;
          }
        }
      } else if (domBackup) {
        applyDomFallback({ enabled: false, themeMode: 'auto' });
      }
    }
    themeService = null;
    domBackup = null;
  }

  return {
    syncFromSettings,
    handleHostThemeChange,
    attach,
    detach,
    dispose,
    getEffectiveHostScheme: () => themeService?.getTheme?.()?.active?.colorScheme || null,
  };
}

function resolveEffectiveTheme(settings, hostScheme = null) {
  if (settings.themeMode === 'dark') return 'dark';
  if (settings.themeMode === 'light') return 'light';
  if (hostScheme === 'dark' || hostScheme === 'light') return hostScheme;
  const html = document.documentElement;
  const body = document.body;
  if (body?.hasAttribute('data-ds-dark-theme') || html.hasAttribute('data-ds-dark-theme')) return 'dark';
  if (body?.classList.contains('dark') || html.classList.contains('dark')) return 'dark';
  const colorScheme = getComputedStyle(html).colorScheme || '';
  if (colorScheme.includes('dark') && !colorScheme.includes('light')) return 'dark';
  return 'light';
}

function applyRootAttributes(settings, hostScheme = null) {
  const html = document.documentElement;
  if (!settings.enabled) {
    html.setAttribute('data-op-enabled', '0');
    html.removeAttribute('data-op-effective-theme');
    html.removeAttribute('data-op-dark-preset');
    html.removeAttribute('data-op-light-preset');
    html.removeAttribute('data-op-accent');
    html.removeAttribute('data-op-corners');
    html.removeAttribute('data-op-code-font');
    html.removeAttribute('data-op-ambient');
    html.removeAttribute('data-op-facets');
    html.removeAttribute('data-op-prism-rim');
    html.removeAttribute('data-op-choreography');
    html.removeAttribute('data-op-effort-slider');
    html.removeAttribute('data-op-effort-crystal');
    return;
  }
  const eff = resolveEffectiveTheme(settings, hostScheme);
  html.setAttribute('data-op-enabled', '1');
  html.setAttribute('data-op-effective-theme', eff);
  html.setAttribute('data-op-dark-preset', settings.darkPreset);
  html.setAttribute('data-op-light-preset', settings.lightPreset);
  html.setAttribute('data-op-accent', settings.accent);
  html.setAttribute('data-op-corners', settings.cornerStyle);
  html.setAttribute('data-op-code-font', settings.codeFont);
  html.setAttribute('data-op-ambient', settings.ambientGlow);
  html.setAttribute('data-op-facets', settings.smokedFacets ? '1' : '0');
  html.setAttribute('data-op-prism-rim', settings.prismRimEnabled ? '1' : '0');
  html.setAttribute('data-op-choreography', settings.streamChoreography ? '1' : '0');
  html.setAttribute('data-op-effort-slider', settings.effortSliderEnabled ? '1' : '0');
  html.setAttribute('data-op-effort-crystal', settings.effortSliderCrystal ? '1' : '0');
}

function clearRootAttributes() {
  const html = document.documentElement;
  for (const attr of [
    'data-op-enabled',
    'data-op-effective-theme',
    'data-op-dark-preset',
    'data-op-light-preset',
    'data-op-accent',
    'data-op-corners',
    'data-op-code-font',
    'data-op-ambient',
    'data-op-facets',
    'data-op-prism-rim',
    'data-op-choreography',
    'data-op-effort-slider',
    'data-op-effort-crystal',
    'data-op-mascot-active',
    'data-op-streaming',
    'data-op-smooth-caret',
    'data-op-has-wallpaper',
    'data-op-wp-glass',
  ]) {
    html.removeAttribute(attr);
  }
}

export function createClientPlugin({ React, createPortal, getRig, getRippleCore, getCrystalCore, requireRuntime = null }) {
  return {
    inject: ['slots'],
    apply(ctx) {
      const store = createSettingsStore();
      const { StudioPanel, FloatingStudioHost } = createStudioComponents({ React, createPortal, store });
      const ObsidianPrismModelPicker = createEffortSliderSlotComponent({ React, createPortal, getCrystalCore, store });

      // 1. Style injection with hot-reload owner tracking
      ctx.effect(() => {
        const owner = `obsidian-prism-${Math.random().toString(36).slice(2)}`;
        let tag = document.getElementById(STYLE_ID);
        if (!tag) {
          tag = document.createElement('style');
          tag.id = STYLE_ID;
          document.head.append(tag);
        }
        tag.textContent = buildStylesheet();
        tag.dataset.owner = owner;
        return () => {
          if (tag.dataset.owner === owner) tag.remove();
        };
      }, 'dsh-obsidian-prism: stylesheet');

      // 2. Controllers & live DOM attribute sync (with singleton hot-reload teardown guard)
      ctx.effect(() => {
        const RUNTIME_GLOBAL_KEY = '__dshObsidianPrismRuntime';
        const runtimeOwner = `op-runtime-${Math.random().toString(36).slice(2)}`;
        if (typeof window !== 'undefined' && typeof window[RUNTIME_GLOBAL_KEY]?.dispose === 'function') {
          try { window[RUNTIME_GLOBAL_KEY].dispose(); } catch { /* ignore stale runtime teardown error */ }
        }

        const getSettings = () => store.get();

        const wallpaperCtrl = createWallpaperController({ getSettings });
        const effectsCtrl = createEffectsController({ getSettings });
        const rippleCtrl = createRippleController({ getRippleCore, getSettings });
        const workbenchCtrl = createWorkbenchController({ getSettings });
        const explainPopover = createExplainPopover({ getSettings });
        const openExplain = (args) => explainPopover.show(args);
        const selectionAskCtrl = createSelectionAskController({ getSettings, openExplain });
        const contextMenuCtrl = createContextMenuController({ getSettings, openExplain });
        const promptSuggestCtrl = createPromptSuggestController({ getSettings });
        const choreographyCtrl = createChoreographyController({ getSettings });
        const prismRimCtrl = createPrismRimController({ getSettings });
        const statusVialCtrl = createStatusVialController({
          getSettings,
          onOpenStudio: () => {
            window.dispatchEvent(new CustomEvent('dsh-obsidian-prism:open-studio'));
          },
          onToggleOutline: () => workbenchCtrl.toggleOutlinePanel(),
          onClose: () => store.set({ statusVialEnabled: false }),
        });
        const mascotCtrl = createMascotController({
          getRig,
          getSettings,
          onStreamingChange: (streaming) => {
            effectsCtrl.refresh();
            rippleCtrl.refreshTheme();
            workbenchCtrl.refresh();
            choreographyCtrl.notifyStreamingChange(streaming);
            prismRimCtrl.notifyStreamingChange(streaming);
            statusVialCtrl.notifyStreamingChange(streaming);
            promptSuggestCtrl.notifyStreamingChange(streaming);
          },
        });

        const hostThemeSync = createHostThemeSync({
          getSettings,
          setSettings: (patch) => store.set(patch),
          onThemeUpdated: () => {
            const s = store.get();
            applyRootAttributes(s, hostThemeSync.getEffectiveHostScheme());
            rippleCtrl.refreshTheme();
            prismRimCtrl.refresh();
            statusVialCtrl.refresh();
            mascotCtrl.refresh();
          },
        });

        const syncAll = () => {
          const s = store.get();
          hostThemeSync.syncFromSettings(s);
          applyRootAttributes(s, hostThemeSync.getEffectiveHostScheme());
          wallpaperCtrl.refresh();
          effectsCtrl.refresh();
          rippleCtrl.refresh();
          mascotCtrl.refresh();
          workbenchCtrl.refresh();
          selectionAskCtrl.refresh();
          contextMenuCtrl.refresh();
          explainPopover.refresh();
          promptSuggestCtrl.refresh();
          choreographyCtrl.refresh();
          prismRimCtrl.refresh();
          statusVialCtrl.refresh();
        };

        const unsub = store.subscribe(syncAll);
        hostThemeSync.syncFromSettings(store.get());
        applyRootAttributes(store.get(), hostThemeSync.getEffectiveHostScheme());
        wallpaperCtrl.start();
        effectsCtrl.start();
        rippleCtrl.start();
        mascotCtrl.start();
        workbenchCtrl.start();
        selectionAskCtrl.start();
        contextMenuCtrl.start();
        explainPopover.start();
        promptSuggestCtrl.start();
        choreographyCtrl.start();
        prismRimCtrl.start();
        statusVialCtrl.start();
        store.hydrateFromHost();

        // Bridge with DSH native theme service (keeps body[data-ds-dark-theme], macOS vibrancy, Shiki & sibling plugins in sync)
        let disposeThemeBridge = null;
        if (typeof ctx.inject === 'function') {
          try {
            disposeThemeBridge = ctx.inject(['theme'], (scope) => {
              hostThemeSync.attach(scope.theme);
              applyRootAttributes(store.get(), hostThemeSync.getEffectiveHostScheme());
              rippleCtrl.refreshTheme();
              prismRimCtrl.refresh();
              statusVialCtrl.refresh();
              mascotCtrl.refresh();
              const offTheme = typeof scope.on === 'function'
                ? scope.on('theme/change', (snapshot) => hostThemeSync.handleHostThemeChange(snapshot))
                : null;
              return () => {
                if (typeof offTheme === 'function') offTheme();
                hostThemeSync.detach();
              };
            });
          } catch {
            // fallback DOM sync remains active
          }
        }

        // Watch DSH dark-theme toggle on <body> (ThemePresenter) and <html>
        const themeMo = new MutationObserver(() => {
          if (store.get().themeMode === 'auto') {
            applyRootAttributes(store.get(), hostThemeSync.getEffectiveHostScheme());
            rippleCtrl.refreshTheme();
            prismRimCtrl.refresh();
            statusVialCtrl.refresh();
            mascotCtrl.refresh();
          }
        });
        if (document.body) {
          themeMo.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-ds-dark-theme', 'class'],
          });
        }
        themeMo.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-ds-dark-theme', 'data-ds-theme-source', 'style', 'class'],
        });

        let cleanedUp = false;
        const safeDispose = (fn) => {
          try { fn(); } catch { /* ignore controller teardown error */ }
        };
        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          if (typeof window !== 'undefined' && window[RUNTIME_GLOBAL_KEY]?.owner === runtimeOwner) {
            delete window[RUNTIME_GLOBAL_KEY];
          }
          safeDispose(() => themeMo.disconnect());
          safeDispose(() => {
            if (typeof disposeThemeBridge === 'function') disposeThemeBridge();
            else disposeThemeBridge?.dispose?.();
          });
          safeDispose(() => hostThemeSync.dispose({ restore: false }));
          safeDispose(() => unsub());
          safeDispose(() => statusVialCtrl.dispose());
          safeDispose(() => prismRimCtrl.dispose());
          safeDispose(() => choreographyCtrl.dispose());
          safeDispose(() => selectionAskCtrl.dispose());
          safeDispose(() => contextMenuCtrl.dispose());
          safeDispose(() => explainPopover.dispose());
          safeDispose(() => promptSuggestCtrl.dispose());
          safeDispose(() => workbenchCtrl.dispose());
          safeDispose(() => mascotCtrl.dispose());
          safeDispose(() => rippleCtrl.dispose());
          safeDispose(() => effectsCtrl.dispose());
          safeDispose(() => wallpaperCtrl.dispose());
          safeDispose(() => store.dispose());
          safeDispose(() => clearRootAttributes());
        };

        if (typeof window !== 'undefined') {
          window[RUNTIME_GLOBAL_KEY] = { owner: runtimeOwner, dispose: cleanup };
        }

        return cleanup;
      }, 'dsh-obsidian-prism: runtime');

      // 2b. Sidebar tools (merged from dsh-grouped-nav): "Edit sidebar…" panel
      // pinning, local-agent removal, and the "Back to DSH" button in DS Bot.
      ctx.effect(() => {
        const sidebarTools = createSidebarTools({ React, require: requireRuntime });
        return sidebarTools.start(ctx);
      }, 'dsh-seven-appearance: sidebar tools');

      // 3. Native DSH Settings section
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'obsidian-prism',
            order: 26,
            label: () => (isZhUi(store.get()) ? 'Seven 外观' : 'Seven Appearance'),
          },
          StudioPanel,
        ),
      );

      // 4. Floating studio trigger & drawer portal (mounted in root shell.overlay so it works across all views)
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'obsidian-prism:studio-host',
            order: 90,
          },
          FloatingStudioHost,
        ),
      );

      // 5. Unified Obsidian Prism Model Picker + Cut-Crystal Reasoning Effort Dock (priority -1 shadows native ModelSelect)
      if (typeof ctx.inject === 'function') {
        try {
          ctx.inject(['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session'], (scope) => {
            const favorites = createModelFavoritesStore();
            const routable = createRoutableProvidersStore(scope.remote);
            const toggleRegistry = createPickerToggleRegistry();

            const refreshRoutable = () => {
              void routable.load();
            };
            if (typeof scope.on === 'function') {
              scope.on('connection/reset', refreshRoutable);
            }
            if (typeof scope.remote?.$on === 'function') {
              scope.remote.$on('llm/adapters-updated', refreshRoutable);
              scope.remote.$on('settings/document-updated', refreshRoutable);
            }

            if (typeof scope.effect === 'function') {
              scope.effect(() => toggleRegistry.attachGlobalListener(), 'dsh-obsidian-prism: model picker toggle chord');
            }

            scope.slots.inject('conversation.input.model', () => {
              let disposeSlot = null;
              const syncSlot = () => {
                const s = store.get();
                const shouldMount = Boolean(s.enabled && s.effortSliderEnabled);
                if (shouldMount && !disposeSlot) {
                  disposeSlot = scope.slots.register(
                    {
                      name: 'conversation.input.model',
                      id: 'obsidian-prism:model-picker',
                      priority: -1,
                      label: () => (isZhUi(store.get()) ? 'Seven 外观模型与推理选择器' : 'Seven Appearance Model Picker'),
                      inject: (sessionId) => {
                        const directory = scope.modelDirectories.directoryFor(sessionId);
                        const available = scope.sessions.subagentAddress(sessionId) === undefined;
                        return {
                          available,
                          directory: directory.store,
                          load: () => {
                            if (available) {
                              directory.load().catch(() => { /* surfaced on store */ });
                            }
                          },
                          select: (selection) => (
                            available
                              ? directory.select(selection)
                              : Promise.resolve(undefined)
                          ),
                          favorites,
                          routable,
                          toggleRegistry,
                        };
                      },
                    },
                    ObsidianPrismModelPicker,
                  );
                } else if (!shouldMount && disposeSlot) {
                  const fn = disposeSlot;
                  disposeSlot = null;
                  try { fn(); } catch { /* ignore */ }
                }
              };

              syncSlot();
              const unsubStore = store.subscribe(syncSlot);
              return () => {
                unsubStore();
                if (disposeSlot) {
                  const fn = disposeSlot;
                  disposeSlot = null;
                  try { fn(); } catch { /* ignore */ }
                }
              };
            });
          });
        } catch (err) {
          try {
            console.error('[dsh-obsidian-prism] model picker slot registration failed:', err);
          } catch {
            // ignore
          }
        }
      }
    },
  };
}
