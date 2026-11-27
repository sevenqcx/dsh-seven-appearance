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
import { openSelectionInSidebar, registerSideQuestion } from './side-question.js';
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

function resolveEffectiveTheme(settings) {
  if (settings.themeMode === 'dark') return 'dark';
  if (settings.themeMode === 'light') return 'light';
  const html = document.documentElement;
  const body = document.body;
  if (body?.hasAttribute('data-ds-dark-theme') || html.hasAttribute('data-ds-dark-theme')) return 'dark';
  if (body?.classList.contains('dark') || html.classList.contains('dark')) return 'dark';
  const colorScheme = getComputedStyle(html).colorScheme || '';
  if (colorScheme.includes('dark') && !colorScheme.includes('light')) return 'dark';
  return 'light';
}

function applyRootAttributes(settings) {
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
  const eff = resolveEffectiveTheme(settings);
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

export function createClientPlugin({ React, createPortal, getRig, getRippleCore, getCrystalCore }) {
  return {
    inject: ['slots'],
    apply(ctx) {
      const store = createSettingsStore();
      let sideQuestion = null;
      ctx.inject(['sessions', 'sidebarRight', 'sidebarRightTabs', 'resources', 'conversation'], (scope) => {
        registerSideQuestion(scope, React, store);
        scope.effect(() => {
          const open = (sessionId, text, mode, zh) => openSelectionInSidebar(scope, sessionId, text, mode, zh);
          sideQuestion = open;
          return () => { if (sideQuestion === open) sideQuestion = null; };
        }, 'dsh-obsidian-prism: side question action');
      });
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
        const openSideQuestion = (...args) => sideQuestion ? sideQuestion(...args) : Promise.reject(new Error('Sidebar unavailable'));
        const selectionAskCtrl = createSelectionAskController({ getSettings, openSideQuestion });
        const contextMenuCtrl = createContextMenuController({ getSettings, openSideQuestion });
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

        const syncAll = () => {
          const s = store.get();
          applyRootAttributes(s);
          wallpaperCtrl.refresh();
          effectsCtrl.refresh();
          rippleCtrl.refresh();
          mascotCtrl.refresh();
          workbenchCtrl.refresh();
          selectionAskCtrl.refresh();
          contextMenuCtrl.refresh();
          promptSuggestCtrl.refresh();
          choreographyCtrl.refresh();
          prismRimCtrl.refresh();
          statusVialCtrl.refresh();
        };

        const unsub = store.subscribe(syncAll);
        applyRootAttributes(store.get());
        wallpaperCtrl.start();
        effectsCtrl.start();
        rippleCtrl.start();
        mascotCtrl.start();
        workbenchCtrl.start();
        selectionAskCtrl.start();
        contextMenuCtrl.start();
        promptSuggestCtrl.start();
        choreographyCtrl.start();
        prismRimCtrl.start();
        statusVialCtrl.start();
        store.hydrateFromHost();

        // Watch DSH dark-theme toggle on <body> (ThemePresenter) and <html>
        const themeMo = new MutationObserver(() => {
          if (store.get().themeMode === 'auto') {
            applyRootAttributes(store.get());
            rippleCtrl.refreshTheme();
            prismRimCtrl.refresh();
            statusVialCtrl.refresh();
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
          safeDispose(() => unsub());
          safeDispose(() => statusVialCtrl.dispose());
          safeDispose(() => prismRimCtrl.dispose());
          safeDispose(() => choreographyCtrl.dispose());
          safeDispose(() => selectionAskCtrl.dispose());
          safeDispose(() => contextMenuCtrl.dispose());
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

      // 3. Native DSH Settings section
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'obsidian-prism',
            order: 26,
            label: () => (isZhUi(store.get()) ? '黑曜棱镜' : 'Obsidian Prism'),
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
                      label: () => (isZhUi(store.get()) ? '黑曜棱镜模型与推理选择器' : 'Obsidian Prism Model Picker'),
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
