// Complete Obsidian Prism theme, glow, mascot, wallpaper, workbench & studio CSS

export const STYLE_ID = 'dsh-obsidian-prism-style';

export function buildStylesheet() {
  return `/* dsh-obsidian-prism — Obsidian Prism (黑曜棱镜) for DeepSeek Harness */
@property --op-prism-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 132deg;
}

@keyframes op-prism-spin {
  to { --op-prism-angle: 492deg; }
}

@keyframes op-aura-breathe {
  0%, 100% { opacity: var(--op-aura-opacity, 0.36); transform: translate3d(0, 0, 0) scale(1); }
  50% { opacity: calc(var(--op-aura-opacity, 0.36) * 1.24); transform: translate3d(0, -6px, 0) scale(1.03); }
}

@keyframes op-caret-blink {
  0%, 48%, 100% { opacity: 1; }
  62%, 86% { opacity: 0.24; }
}

/* ── Root defaults & transitions ──────────────────────────────────────── */
html[data-op-enabled="1"] {
  --op-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --op-ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --op-prism-cobalt: #4285F4;
  --op-prism-iris: #9B72CB;
  --op-prism-coral: #EA4335;
  --op-prism-amber: #FBBC04;
  --op-prism-cyan: #5CC6FC;
  --op-prism-grad: linear-gradient(135deg, #669DF6 0%, #9B72CB 48%, #D97757 100%);
  --op-prism-conic: conic-gradient(from var(--op-prism-angle), #4285F4 0deg, #5CC6FC 75deg, #9B72CB 155deg, #EA4335 235deg, #FBBC04 300deg, #4285F4 360deg);
  --op-radius-card: 16px;
  --op-radius-control: 10px;
  --op-radius-sm: 10px;
  --op-radius-pill: 999px;
}

/* ── Corner styles ────────────────────────────────────────────────────── */
html[data-op-enabled="1"][data-op-corners="soft"],
html[data-op-enabled="1"][data-op-corners="soft"] body,
html[data-op-enabled="1"][data-op-corners="soft"] body[data-ds-dark-theme] {
  --op-radius-card: 20px;
  --op-radius-control: 12px;
  --op-radius-sm: 12px;
  --dsw-radius-sm: 8px;
  --dsw-radius-md: 12px;
  --dsw-radius-lg: 18px;
}

html[data-op-enabled="1"][data-op-corners="sharp"],
html[data-op-enabled="1"][data-op-corners="sharp"] body,
html[data-op-enabled="1"][data-op-corners="sharp"] body[data-ds-dark-theme] {
  --op-radius-card: 8px;
  --op-radius-control: 6px;
  --op-radius-sm: 6px;
  --dsw-radius-sm: 4px;
  --dsw-radius-md: 6px;
  --dsw-radius-lg: 8px;
}

/* ── Code typography ──────────────────────────────────────────────────── */
html[data-op-enabled="1"][data-op-code-font="jetbrains"] {
  --op-code-font: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, ui-monospace, monospace;
}
html[data-op-enabled="1"][data-op-code-font="fira"] {
  --op-code-font: 'Fira Code', 'SF Mono', Menlo, Consolas, ui-monospace, monospace;
}
html[data-op-enabled="1"][data-op-code-font="cascadia"] {
  --op-code-font: 'Cascadia Code', 'Cascadia Mono', 'SF Mono', Consolas, ui-monospace, monospace;
}
html[data-op-enabled="1"][data-op-code-font="maple"] {
  --op-code-font: 'Maple Mono', 'Maple Mono NF CN', 'JetBrains Mono', ui-monospace, monospace;
}
html[data-op-enabled="1"][data-op-code-font]:not([data-op-code-font="system"]) :is(pre, code, kbd, samp) {
  font-family: var(--op-code-font) !important;
  font-feature-settings: "liga" 1, "calt" 1;
}

/* ── Palette 1: Obsidian (黑曜) — Dark ────────────────────────────────── */
html[data-op-enabled="1"][data-op-effective-theme="dark"][data-op-dark-preset="obsidian"],
html[data-op-enabled="1"][data-op-effective-theme="dark"][data-op-dark-preset="obsidian"] body,
html[data-op-enabled="1"][data-op-effective-theme="dark"][data-op-dark-preset="obsidian"] body[data-ds-dark-theme] {
  color-scheme: dark;
  --op-bg-0: #08090C;
  --op-bg-1: #0B0B0E;
  --op-bg-2: #141418;
  --op-bg-3: #1C1C22;
  --op-sidebar: #09090B;
  --op-border-1: rgba(218, 228, 255, 0.068);
  --op-border-2: rgba(218, 228, 255, 0.11);
  --op-border-3: rgba(218, 228, 255, 0.18);
  --op-fg-1: #F2F2F5;
  --op-fg-2: #C4C4CE;
  --op-fg-3: #8A8A98;
  --op-accent: #669DF6;
  --op-accent-fg: #FFFFFF;
  --op-accent-soft: rgba(102, 157, 246, 0.14);
  --op-accent-glow: rgba(92, 198, 252, 0.42);
  --op-specular: rgba(255, 255, 255, 0.085);
  --op-card-shadow: 0 1px 2px rgba(0, 0, 0, 0.44), 0 10px 26px -8px rgba(0, 0, 0, 0.56);
  --op-menu-bg: rgba(16, 17, 22, 0.94);
  --op-ripple-ink: #92949C;
  --op-ripple-wave: #D6DAE4;
  --op-bubble-bg: rgba(255, 255, 255, 0.056);
  --op-bubble-border: rgba(218, 228, 255, 0.11);
  --op-facet-bg: rgba(20, 21, 27, 0.84);
  --op-facet-bg-hover: rgba(28, 30, 38, 0.92);
  --op-facet-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.042) 0%, rgba(255, 255, 255, 0) 48%);
  --op-facet-shadow: 0 1px 2px rgba(0, 0, 0, 0.36), 0 8px 20px -10px rgba(0, 0, 0, 0.5);
  --op-chip-bg: rgba(218, 228, 255, 0.068);
  --op-chip-border: rgba(218, 228, 255, 0.12);
  --op-keycap-bg: #1B1C23;
  --op-keycap-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 -1.5px 0 rgba(0, 0, 0, 0.48), 0 1px 2px rgba(0, 0, 0, 0.34);
  --op-diff-add-bg: rgba(56, 184, 137, 0.11);
  --op-diff-add-bar: rgba(56, 184, 137, 0.72);
  --op-diff-del-bg: rgba(234, 67, 53, 0.11);
  --op-diff-del-bar: rgba(234, 67, 53, 0.72);
  --op-status-ok: #38B889;
  --op-status-err: #F06A63;

  --dsw-alias-bg-base: var(--op-bg-1);
  --dsw-alias-bg-l1: var(--op-bg-2);
  --dsw-alias-bg-layer-1: var(--op-bg-2);
  --dsw-alias-bg-layer-2: var(--op-bg-3);
  --dsw-alias-bg-layer-3: var(--op-bg-3);
  --dsw-alias-card-fill: var(--op-bg-2);
  --dsw-alias-card-fill-hover: var(--op-bg-3);
  --dsw-alias-card-tile-fill: var(--op-bg-3);
  --dsw-alias-bg-module-platform: var(--op-bg-0);
  --dsw-specific-sidebar-fill: var(--op-sidebar);
  --dsw-specific-sidebar-tint: color-mix(in srgb, var(--op-sidebar) 70%, transparent);
  --dsw-menu-surface-fill: var(--op-menu-bg);
  --dsw-alias-menu-group-header-fill: var(--op-menu-bg);
  --dsw-specific-menu: var(--op-menu-bg);
  --dsw-alias-border-l1: var(--op-border-1);
  --dsw-alias-border-l2: var(--op-border-2);
  --dsw-alias-border-l3: var(--op-border-3);
  --dsw-alias-label-primary: var(--op-fg-1);
  --dsw-alias-label-secondary: var(--op-fg-2);
  --dsw-alias-label-tertiary: var(--op-fg-3);
  --dsw-alias-label-primary-foreground: var(--op-accent-fg);
  --dsw-alias-interactive-bg-hover: rgba(255, 255, 255, 0.052);
  --dsw-alias-interactive-bg-active: rgba(255, 255, 255, 0.084);
  --dsw-alias-brand-primary: var(--op-accent);
  --dsw-alias-button-primary-fill: var(--op-accent);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--op-accent);
  --dsh-accent: var(--op-accent);
}

/* ── Palette 2: Warm Charcoal (暖炭) — Dark ───────────────────────────── */
html[data-op-enabled="1"][data-op-effective-theme="dark"][data-op-dark-preset="warm"],
html[data-op-enabled="1"][data-op-effective-theme="dark"][data-op-dark-preset="warm"] body,
html[data-op-enabled="1"][data-op-effective-theme="dark"][data-op-dark-preset="warm"] body[data-ds-dark-theme] {
  color-scheme: dark;
  --op-bg-0: #0E0D0C;
  --op-bg-1: #141413;
  --op-bg-2: #1B1A18;
  --op-bg-3: #24221E;
  --op-sidebar: #10100F;
  --op-border-1: rgba(245, 240, 230, 0.072);
  --op-border-2: rgba(245, 240, 230, 0.115);
  --op-border-3: rgba(245, 240, 230, 0.18);
  --op-fg-1: #F2EFE9;
  --op-fg-2: #CEC8BC;
  --op-fg-3: #A39E93;
  --op-accent: #D97757;
  --op-accent-fg: #FFFFFF;
  --op-accent-soft: rgba(217, 119, 87, 0.16);
  --op-accent-glow: rgba(240, 163, 126, 0.42);
  --op-specular: rgba(255, 248, 236, 0.075);
  --op-card-shadow: 0 1px 2px rgba(0, 0, 0, 0.42), 0 10px 26px -8px rgba(0, 0, 0, 0.52);
  --op-menu-bg: rgba(25, 23, 21, 0.95);
  --op-prism-conic: conic-gradient(from var(--op-prism-angle), #8C3F27 0deg, #D97757 120deg, #F0A37E 210deg, #F6BD60 300deg, #8C3F27 360deg);
  --op-ripple-ink: #B4AEA2;
  --op-ripple-wave: #D97757;
  --op-bubble-bg: rgba(245, 238, 224, 0.058);
  --op-bubble-border: rgba(245, 240, 230, 0.115);
  --op-facet-bg: rgba(27, 26, 24, 0.85);
  --op-facet-bg-hover: rgba(36, 34, 30, 0.93);
  --op-facet-sheen: linear-gradient(180deg, rgba(255, 248, 236, 0.04) 0%, rgba(255, 248, 236, 0) 48%);
  --op-facet-shadow: 0 1px 2px rgba(0, 0, 0, 0.36), 0 8px 20px -10px rgba(0, 0, 0, 0.48);
  --op-chip-bg: rgba(245, 240, 230, 0.07);
  --op-chip-border: rgba(245, 240, 230, 0.125);
  --op-keycap-bg: #23211D;
  --op-keycap-shadow: inset 0 1px 0 rgba(255, 248, 236, 0.08), inset 0 -1.5px 0 rgba(0, 0, 0, 0.48), 0 1px 2px rgba(0, 0, 0, 0.34);
  --op-diff-add-bg: rgba(56, 184, 137, 0.11);
  --op-diff-add-bar: rgba(56, 184, 137, 0.72);
  --op-diff-del-bg: rgba(234, 67, 53, 0.11);
  --op-diff-del-bar: rgba(234, 67, 53, 0.72);
  --op-status-ok: #38B889;
  --op-status-err: #F06A63;

  --dsw-alias-bg-base: var(--op-bg-1);
  --dsw-alias-bg-l1: var(--op-bg-2);
  --dsw-alias-bg-layer-1: var(--op-bg-2);
  --dsw-alias-bg-layer-2: var(--op-bg-3);
  --dsw-alias-bg-layer-3: var(--op-bg-3);
  --dsw-alias-card-fill: var(--op-bg-2);
  --dsw-alias-card-fill-hover: var(--op-bg-3);
  --dsw-alias-card-tile-fill: var(--op-bg-3);
  --dsw-alias-bg-module-platform: var(--op-bg-0);
  --dsw-specific-sidebar-fill: var(--op-sidebar);
  --dsw-specific-sidebar-tint: color-mix(in srgb, var(--op-sidebar) 70%, transparent);
  --dsw-menu-surface-fill: var(--op-menu-bg);
  --dsw-alias-menu-group-header-fill: var(--op-menu-bg);
  --dsw-specific-menu: var(--op-menu-bg);
  --dsw-alias-border-l1: var(--op-border-1);
  --dsw-alias-border-l2: var(--op-border-2);
  --dsw-alias-border-l3: var(--op-border-3);
  --dsw-alias-label-primary: var(--op-fg-1);
  --dsw-alias-label-secondary: var(--op-fg-2);
  --dsw-alias-label-tertiary: var(--op-fg-3);
  --dsw-alias-label-primary-foreground: var(--op-accent-fg);
  --dsw-alias-interactive-bg-hover: rgba(245, 240, 230, 0.052);
  --dsw-alias-interactive-bg-active: rgba(245, 240, 230, 0.088);
  --dsw-alias-brand-primary: var(--op-accent);
  --dsw-alias-button-primary-fill: var(--op-accent);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--op-accent);
  --dsh-accent: var(--op-accent);
}

/* ── Palette 3: Crystal (晶白) — Light ────────────────────────────────── */
html[data-op-enabled="1"][data-op-effective-theme="light"][data-op-light-preset="crystal"],
html[data-op-enabled="1"][data-op-effective-theme="light"][data-op-light-preset="crystal"] body,
html[data-op-enabled="1"][data-op-effective-theme="light"][data-op-light-preset="crystal"] body[data-ds-dark-theme] {
  color-scheme: light;
  --op-bg-0: #E6EDF7;
  --op-bg-1: #F4F7FB;
  --op-bg-2: #FFFFFF;
  --op-bg-3: #EDF3FB;
  --op-sidebar: #E8EEF6;
  --op-border-1: rgba(15, 23, 42, 0.09);
  --op-border-2: rgba(15, 23, 42, 0.14);
  --op-border-3: rgba(15, 23, 42, 0.22);
  --op-fg-1: #0F172A;
  --op-fg-2: #334155;
  --op-fg-3: #52627A;
  --op-accent: #2563EB;
  --op-accent-fg: #FFFFFF;
  --op-accent-soft: rgba(37, 99, 235, 0.11);
  --op-accent-glow: rgba(37, 99, 235, 0.28);
  --op-specular: rgba(255, 255, 255, 0.92);
  --op-card-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 10px 28px -8px rgba(30, 58, 138, 0.10);
  --op-menu-bg: rgba(252, 253, 255, 0.96);
  --op-ripple-ink: #556682;
  --op-ripple-wave: #2563EB;
  --op-bubble-bg: rgba(255, 255, 255, 0.86);
  --op-bubble-border: rgba(15, 23, 42, 0.11);
  --op-facet-bg: rgba(255, 255, 255, 0.84);
  --op-facet-bg-hover: rgba(255, 255, 255, 0.96);
  --op-facet-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.82) 0%, rgba(255, 255, 255, 0) 48%);
  --op-facet-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px -10px rgba(30, 58, 138, 0.12);
  --op-chip-bg: rgba(15, 23, 42, 0.055);
  --op-chip-border: rgba(15, 23, 42, 0.12);
  --op-keycap-bg: #F8FAFC;
  --op-keycap-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1.5px 0 rgba(15, 23, 42, 0.16), 0 1px 2px rgba(15, 23, 42, 0.08);
  --op-diff-add-bg: rgba(22, 163, 74, 0.08);
  --op-diff-add-bar: rgba(22, 163, 74, 0.65);
  --op-diff-del-bg: rgba(220, 38, 38, 0.08);
  --op-diff-del-bar: rgba(220, 38, 38, 0.65);
  --op-status-ok: #15803D;
  --op-status-err: #DC2626;

  --dsw-alias-bg-base: var(--op-bg-1);
  --dsw-alias-bg-l1: var(--op-bg-2);
  --dsw-alias-bg-layer-1: var(--op-bg-2);
  --dsw-alias-bg-layer-2: var(--op-bg-3);
  --dsw-alias-bg-layer-3: var(--op-bg-3);
  --dsw-alias-card-fill: var(--op-bg-2);
  --dsw-alias-card-fill-hover: var(--op-bg-3);
  --dsw-alias-card-tile-fill: var(--op-bg-3);
  --dsw-alias-bg-module-platform: var(--op-bg-0);
  --dsw-specific-sidebar-fill: var(--op-sidebar);
  --dsw-specific-sidebar-tint: color-mix(in srgb, var(--op-sidebar) 70%, transparent);
  --dsw-menu-surface-fill: var(--op-menu-bg);
  --dsw-alias-menu-group-header-fill: var(--op-menu-bg);
  --dsw-specific-menu: var(--op-menu-bg);
  --dsw-alias-border-l1: var(--op-border-1);
  --dsw-alias-border-l2: var(--op-border-2);
  --dsw-alias-border-l3: var(--op-border-3);
  --dsw-alias-label-primary: var(--op-fg-1);
  --dsw-alias-label-secondary: var(--op-fg-2);
  --dsw-alias-label-tertiary: var(--op-fg-3);
  --dsw-alias-label-primary-foreground: var(--op-accent-fg);
  --dsw-alias-interactive-bg-hover: rgba(15, 23, 42, 0.052);
  --dsw-alias-interactive-bg-active: rgba(15, 23, 42, 0.088);
  --dsw-alias-brand-primary: var(--op-accent);
  --dsw-alias-button-primary-fill: var(--op-accent);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--op-accent);
  --dsh-accent: var(--op-accent);
}

/* ── Palette 4: Alabaster (暖陶) — Light ──────────────────────────────── */
html[data-op-enabled="1"][data-op-effective-theme="light"][data-op-light-preset="alabaster"],
html[data-op-enabled="1"][data-op-effective-theme="light"][data-op-light-preset="alabaster"] body,
html[data-op-enabled="1"][data-op-effective-theme="light"][data-op-light-preset="alabaster"] body[data-ds-dark-theme] {
  color-scheme: light;
  --op-bg-0: #EAE4D8;
  --op-bg-1: #F6F4EE;
  --op-bg-2: #FFFFFF;
  --op-bg-3: #F1ECE2;
  --op-sidebar: #EBE6DC;
  --op-border-1: rgba(42, 32, 20, 0.10);
  --op-border-2: rgba(42, 32, 20, 0.155);
  --op-border-3: rgba(42, 32, 20, 0.24);
  --op-fg-1: #1C1814;
  --op-fg-2: #3F3830;
  --op-fg-3: #5B5349;
  --op-accent: #C25934;
  --op-accent-fg: #FFFFFF;
  --op-accent-soft: rgba(194, 89, 52, 0.12);
  --op-accent-glow: rgba(194, 89, 52, 0.28);
  --op-specular: rgba(255, 253, 248, 0.94);
  --op-card-shadow: 0 1px 3px rgba(42, 32, 20, 0.06), 0 10px 28px -8px rgba(82, 52, 24, 0.10);
  --op-menu-bg: rgba(252, 250, 245, 0.96);
  --op-prism-conic: conic-gradient(from var(--op-prism-angle), #C25934 0deg, #E28B62 120deg, #D97706 230deg, #C25934 360deg);
  --op-ripple-ink: #665C4E;
  --op-ripple-wave: #C25934;
  --op-bubble-bg: rgba(255, 253, 248, 0.88);
  --op-bubble-border: rgba(42, 32, 20, 0.13);
  --op-facet-bg: rgba(255, 253, 249, 0.86);
  --op-facet-bg-hover: rgba(255, 254, 251, 0.97);
  --op-facet-sheen: linear-gradient(180deg, rgba(255, 253, 248, 0.85) 0%, rgba(255, 253, 248, 0) 48%);
  --op-facet-shadow: 0 1px 2px rgba(42, 32, 20, 0.05), 0 6px 18px -10px rgba(82, 52, 24, 0.12);
  --op-chip-bg: rgba(42, 32, 20, 0.06);
  --op-chip-border: rgba(42, 32, 20, 0.13);
  --op-keycap-bg: #FCF9F2;
  --op-keycap-shadow: inset 0 1px 0 rgba(255, 253, 248, 0.95), inset 0 -1.5px 0 rgba(42, 32, 20, 0.18), 0 1px 2px rgba(42, 32, 20, 0.08);
  --op-diff-add-bg: rgba(22, 163, 74, 0.08);
  --op-diff-add-bar: rgba(22, 163, 74, 0.65);
  --op-diff-del-bg: rgba(220, 38, 38, 0.08);
  --op-diff-del-bar: rgba(220, 38, 38, 0.65);
  --op-status-ok: #15803D;
  --op-status-err: #DC2626;

  --dsw-alias-bg-base: var(--op-bg-1);
  --dsw-alias-bg-l1: var(--op-bg-2);
  --dsw-alias-bg-layer-1: var(--op-bg-2);
  --dsw-alias-bg-layer-2: var(--op-bg-3);
  --dsw-alias-bg-layer-3: var(--op-bg-3);
  --dsw-alias-card-fill: var(--op-bg-2);
  --dsw-alias-card-fill-hover: var(--op-bg-3);
  --dsw-alias-card-tile-fill: var(--op-bg-3);
  --dsw-alias-bg-module-platform: var(--op-bg-0);
  --dsw-specific-sidebar-fill: var(--op-sidebar);
  --dsw-specific-sidebar-tint: color-mix(in srgb, var(--op-sidebar) 70%, transparent);
  --dsw-menu-surface-fill: var(--op-menu-bg);
  --dsw-alias-menu-group-header-fill: var(--op-menu-bg);
  --dsw-specific-menu: var(--op-menu-bg);
  --dsw-alias-border-l1: var(--op-border-1);
  --dsw-alias-border-l2: var(--op-border-2);
  --dsw-alias-border-l3: var(--op-border-3);
  --dsw-alias-label-primary: var(--op-fg-1);
  --dsw-alias-label-secondary: var(--op-fg-2);
  --dsw-alias-label-tertiary: var(--op-fg-3);
  --dsw-alias-label-primary-foreground: var(--op-accent-fg);
  --dsw-alias-interactive-bg-hover: rgba(42, 32, 20, 0.055);
  --dsw-alias-interactive-bg-active: rgba(42, 32, 20, 0.09);
  --dsw-alias-brand-primary: var(--op-accent);
  --dsw-alias-button-primary-fill: var(--op-accent);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--op-accent);
  --dsh-accent: var(--op-accent);
}

/* ── Accent overrides ─────────────────────────────────────────────────── */
html[data-op-enabled="1"][data-op-accent="prism"],
html[data-op-enabled="1"][data-op-accent="prism"] body,
html[data-op-enabled="1"][data-op-accent="prism"] body[data-ds-dark-theme] {
  --op-accent: #7A93F8;
  --op-accent-fg: #FFFFFF;
  --op-accent-soft: rgba(122, 147, 248, 0.16);
  --op-accent-glow: rgba(155, 114, 203, 0.44);
  --op-prism-conic: conic-gradient(from var(--op-prism-angle), #4285F4 0deg, #5CC6FC 75deg, #9B72CB 155deg, #EA4335 235deg, #FBBC04 300deg, #4285F4 360deg);
  --dsw-alias-brand-primary: var(--op-accent);
  --dsw-alias-button-primary-fill: var(--op-accent);
  --dsw-alias-label-primary-foreground: var(--op-accent-fg);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--op-accent);
  --dsh-accent: var(--op-accent);
}
html[data-op-enabled="1"][data-op-accent="cobalt"],
html[data-op-enabled="1"][data-op-accent="cobalt"] body,
html[data-op-enabled="1"][data-op-accent="cobalt"] body[data-ds-dark-theme] {
  --op-accent: #4F8BFF;
  --op-accent-fg: #FFFFFF;
  --op-accent-soft: rgba(79, 139, 255, 0.15);
  --op-accent-glow: rgba(79, 139, 255, 0.42);
  --dsw-alias-brand-primary: var(--op-accent);
  --dsw-alias-button-primary-fill: var(--op-accent);
  --dsw-alias-label-primary-foreground: var(--op-accent-fg);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--op-accent);
  --dsh-accent: var(--op-accent);
}
html[data-op-enabled="1"][data-op-accent="terracotta"],
html[data-op-enabled="1"][data-op-accent="terracotta"] body,
html[data-op-enabled="1"][data-op-accent="terracotta"] body[data-ds-dark-theme] {
  --op-accent: #D97757;
  --op-accent-fg: #FFFFFF;
  --op-accent-soft: rgba(217, 119, 87, 0.16);
  --op-accent-glow: rgba(217, 119, 87, 0.42);
  --dsw-alias-brand-primary: var(--op-accent);
  --dsw-alias-button-primary-fill: var(--op-accent);
  --dsw-alias-label-primary-foreground: var(--op-accent-fg);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--op-accent);
  --dsh-accent: var(--op-accent);
}
html[data-op-enabled="1"][data-op-accent="emerald"],
html[data-op-enabled="1"][data-op-accent="emerald"] body,
html[data-op-enabled="1"][data-op-accent="emerald"] body[data-ds-dark-theme] {
  --op-accent: #38B889;
  --op-accent-fg: #FFFFFF;
  --op-accent-soft: rgba(56, 184, 137, 0.15);
  --op-accent-glow: rgba(56, 184, 137, 0.4);
  --dsw-alias-brand-primary: var(--op-accent);
  --dsw-alias-button-primary-fill: var(--op-accent);
  --dsw-alias-label-primary-foreground: var(--op-accent-fg);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--op-accent);
  --dsh-accent: var(--op-accent);
}
html[data-op-enabled="1"][data-op-accent="amethyst"],
html[data-op-enabled="1"][data-op-accent="amethyst"] body,
html[data-op-enabled="1"][data-op-accent="amethyst"] body[data-ds-dark-theme] {
  --op-accent: #A07CE8;
  --op-accent-fg: #FFFFFF;
  --op-accent-soft: rgba(160, 124, 232, 0.16);
  --op-accent-glow: rgba(160, 124, 232, 0.42);
  --dsw-alias-brand-primary: var(--op-accent);
  --dsw-alias-button-primary-fill: var(--op-accent);
  --dsw-alias-label-primary-foreground: var(--op-accent-fg);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--op-accent);
  --dsh-accent: var(--op-accent);
}
html[data-op-enabled="1"][data-op-accent="amber"],
html[data-op-enabled="1"][data-op-accent="amber"] body,
html[data-op-enabled="1"][data-op-accent="amber"] body[data-ds-dark-theme] {
  --op-accent: #E5A93B;
  --op-accent-fg: #14120F;
  --op-accent-soft: rgba(229, 169, 59, 0.16);
  --op-accent-glow: rgba(229, 169, 59, 0.4);
  --dsw-alias-brand-primary: var(--op-accent);
  --dsw-alias-button-primary-fill: var(--op-accent);
  --dsw-alias-label-primary-foreground: var(--op-accent-fg);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--op-accent);
  --dsh-accent: var(--op-accent);
}
html[data-op-enabled="1"][data-op-accent="rose"],
html[data-op-enabled="1"][data-op-accent="rose"] body,
html[data-op-enabled="1"][data-op-accent="rose"] body[data-ds-dark-theme] {
  --op-accent: #E86A8A;
  --op-accent-fg: #FFFFFF;
  --op-accent-soft: rgba(232, 106, 138, 0.15);
  --op-accent-glow: rgba(232, 106, 138, 0.4);
  --dsw-alias-brand-primary: var(--op-accent);
  --dsw-alias-button-primary-fill: var(--op-accent);
  --dsw-alias-label-primary-foreground: var(--op-accent-fg);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--op-accent);
  --dsh-accent: var(--op-accent);
}

/* ── Composer card specular & prism rim glow ──────────────────────────── */
html[data-op-enabled="1"] [data-composer-card] {
  position: relative;
  border-radius: var(--op-radius-card);
  box-shadow: inset 0 1px 0 var(--op-specular), var(--op-card-shadow);
  transition: box-shadow 220ms var(--op-ease-out), border-color 180ms ease;
}

html[data-op-enabled="1"][data-op-mascot-active="1"] [data-composer-card] {
  overflow: visible !important;
}

html[data-op-enabled="1"][data-op-ambient="subtle"] [data-composer-card]:focus-within {
  box-shadow:
    inset 0 1px 0 var(--op-specular),
    0 0 0 1px color-mix(in srgb, var(--op-accent) 44%, transparent),
    0 12px 32px -12px var(--op-accent-glow),
    var(--op-card-shadow);
}

html[data-op-enabled="1"][data-op-ambient="rich"] [data-composer-card]::before,
html[data-op-enabled="1"][data-op-ambient="subtle"][data-op-streaming="1"] [data-composer-card]::before {
  content: "";
  position: absolute;
  inset: -1.5px;
  border-radius: calc(var(--op-radius-card) + 1.5px);
  padding: 1.5px;
  background: var(--op-prism-conic);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0.46;
  animation: op-prism-spin 6.5s linear infinite;
  transition: opacity 240ms ease;
  z-index: 1;
}

html[data-op-enabled="1"][data-op-ambient="rich"] [data-composer-card]:focus-within::before,
html[data-op-enabled="1"][data-op-streaming="1"] [data-composer-card]::before {
  opacity: 0.88;
  animation-duration: 3.4s;
}
html[data-op-enabled="1"][data-op-prism-rim="1"] [data-composer-card]::before {
  opacity: 0.24;
}
html[data-op-enabled="1"][data-op-prism-rim="1"][data-op-streaming="1"] [data-composer-card]::before {
  opacity: 0.42;
}

/* ── Ambient conversation aura layer ──────────────────────────────────── */
.op-ambient-aura {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
  display: none;
}

html[data-op-enabled="1"][data-op-ambient="subtle"] .op-ambient-aura,
html[data-op-enabled="1"][data-op-ambient="rich"] .op-ambient-aura {
  display: block;
}

.op-ambient-aura::before,
.op-ambient-aura::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  filter: blur(88px);
  pointer-events: none;
  will-change: transform, opacity;
}

.op-ambient-aura::before {
  width: 520px;
  height: 360px;
  top: -120px;
  right: 8%;
  background: radial-gradient(circle, color-mix(in srgb, var(--op-accent) 42%, transparent) 0%, transparent 72%);
  --op-aura-opacity: 0.24;
  animation: op-aura-breathe 12s ease-in-out infinite;
}

.op-ambient-aura::after {
  width: 580px;
  height: 340px;
  bottom: -140px;
  left: 28%;
  background: radial-gradient(circle, color-mix(in srgb, var(--op-prism-iris) 36%, var(--op-accent)) 0%, transparent 72%);
  --op-aura-opacity: 0.18;
  animation: op-aura-breathe 15s ease-in-out infinite reverse;
}

html[data-op-enabled="1"][data-op-ambient="rich"] .op-ambient-aura::before {
  --op-aura-opacity: 0.42;
}
html[data-op-enabled="1"][data-op-ambient="rich"] .op-ambient-aura::after {
  --op-aura-opacity: 0.34;
}
html[data-op-enabled="1"][data-op-streaming="1"] .op-ambient-aura::before {
  --op-aura-opacity: 0.5;
  animation-duration: 5.5s;
}

/* ── Custom Highlight API stream text fade-in ─────────────────────────── */
::highlight(op-stream-fade-0) { color: color-mix(in srgb, currentColor 22%, transparent); }
::highlight(op-stream-fade-1) { color: color-mix(in srgb, currentColor 52%, transparent); }
::highlight(op-stream-fade-2) { color: color-mix(in srgb, currentColor 82%, transparent); }

/* ── Smooth Caret overlay ─────────────────────────────────────────────── */
.op-smooth-caret {
  position: fixed;
  top: 0;
  left: 0;
  width: 2.2px;
  height: 18px;
  border-radius: 999px;
  background: var(--op-accent, #669DF6);
  box-shadow: 0 0 8px var(--op-accent-glow, rgba(92, 198, 252, 0.55));
  pointer-events: none;
  z-index: 9990;
  opacity: 0;
  transform: translate3d(-9999px, -9999px, 0);
  transition: transform 75ms cubic-bezier(0.2, 0.9, 0.25, 1), height 90ms ease, opacity 120ms ease;
  will-change: transform;
}
.op-smooth-caret[data-visible="1"] {
  opacity: 1;
}
.op-smooth-caret[data-visible="1"][data-idle="1"] {
  animation: op-caret-blink 1.05s ease-in-out infinite;
}
html[data-op-enabled="1"][data-op-smooth-caret="1"] [data-composer-card] :is(textarea, [contenteditable="true"])[data-op-caret-bound="1"] {
  caret-color: transparent !important;
}

/* ── Wallpaper backdrop & glass translucency ──────────────────────────── */
.op-wallpaper-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  display: none;
}
html[data-op-enabled="1"][data-op-has-wallpaper="1"] .op-wallpaper-layer {
  display: block;
}
.op-wallpaper-media {
  position: absolute;
  inset: -24px;
  width: calc(100% + 48px);
  height: calc(100% + 48px);
  object-fit: cover;
  opacity: var(--op-wp-opacity, 0.24);
  filter: blur(var(--op-wp-blur, 4px)) saturate(1.06);
  transform: translateZ(0);
}
html[data-op-enabled="1"][data-op-has-wallpaper="1"][data-op-wp-glass="1"],
html[data-op-enabled="1"][data-op-has-wallpaper="1"][data-op-wp-glass="1"] body,
html[data-op-enabled="1"][data-op-has-wallpaper="1"][data-op-wp-glass="1"] body[data-ds-dark-theme] {
  --dsw-alias-bg-base: color-mix(in srgb, var(--op-bg-1) 64%, transparent);
  --dsw-alias-bg-l1: color-mix(in srgb, var(--op-bg-2) 78%, transparent);
  --dsw-alias-bg-layer-1: color-mix(in srgb, var(--op-bg-2) 80%, transparent);
  --dsw-specific-sidebar-fill: color-mix(in srgb, var(--op-sidebar) 70%, transparent);
  --dsw-specific-sidebar-tint: color-mix(in srgb, var(--op-sidebar) 52%, transparent);
}
html[data-op-enabled="1"][data-op-has-wallpaper="1"] body {
  background-color: var(--op-bg-1);
}
html[data-op-enabled="1"][data-op-has-wallpaper="1"][data-op-wp-glass="1"] #root {
  background: transparent !important;
}
html[data-op-enabled="1"][data-op-has-wallpaper="1"] #root,
html[data-op-enabled="1"][data-op-has-wallpaper="1"] body > div:not(.op-wallpaper-layer):not(.op-ambient-aura):not(.op-smooth-caret):not(.op-outline-rail):not(.op-drawer-backdrop):not(.op-selection-pill):not(.op-selection-toast) {
  position: relative;
  z-index: 1;
}

/* ── Dual Mascot Stage (ported from Obsidian Prism dual-mascot-rig) ───── */
.ag-cs-crab.ag-cs-dual-stage,
.ag-cs-dual-stage {
  position: absolute;
  left: 0;
  right: 0;
  width: auto;
  bottom: calc(100% - 9px);
  height: 84px;
  z-index: 22;
  visibility: visible;
  pointer-events: none;
  user-select: none;
  overflow: visible;
  opacity: 1;
  transform: translate3d(0, 0, 0);
  transition: opacity 180ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
.ag-cs-crab.ag-cs-dual-stage[data-ag-mascot-peek="1"],
.ag-cs-dual-stage[data-ag-mascot-peek="1"] {
  opacity: 0;
  transform: translate3d(0, 14px, 0) scale(0.94);
  pointer-events: none !important;
  z-index: 0;
}
.ag-cs-dual-stage .ag-v2-mascot-actor {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 96px;
  height: 84px;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  outline: none;
}
.ag-cs-dual-stage .ag-v2-mascot-actor:is(:focus, :focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}
.ag-cs-dual-stage .ag-v2-mascot-actor::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 5px;
  width: 44px;
  height: 8px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: radial-gradient(50% 50% at 50% 50%, rgba(0, 0, 0, 0.42) 0%, rgba(0, 0, 0, 0.16) 58%, transparent);
  pointer-events: none;
  z-index: 0;
}
.ag-cs-dual-stage .ag-v2-mascot-actor:is(:active, [data-direct="1"]) {
  transition: none !important;
  will-change: transform;
}
.ag-cs-dual-stage .ag-v2-mascot-actor:is(:active, [data-dragging="1"]) {
  cursor: grabbing !important;
}
.ag-cs-dual-stage .ag-v2-mascot-canvas {
  position: relative;
  z-index: 1;
  width: 96px;
  height: 84px;
  display: block;
  image-rendering: pixelated;
  pointer-events: none;
}
.ag-cs-dual-stage .ag-v2-mini-pile {
  position: absolute;
  left: 12px;
  bottom: 1px;
  height: 32px;
  display: none;
  align-items: flex-end;
  pointer-events: none;
  z-index: 20;
}
.ag-cs-dual-stage .ag-v2-mini-crab-canvas {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 40px;
  height: 32px;
  image-rendering: pixelated;
  pointer-events: none;
  transition: transform 160ms steps(2, end);
}

/* ── Workbench: Code block folding ────────────────────────────────────── */
html[data-op-enabled="1"] pre[data-op-foldable="1"] {
  position: relative;
}
html[data-op-enabled="1"] pre[data-op-folded="1"] {
  max-height: 290px !important;
  overflow: hidden !important;
}
html[data-op-enabled="1"] pre[data-op-folded="1"]::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 28px;
  height: 60px;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, var(--op-bg-2, #141418));
}
.op-code-fold-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 12px;
  margin-top: 6px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 11px;
  line-height: 1.2;
  color: var(--op-fg-2, #C4C4CE);
  background: color-mix(in srgb, var(--op-bg-2, #141418) 94%, transparent);
  backdrop-filter: blur(8px);
  border-top: 1px solid var(--op-border-1, rgba(255, 255, 255, 0.08));
}
html[data-op-enabled="1"] pre[data-op-folded="1"] > .op-code-fold-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  margin-top: 0;
}
.op-code-fold-btn {
  border: 1px solid var(--op-border-2, rgba(255, 255, 255, 0.14));
  background: var(--op-accent-soft, rgba(102, 157, 246, 0.14));
  color: var(--op-accent, #669DF6);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: filter 120ms ease, transform 120ms ease;
}
.op-code-fold-btn:hover {
  filter: brightness(1.12);
}

/* ── Workbench: Upgraded Searchable & Collapsible Outline Rail ────────── */
@keyframes op-jump-flash {
  0% { box-shadow: 0 0 0 0 var(--op-accent-glow, rgba(102, 157, 246, 0.55)); }
  35% { box-shadow: 0 0 0 3px var(--op-accent-glow, rgba(102, 157, 246, 0.48)); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
[data-op-jump-flash="1"] {
  animation: op-jump-flash 950ms var(--op-ease-out);
  border-radius: var(--op-radius-sm, 10px);
}
.op-outline-rail {
  position: fixed;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 48;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  pointer-events: none;
}
.op-outline-pill-toggle {
  pointer-events: auto;
  border: 1px solid var(--op-border-2, rgba(255, 255, 255, 0.14));
  background: var(--op-menu-bg, rgba(16, 17, 22, 0.92));
  color: var(--op-fg-2, #C4C4CE);
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(12px);
  box-shadow: var(--op-card-shadow);
  transition: border-color 140ms ease, color 140ms ease, transform 150ms var(--op-ease-spring);
}
.op-outline-pill-toggle:hover {
  border-color: var(--op-accent, #669DF6);
  color: var(--op-fg-1, #F2F2F5);
  transform: translateX(-2px);
}
.op-outline-dots {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--op-menu-bg, rgba(16, 17, 22, 0.9)) 80%, transparent);
  border: 1px solid var(--op-border-1, rgba(255, 255, 255, 0.08));
  backdrop-filter: blur(12px);
  box-shadow: var(--op-card-shadow);
  max-height: 52vh;
  overflow-y: auto;
}
.op-outline-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  border: 0;
  padding: 0;
  background: var(--op-fg-3, #8A8A98);
  opacity: 0.48;
  cursor: pointer;
  transition: transform 150ms var(--op-ease-spring), opacity 140ms ease, background-color 140ms ease;
}
.op-outline-dot[data-kind="code"] {
  width: 8px;
  height: 4px;
  border-radius: 2px;
  background: var(--op-prism-cyan, #5CC6FC);
  opacity: 0.56;
}
.op-outline-dot[data-kind="tool"] {
  width: 6px;
  height: 6px;
  border-radius: 1.5px;
  transform: rotate(45deg);
  background: var(--op-prism-iris, #9B72CB);
  opacity: 0.58;
}
.op-outline-dot:hover,
.op-outline-dot[data-active="1"] {
  opacity: 1;
  background: var(--op-accent, #669DF6);
  transform: scale(1.42);
}
.op-outline-dot[data-kind="tool"]:hover,
.op-outline-dot[data-kind="tool"][data-active="1"] {
  transform: rotate(45deg) scale(1.32);
}
.op-outline-pop {
  pointer-events: auto;
  position: absolute;
  right: 26px;
  top: 50%;
  transform: translateY(-50%);
  width: 282px;
  max-height: 62vh;
  padding: 9px;
  border-radius: 13px;
  background: var(--op-menu-bg, rgba(16, 17, 22, 0.96));
  border: 1px solid var(--op-border-2, rgba(255, 255, 255, 0.14));
  box-shadow: var(--op-card-shadow);
  backdrop-filter: blur(18px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.op-outline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 1px 2px;
}
.op-outline-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--op-fg-2, #C4C4CE);
  letter-spacing: 0.02em;
}
.op-outline-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.op-outline-mini-btn {
  border: 1px solid var(--op-border-1, rgba(255, 255, 255, 0.1));
  background: transparent;
  color: var(--op-fg-3, #8A8A98);
  border-radius: 6px;
  padding: 2px 6px;
  font-size: 10.5px;
  line-height: 1.3;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease, background-color 120ms ease;
}
.op-outline-mini-btn:hover,
.op-outline-mini-btn[data-active="1"] {
  border-color: var(--op-accent, #669DF6);
  background: var(--op-accent-soft, rgba(102, 157, 246, 0.14));
  color: var(--op-fg-1, #F2F2F5);
}
.op-outline-search {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--op-border-2, rgba(255, 255, 255, 0.12));
  background: color-mix(in srgb, var(--op-bg-1, #0B0B0E) 65%, transparent);
  color: var(--op-fg-1, #F2F2F5);
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 11.5px;
  outline: none;
  transition: border-color 140ms ease;
}
.op-outline-search::placeholder {
  color: var(--op-fg-3, #8A8A98);
}
.op-outline-search:focus {
  border-color: var(--op-accent, #669DF6);
}
.op-outline-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.op-outline-tab {
  border: 1px solid var(--op-border-1, rgba(255, 255, 255, 0.1));
  background: transparent;
  color: var(--op-fg-3, #8A8A98);
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 10.5px;
  cursor: pointer;
  transition: border-color 120ms ease, background-color 120ms ease, color 120ms ease;
}
.op-outline-tab[data-active="1"] {
  border-color: var(--op-accent, #669DF6);
  background: var(--op-accent-soft, rgba(102, 157, 246, 0.16));
  color: var(--op-fg-1, #F2F2F5);
  font-weight: 500;
}
.op-outline-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  max-height: 40vh;
}
.op-outline-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  color: var(--op-fg-2, #C4C4CE);
  font-size: 12px;
  line-height: 1.36;
  padding: 5px 7px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}
.op-outline-item:hover,
.op-outline-item[data-active="1"] {
  background: var(--op-accent-soft, rgba(102, 157, 246, 0.14));
  color: var(--op-fg-1, #F2F2F5);
}
.op-outline-item[data-active="1"] {
  border-color: color-mix(in srgb, var(--op-accent, #669DF6) 38%, transparent);
}
.op-outline-idx {
  font-size: 10px;
  font-weight: 600;
  color: var(--op-accent, #669DF6);
  flex: none;
  font-variant-numeric: tabular-nums;
  padding: 1px 5px;
  border-radius: 5px;
  background: var(--op-chip-bg, rgba(102, 157, 246, 0.12));
}
.op-outline-idx[data-kind="code"] {
  color: var(--op-prism-cyan, #5CC6FC);
}
.op-outline-idx[data-kind="tool"] {
  color: var(--op-prism-iris, #9B72CB);
}
.op-outline-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.op-outline-empty {
  padding: 14px 8px;
  text-align: center;
  font-size: 11.5px;
  color: var(--op-fg-3, #8A8A98);
}

/* ── Floating Quick Trigger & Studio Drawer / Settings UI ─────────────── */
.op-fab {
  position: fixed;
  right: 12px;
  bottom: 8px;
  z-index: 60;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid var(--op-border-2, rgba(255, 255, 255, 0.14));
  background: var(--op-menu-bg, rgba(18, 19, 25, 0.92));
  color: var(--op-fg-1, #F2F2F5);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(14px);
  box-shadow: var(--op-card-shadow, 0 8px 24px rgba(0, 0, 0, 0.35));
  transition: transform 160ms var(--op-ease-spring), border-color 140ms ease, opacity 140ms ease;
  opacity: 0.78;
}
.op-fab:hover {
  opacity: 1;
  transform: translateY(-1px);
  border-color: var(--op-accent, #669DF6);
}
.op-fab-dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  transform: rotate(45deg);
  background: var(--op-prism-grad, linear-gradient(135deg, #669DF6, #9B72CB, #D97757));
  flex: none;
}

.op-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(3px);
  display: flex;
  justify-content: flex-end;
}
.op-drawer {
  width: min(420px, 94vw);
  height: 100vh;
  background: var(--op-menu-bg, var(--dsw-specific-menu, #141418));
  color: var(--op-fg-1, var(--dsw-alias-label-primary, #F2F2F5));
  border-left: 1px solid var(--op-border-2, var(--dsw-alias-border-l2));
  box-shadow: -16px 0 48px rgba(0, 0, 0, 0.42);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}
.op-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--op-border-1, var(--dsw-alias-border-l1));
}
.op-drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}
.op-drawer-sub {
  font-size: 11px;
  color: var(--op-fg-3, var(--dsw-alias-label-tertiary));
  font-weight: 400;
}
.op-drawer-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.op-lang-btn {
  min-width: 34px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.op-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px 24px;
}

/* Shared Studio controls (used in both Drawer & DSH Settings section) */
.op-studio {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--dsw-alias-label-primary, var(--op-fg-1));
  font-size: 13px;
}
.op-card {
  border: 1px solid var(--dsw-alias-border-l1, var(--op-border-1));
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1, var(--op-bg-2)) 88%, transparent);
  border-radius: 12px;
  padding: 13px 14px;
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.op-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary, var(--op-fg-2));
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.op-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.op-row-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.op-row-label strong {
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, var(--op-fg-1));
}
.op-row-label span {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, var(--op-fg-3));
}
.op-swatches {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.op-swatch {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l2, var(--op-border-2));
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 140ms ease, background-color 140ms ease;
}
.op-swatch[data-active="1"] {
  border-color: var(--op-accent, #669DF6);
  background: var(--op-accent-soft, rgba(102, 157, 246, 0.12));
}
.op-swatch-chip {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 1px solid rgba(128, 128, 128, 0.28);
  flex: none;
  position: relative;
  overflow: hidden;
}
.op-swatch-chip::after {
  content: "";
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--chip-accent, #669DF6);
}
.op-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.op-pill {
  border: 1px solid var(--dsw-alias-border-l2, var(--op-border-2));
  background: transparent;
  color: var(--dsw-alias-label-secondary, var(--op-fg-2));
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: border-color 120ms ease, background-color 120ms ease, color 120ms ease;
}
.op-pill[data-active="1"] {
  border-color: var(--op-accent, #669DF6);
  background: var(--op-accent-soft, rgba(102, 157, 246, 0.14));
  color: var(--dsw-alias-label-primary, var(--op-fg-1));
  font-weight: 500;
}
.op-color-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  flex: none;
}
.op-switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: 0;
  padding: 0;
  background: var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.35));
  cursor: pointer;
  flex: none;
  transition: background-color 160ms ease;
}
.op-switch[data-on="1"] {
  background: var(--op-accent, #669DF6);
}
.op-switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #FFFFFF;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 160ms var(--op-ease-spring);
}
.op-switch[data-on="1"]::after {
  transform: translateX(16px);
}
.op-slider {
  width: 132px;
  accent-color: var(--op-accent, #669DF6);
}
.op-btn {
  border: 1px solid var(--dsw-alias-border-l2, var(--op-border-2));
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
  color: var(--dsw-alias-label-primary, var(--op-fg-1));
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}
.op-btn:hover {
  border-color: var(--op-accent, #669DF6);
}
.op-btn-danger {
  color: #E5534B;
}
.op-wp-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.op-wp-thumb {
  position: relative;
  aspect-ratio: 16 / 10;
  border-radius: 8px;
  overflow: hidden;
  border: 1.5px solid var(--dsw-alias-border-l2, var(--op-border-2));
  background: var(--op-bg-0, #0B0B0E);
  cursor: pointer;
  padding: 0;
}
.op-wp-thumb[data-active="1"] {
  border-color: var(--op-accent, #669DF6);
  box-shadow: 0 0 0 2px var(--op-accent-soft);
}
.op-wp-thumb img,
.op-wp-thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.op-wp-del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 0;
  background: rgba(0, 0, 0, 0.65);
  color: #FFF;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  cursor: pointer;
}
.op-wp-badge {
  position: absolute;
  left: 4px;
  bottom: 4px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.65);
  color: #FFF;
  font-size: 9px;
  text-transform: uppercase;
}
/* ── Interactive WebGL2 ASCII Matrix Ripple & Brand Horizon Glow ──────── */
html[data-op-enabled="1"] [data-phase="hero"] {
  position: relative;
  isolation: isolate;
}
html[data-op-enabled="1"] [data-op-conv-ripple-host="1"] {
  position: relative;
  isolation: isolate;
}
.op-ripple-host {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  border-radius: inherit;
  contain: strict;
}
.op-brand-glow,
.op-ripple-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}
.op-brand-glow {
  z-index: 0;
}
.op-ripple-canvas {
  z-index: 1;
}
.op-ripple-host[data-ripple-mode="conv"] {
  opacity: 0.85;
}
html[data-op-has-wallpaper="1"] .op-ripple-host[data-ripple-mode="conv"] {
  display: none;
}

/* ── Smoked Obsidian Facet Unification (bubbles, tools, artifacts, chips, kbd) ── */
html[data-op-enabled="1"][data-op-facets="1"] [data-message-bubble] {
  background-color: var(--op-bubble-bg) !important;
  background-image: var(--op-facet-sheen);
  border: 1px solid var(--op-bubble-border) !important;
  border-radius: var(--op-radius-card);
  box-shadow: inset 0 1px 0 var(--op-specular), var(--op-facet-shadow);
  backdrop-filter: blur(10px) saturate(1.1);
  transition: border-color 180ms ease, background-color 180ms ease, box-shadow 200ms var(--op-ease-out);
}
html[data-op-enabled="1"][data-op-facets="1"] [data-message-bubble]:hover {
  border-color: var(--op-border-3) !important;
}
html[data-op-enabled="1"][data-op-facets="1"] [data-message-attachments] > * {
  border-radius: var(--op-radius-sm);
  border: 1px solid var(--op-chip-border);
  background: var(--op-chip-bg);
  box-shadow: inset 0 1px 0 var(--op-specular);
}

/* Tool call blocks, reasoning disclosures & process cards */
html[data-op-enabled="1"][data-op-facets="1"] :is(
  [data-tool],
  [data-step-process],
  [data-turn-process],
  [data-chat-group-part="reasoning"],
  [data-context-injection-body],
  [data-compaction-disclosure]
) {
  border-radius: var(--op-radius-sm);
  border-color: var(--op-border-1);
  transition: border-color 160ms ease, background-color 160ms ease, box-shadow 180ms ease;
}
html[data-op-enabled="1"][data-op-facets="1"] :is(
  [data-tool],
  [data-chat-group-part="reasoning"],
  [data-context-injection-body],
  [data-compaction-disclosure]
) {
  padding: 5px 10px;
  border: 1px solid var(--op-border-1);
  background-color: var(--op-facet-bg);
  background-image: var(--op-facet-sheen);
  box-shadow: inset 0 1px 0 var(--op-specular), 0 1px 2px rgba(0, 0, 0, 0.14);
}
html[data-op-enabled="1"][data-op-facets="1"] :is(
  [data-tool],
  [data-chat-group-part="reasoning"],
  [data-compaction-disclosure]
):hover {
  border-color: var(--op-border-2);
  background-color: var(--op-facet-bg-hover);
}
html[data-op-enabled="1"][data-op-facets="1"] [data-code-block-banner] {
  background-color: var(--op-facet-bg) !important;
  background-image: var(--op-facet-sheen);
  border-bottom: 1px solid var(--op-border-1);
}

/* Artifact, deliverable, changed-files, action & diff review cards */
html[data-op-enabled="1"][data-op-facets="1"] :is(
  [data-changed-files],
  [data-presented-file],
  [data-action-card],
  [data-changes-review]
) {
  background-color: var(--op-facet-bg) !important;
  background-image: var(--op-facet-sheen);
  border: 1px solid var(--op-border-2) !important;
  border-radius: var(--op-radius-sm);
  box-shadow: inset 0 1px 0 var(--op-specular), var(--op-facet-shadow);
  transition: border-color 160ms ease, transform 160ms var(--op-ease-out), box-shadow 180ms ease;
}
html[data-op-enabled="1"][data-op-facets="1"] :is([data-presented-file], [data-action-card]):hover {
  border-color: color-mix(in srgb, var(--op-accent) 44%, var(--op-border-3)) !important;
  box-shadow: inset 0 1px 0 var(--op-specular), 0 4px 16px -6px var(--op-accent-glow), var(--op-facet-shadow);
}
html[data-op-enabled="1"][data-op-facets="1"] [data-diff-hunk-header] {
  background: var(--op-chip-bg);
  border-top: 1px solid var(--op-border-1);
  border-bottom: 1px solid var(--op-border-1);
}
html[data-op-enabled="1"][data-op-facets="1"] [data-diff-line="add"],
html[data-op-enabled="1"][data-op-facets="1"] [data-diff-line="addition"],
html[data-op-enabled="1"][data-op-facets="1"] [data-diff-line="+"] {
  background: var(--op-diff-add-bg);
  box-shadow: inset 2px 0 0 var(--op-diff-add-bar);
}
html[data-op-enabled="1"][data-op-facets="1"] [data-diff-line="del"],
html[data-op-enabled="1"][data-op-facets="1"] [data-diff-line="deletion"],
html[data-op-enabled="1"][data-op-facets="1"] [data-diff-line="-"] {
  background: var(--op-diff-del-bg);
  box-shadow: inset 2px 0 0 var(--op-diff-del-bar);
}

/* Inline file & command reference chips */
html[data-op-enabled="1"][data-op-facets="1"] :is([data-composer-command], [data-changes-preview-path]) {
  background: var(--op-chip-bg);
  border: 1px solid var(--op-chip-border);
  border-radius: 6px;
  box-shadow: inset 0 1px 0 var(--op-specular);
  transition: border-color 140ms ease, background-color 140ms ease;
}
html[data-op-enabled="1"][data-op-facets="1"] :is([data-composer-command], [data-changes-preview-path]):hover {
  border-color: color-mix(in srgb, var(--op-accent) 48%, var(--op-chip-border));
}

/* Tactile beveled kbd keycaps */
html[data-op-enabled="1"][data-op-facets="1"] kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.45em;
  padding: 1px 5px;
  border-radius: 5px;
  border: 1px solid var(--op-border-2);
  background: var(--op-keycap-bg);
  box-shadow: var(--op-keycap-shadow);
  font-size: 0.85em;
  line-height: 1.35;
  font-weight: 500;
  color: var(--op-fg-1);
}

/* ── Studio Scene Presets & Backup Controls ───────────────────────────── */
.op-preset-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.op-preset-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 9px 10px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l2, var(--op-border-2));
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 140ms ease, background-color 140ms ease, box-shadow 160ms ease;
}
.op-preset-btn strong {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, var(--op-fg-1));
}
.op-preset-btn span {
  font-size: 11px;
  line-height: 1.35;
  color: var(--dsw-alias-label-tertiary, var(--op-fg-3));
}
.op-preset-btn:hover {
  border-color: var(--dsw-alias-border-l3, var(--op-border-3));
}
.op-preset-btn[data-active="1"] {
  border-color: var(--op-accent, #669DF6);
  background: var(--op-accent-soft, rgba(102, 157, 246, 0.14));
  box-shadow: inset 0 1px 0 var(--op-specular);
}
.op-backup-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.op-status-note {
  font-size: 11px;
  line-height: 1.4;
  color: var(--dsw-alias-label-tertiary, var(--op-fg-3));
}
.op-status-note[data-tone="ok"] {
  color: var(--op-status-ok, #38B889);
}
.op-status-note[data-tone="err"] {
  color: var(--op-status-err, #E5534B);
}

/* ── Selection Quick-Ask Floating Pill & Toast ────────────────────────── */
@keyframes op-pill-in {
  from { opacity: 0; transform: translateY(5px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.op-selection-pill {
  position: fixed;
  z-index: 1150;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px;
  border-radius: 999px;
  background: var(--op-menu-bg, rgba(16, 17, 22, 0.96));
  border: 1px solid var(--op-border-2, rgba(255, 255, 255, 0.16));
  box-shadow: 0 10px 30px -6px rgba(0, 0, 0, 0.42), inset 0 1px 0 var(--op-specular, rgba(255, 255, 255, 0.08));
  backdrop-filter: blur(16px) saturate(1.18);
  animation: op-pill-in 150ms var(--op-ease-out);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}
.op-selection-btn {
  border: 0;
  background: transparent;
  color: var(--op-fg-2, #C4C4CE);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.3;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 120ms ease, color 120ms ease;
}
.op-selection-btn:hover {
  background: var(--op-accent-soft, rgba(102, 157, 246, 0.16));
  color: var(--op-fg-1, #F2F2F5);
}
.op-selection-btn-primary {
  background: var(--op-accent, #669DF6);
  color: var(--op-accent-fg, #FFFFFF);
}
.op-selection-btn-primary:hover {
  background: color-mix(in srgb, var(--op-accent, #669DF6) 86%, #FFFFFF);
  color: var(--op-accent-fg, #FFFFFF);
}
.op-selection-toast {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translate(-50%, 8px);
  z-index: 1250;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--op-menu-bg, rgba(16, 17, 22, 0.94));
  border: 1px solid color-mix(in srgb, var(--op-accent, #669DF6) 44%, var(--op-border-2));
  color: var(--op-fg-1, #F2F2F5);
  font-size: 12px;
  font-weight: 500;
  box-shadow: var(--op-card-shadow);
  backdrop-filter: blur(14px);
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease, transform 180ms var(--op-ease-out);
}
.op-selection-toast[data-visible="1"] {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* ── Stream Choreography & Smooth Collapsibles ────────────────────────── */
@keyframes op-block-arrive {
  from { opacity: 0; transform: translate3d(0, 5px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes op-details-unfold {
  from { opacity: 0; transform: translate3d(0, -4px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes op-complete-glint {
  0% { box-shadow: inset 0 1px 0 var(--op-specular), 0 0 0 0 transparent; }
  36% { box-shadow: inset 0 1px 0 var(--op-specular), 0 0 0 2px var(--op-accent-glow, rgba(102, 157, 246, 0.34)); }
  100% { box-shadow: inset 0 1px 0 var(--op-specular), 0 0 0 0 transparent; }
}
html[data-op-enabled="1"][data-op-choreography="1"] [data-op-arrive="1"] {
  animation: op-block-arrive 240ms var(--op-ease-out) both;
}
html[data-op-enabled="1"][data-op-choreography="1"] details[open][data-op-unfold="1"] > :not(summary) {
  animation: op-details-unfold 220ms var(--op-ease-out) both;
}
html[data-op-enabled="1"][data-op-choreography="1"][data-op-complete-pulse="1"] [data-composer-card],
html[data-op-enabled="1"][data-op-choreography="1"] [data-op-complete-pulse="1"] {
  animation: op-complete-glint 920ms var(--op-ease-out);
  border-radius: var(--op-radius-sm, 10px);
}

/* ── Dynamic Composer GPU Canvas Prism Rim ────────────────────────────── */
.op-prism-rim-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 4;
  border-radius: inherit;
  display: block;
}

/* ── Lightweight Composer Status Prism Vial Indicator ─────────────────── */
@keyframes op-vial-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.32); }
}
.op-status-vial {
  display: none !important;
  position: absolute;
  left: 10px;
  top: calc(100% + 6px);
  bottom: auto;
  z-index: 25;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 22px;
  padding: 0 4px 0 6px;
  border-radius: 999px;
  border: 1px solid var(--op-border-2, rgba(255, 255, 255, 0.14));
  background: color-mix(in srgb, var(--op-menu-bg, rgba(16, 17, 22, 0.92)) 88%, transparent);
  color: var(--op-fg-2, #C4C4CE);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
  pointer-events: auto;
  backdrop-filter: blur(12px) saturate(1.15);
  box-shadow: inset 0 1px 0 var(--op-specular, rgba(255, 255, 255, 0.08)), 0 4px 12px -4px rgba(0, 0, 0, 0.24);
  transition: border-color 150ms ease, color 150ms ease, transform 150ms var(--op-ease-spring), opacity 150ms ease;
  opacity: 0.9;
}
.op-status-vial[data-vial-docked="1"],
.op-status-vial[data-vial-mount="dock"] {
  position: relative;
  left: auto;
  top: auto;
  bottom: auto;
  margin: 0 6px 0 0;
  flex: none;
  align-self: center;
  width: fit-content;
  max-width: 100%;
}
[data-phase="hero"] .op-status-vial:not([data-vial-docked="1"]) {
  bottom: auto;
  top: calc(100% + 10px);
  left: 6px;
}
.op-status-vial:hover {
  opacity: 1;
  border-color: var(--op-accent, #669DF6);
  color: var(--op-fg-1, #F2F2F5);
}
.op-status-vial[data-vial-state="streaming"] {
  opacity: 1;
  border-color: color-mix(in srgb, var(--op-accent, #669DF6) 65%, var(--op-prism-iris, #9B72CB));
  color: var(--op-fg-1, #F2F2F5);
}
.op-status-vial[data-vial-state="done"] {
  opacity: 1;
  border-color: var(--op-status-ok, #38B889);
  color: var(--op-status-ok, #38B889);
}
.op-vial-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 4px 0 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
}
.op-vial-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--op-fg-3, #8A8A98);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
.op-vial-close:hover {
  background: var(--op-accent-soft, rgba(102, 157, 246, 0.16));
  color: var(--op-fg-1, #F2F2F5);
}
.op-vial-tube {
  position: relative;
  width: 6px;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--op-border-3, rgba(255, 255, 255, 0.22));
  background: color-mix(in srgb, var(--op-bg-0, #08090C) 65%, transparent);
  flex: none;
}
.op-vial-liquid {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 28%;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--op-prism-cyan, #5CC6FC) 0%, var(--op-accent, #669DF6) 55%, var(--op-prism-iris, #9B72CB) 100%);
  transition: height 240ms var(--op-ease-out);
}
.op-status-vial[data-vial-state="streaming"] .op-vial-liquid {
  animation: op-vial-pulse 1.2s ease-in-out infinite;
}
.op-status-vial[data-vial-state="done"] .op-vial-liquid {
  background: var(--op-status-ok, #38B889);
}
.op-vial-label {
  white-space: nowrap;
}

/* ── Unified Obsidian Prism Model Picker + Cut-Crystal Effort Deck ──────── */
@keyframes op-effort-sweep {
  0% { transform: translate3d(-120%, 0, 0); }
  100% { transform: translate3d(240%, 0, 0); }
}
@keyframes op-effort-star-drift {
  0% { left: -6%; opacity: 0; }
  14% { opacity: 1; }
  84% { opacity: 1; }
  100% { left: 102%; opacity: 0; }
}
@keyframes op-effort-star-twinkle {
  0%, 100% { transform: translate(-50%, -50%) scale(0.72); opacity: calc(var(--op-star-b, 0.85) * 0.52); }
  50% { transform: translate(-50%, -50%) scale(1.22); opacity: var(--op-star-b, 0.95); }
}
@keyframes op-mp-panel-in {
  from { opacity: 0; transform: translate3d(0, 6px, 0) scale(0.985); }
  to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}

/* Composer Trigger Pill */
.op-mp-root {
  position: relative;
  min-width: 0;
  display: inline-flex;
  align-items: center;
}
.op-mp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: min(340px, 54cqw);
  height: 28px;
  padding: 0 7px 0 6px;
  border-radius: var(--op-radius-pill, 999px);
  border: 1px solid transparent;
  outline: none;
  background: transparent;
  color: var(--op-fg-2, var(--dsw-alias-label-secondary));
  font: 500 12.5px/1 system-ui, -apple-system, 'PingFang SC', 'Segoe UI', sans-serif;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 180ms ease, box-shadow 200ms ease, color 150ms ease;
}
.op-mp-trigger:hover:not(:disabled),
.op-mp-trigger[data-open="1"] {
  background: color-mix(in srgb, var(--op-fg-1, #fff) 6%, transparent);
  border-color: var(--op-border-2, rgba(255, 255, 255, 0.12));
  color: var(--op-fg-1, var(--dsw-alias-label-primary));
}
.op-mp-trigger[data-tier="high"]:not(:disabled) {
  border-color: color-mix(in srgb, var(--op-accent, #669DF6) 32%, var(--op-border-1, transparent));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--op-accent, #669DF6) 10%, transparent);
}
.op-mp-trigger[data-tier="max"]:not(:disabled) {
  border-color: color-mix(in srgb, var(--op-accent, #669DF6) 46%, var(--op-border-2, transparent));
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--op-accent, #669DF6) 16%, transparent),
    0 0 12px -4px var(--op-accent-glow, rgba(102, 157, 246, 0.4));
}
.op-mp-trigger:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--op-accent, #669DF6) 45%, transparent);
}
.op-mp-trigger:disabled {
  opacity: 0.52;
  cursor: default;
}
.op-mp-trigger-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: var(--dsh-composer-model-text-display, block);
}
.op-mp-trigger-prism {
  flex: 0 0 auto;
  color: var(--op-accent, #669DF6);
}
.op-mp-trigger-effort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.01em;
  color: var(--op-fg-2, #C4C4CE);
  background: color-mix(in srgb, var(--op-accent, #669DF6) 13%, transparent);
  border: 1px solid color-mix(in srgb, var(--op-accent, #669DF6) 28%, transparent);
}
.op-mp-trigger-effort[data-tier="off"] {
  color: var(--op-fg-3, #8A8A98);
  background: color-mix(in srgb, var(--op-fg-3, #8A8A98) 12%, transparent);
  border-color: color-mix(in srgb, var(--op-fg-3, #8A8A98) 24%, transparent);
}
.op-mp-trigger-effort[data-tier="high"],
.op-mp-trigger-effort[data-tier="max"] {
  color: var(--op-fg-1, #F2F2F5);
  background: color-mix(in srgb, var(--op-accent, #669DF6) 20%, transparent);
  border-color: color-mix(in srgb, var(--op-accent, #669DF6) 44%, transparent);
}
.op-mp-trigger-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--op-accent, #669DF6);
  box-shadow: 0 0 6px var(--op-accent-glow, rgba(102, 157, 246, 0.5));
}
.op-mp-trigger-effort[data-tier="off"] .op-mp-trigger-dot {
  background: var(--op-fg-3, #8A8A98);
  box-shadow: none;
}
.op-mp-chevron {
  flex: 0 0 auto;
  color: var(--op-fg-3, #8A8A98);
  transition: transform 160ms var(--op-ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}
.op-mp-chevron-open {
  transform: rotate(180deg);
}

/* Provider & Model Brand Logo Glyphs */
.op-mp-trigger-glyph,
.op-mp-rail-glyph,
.op-mp-row-glyph,
.op-mp-section-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  background: color-mix(in srgb, var(--op-prov-hue, var(--op-accent, #669DF6)) 14%, transparent);
  color: var(--op-prov-hue, var(--op-accent, #669DF6));
  border: 1px solid color-mix(in srgb, var(--op-prov-hue, var(--op-accent, #669DF6)) 24%, transparent);
  transition: background-color 140ms ease, border-color 140ms ease, transform 140ms ease;
}
.op-mp-trigger-glyph[data-op-mp-logo="1"],
.op-mp-rail-glyph[data-op-mp-logo="1"],
.op-mp-row-glyph[data-op-mp-logo="1"],
.op-mp-section-glyph[data-op-mp-logo="1"] {
  background: color-mix(in srgb, var(--op-prov-hue, var(--op-accent, #669DF6)) 11%, rgba(255, 255, 255, 0.03));
  border-color: color-mix(in srgb, var(--op-prov-hue, var(--op-accent, #669DF6)) 22%, rgba(255, 255, 255, 0.06));
}
.op-mp-trigger-glyph[data-op-mp-mono="1"],
.op-mp-rail-glyph[data-op-mp-mono="1"],
.op-mp-row-glyph[data-op-mp-mono="1"],
.op-mp-section-glyph[data-op-mp-mono="1"] {
  color: var(--op-fg-1, #F2F2F5);
}
html[data-op-effective-theme="light"] .op-mp-trigger-glyph[data-op-mp-logo="1"],
html[data-op-effective-theme="light"] .op-mp-rail-glyph[data-op-mp-logo="1"],
html[data-op-effective-theme="light"] .op-mp-row-glyph[data-op-mp-logo="1"],
html[data-op-effective-theme="light"] .op-mp-section-glyph[data-op-mp-logo="1"] {
  background: color-mix(in srgb, var(--op-prov-hue, var(--op-accent, #4A7AF0)) 10%, rgba(15, 23, 42, 0.025));
  border-color: color-mix(in srgb, var(--op-prov-hue, var(--op-accent, #4A7AF0)) 20%, rgba(15, 23, 42, 0.07));
}
html[data-op-effective-theme="light"] .op-mp-trigger-glyph[data-op-mp-mono="1"],
html[data-op-effective-theme="light"] .op-mp-rail-glyph[data-op-mp-mono="1"],
html[data-op-effective-theme="light"] .op-mp-row-glyph[data-op-mp-mono="1"],
html[data-op-effective-theme="light"] .op-mp-section-glyph[data-op-mp-mono="1"] {
  color: var(--op-fg-1, #181920);
}
.op-mp-logo-svg {
  display: block;
  flex: 0 0 auto;
}
.op-mp-rail-btn:hover .op-mp-rail-glyph[data-op-mp-logo="1"],
.op-mp-rail-btn[data-active="1"] .op-mp-rail-glyph[data-op-mp-logo="1"] {
  background: color-mix(in srgb, var(--op-prov-hue, var(--op-accent, #669DF6)) 18%, rgba(255, 255, 255, 0.05));
  border-color: color-mix(in srgb, var(--op-prov-hue, var(--op-accent, #669DF6)) 36%, transparent);
}
.op-mp-trigger-glyph {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  font-size: 8.5px;
}
.op-mp-rail-glyph {
  width: 26px;
  height: 26px;
  border-radius: calc(var(--op-radius-control, 10px) - 2px);
  font-size: 9.5px;
}
.op-mp-row-glyph {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  font-size: 8.5px;
}
.op-mp-section-glyph {
  width: 16px;
  height: 16px;
  border-radius: 4.5px;
  font-size: 7px;
}

/* Fixed-Width Unified Picker Panel */
.op-mp-panel {
  position: fixed;
  z-index: 2147482900;
  display: flex;
  flex-direction: column;
  width: 356px;
  min-width: 356px;
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
  border-radius: var(--op-radius-card, 16px);
  background: var(--op-menu-bg, rgba(16, 17, 22, 0.94));
  border: 1px solid var(--op-border-2, rgba(218, 228, 255, 0.12));
  box-shadow:
    inset 0 1px 0 var(--op-specular, rgba(255, 255, 255, 0.09)),
    0 20px 52px -12px rgba(0, 0, 0, 0.62),
    0 4px 16px -4px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(22px) saturate(155%);
  -webkit-backdrop-filter: blur(22px) saturate(155%);
  color: var(--op-fg-1, #F2F2F5);
  font-family: system-ui, -apple-system, 'PingFang SC', 'Segoe UI', sans-serif;
  overflow: hidden;
  animation: op-mp-panel-in 150ms var(--op-ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}
html[data-op-effective-theme="light"] .op-mp-panel {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 18px 46px -12px rgba(15, 23, 42, 0.18),
    0 4px 14px -4px rgba(15, 23, 42, 0.08);
}

/* Upper Split: Fixed 44px Rail + 312px Search/List */
.op-mp-upper {
  display: flex;
  width: 100%;
  height: 264px;
  min-height: 264px;
  max-height: 264px;
}

.op-mp-rail {
  width: 44px;
  flex: 0 0 44px;
  background: color-mix(in srgb, var(--op-bg-0, #08090C) 52%, transparent);
  border-right: 1px solid var(--op-border-1, rgba(218, 228, 255, 0.07));
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}
.op-mp-rail::-webkit-scrollbar {
  display: none;
}
.op-mp-rail-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 7px 0;
}
.op-mp-rail-divider {
  width: 22px;
  height: 1px;
  margin: 2px 0;
  background: var(--op-border-2, rgba(218, 228, 255, 0.12));
}
.op-mp-rail-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: calc(var(--op-radius-control, 10px) - 2px);
  background: transparent;
  color: var(--op-fg-3, #8A8A98);
  cursor: pointer;
  outline: none;
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease, transform 140ms ease;
}
.op-mp-rail-btn:hover {
  background: color-mix(in srgb, var(--op-fg-1, #fff) 6%, transparent);
  color: var(--op-fg-1, #F2F2F5);
}
.op-mp-rail-btn[data-active="1"] {
  background: var(--op-accent-soft, rgba(102, 157, 246, 0.14));
  border-color: color-mix(in srgb, var(--op-accent, #669DF6) 34%, transparent);
  color: var(--op-accent, #669DF6);
}
.op-mp-rail-btn[data-active="1"]::before {
  content: "";
  position: absolute;
  left: -6px;
  top: 7px;
  bottom: 7px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--op-accent, #669DF6);
  box-shadow: 0 0 8px var(--op-accent-glow, rgba(102, 157, 246, 0.6));
}
.op-mp-rail-btn[data-unavailable="1"] {
  opacity: 0.45;
}
.op-mp-rail-icon {
  display: block;
}

/* Main Model Column */
.op-mp-main {
  flex: 1 1 auto;
  width: 312px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.op-mp-search {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  flex: 0 0 38px;
  padding: 0 10px 0 11px;
  border-bottom: 1px solid var(--op-border-1, rgba(218, 228, 255, 0.08));
  background: color-mix(in srgb, var(--op-bg-2, #141418) 38%, transparent);
}
.op-mp-search-icon {
  flex: 0 0 auto;
  color: var(--op-fg-3, #8A8A98);
  transition: color 140ms ease;
}
.op-mp-search:focus-within .op-mp-search-icon {
  color: var(--op-accent, #669DF6);
}
.op-mp-search-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--op-fg-1, #F2F2F5);
  font-size: 12.5px;
  font-family: inherit;
}
.op-mp-search-input::placeholder {
  color: var(--op-fg-3, #8A8A98);
}
.op-mp-search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--op-fg-3, #8A8A98);
  cursor: pointer;
}
.op-mp-search-clear:hover {
  background: color-mix(in srgb, var(--op-fg-1, #fff) 8%, transparent);
  color: var(--op-fg-1, #F2F2F5);
}
.op-mp-search-kbd,
.op-mp-kbd {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  padding: 0 5px;
  border-radius: 5px;
  border: 1px solid var(--op-border-2, rgba(218, 228, 255, 0.12));
  background: var(--op-keycap-bg, #1B1C23);
  box-shadow: var(--op-keycap-shadow, none);
  color: var(--op-fg-3, #8A8A98);
  font-size: 10px;
  font-weight: 500;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  line-height: 1;
}

.op-mp-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 5px 6px 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--op-border-3, rgba(255, 255, 255, 0.18)) transparent;
}
.op-mp-list::-webkit-scrollbar {
  width: 5px;
}
.op-mp-list::-webkit-scrollbar-thumb {
  background: var(--op-border-3, rgba(255, 255, 255, 0.18));
  border-radius: 999px;
}
.op-mp-list::-webkit-scrollbar-track {
  background: transparent;
}

.op-mp-section {
  margin-bottom: 4px;
}
.op-mp-section:last-child {
  margin-bottom: 0;
}
.op-mp-section-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px 3px;
  color: var(--op-fg-3, #8A8A98);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.op-mp-section-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.op-mp-row-wrap {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: calc(var(--op-radius-control, 10px) - 2px);
  border: 1px solid transparent;
  transition: background-color 110ms ease, border-color 120ms ease;
}
.op-mp-row-wrap[data-highlighted="1"] {
  background: color-mix(in srgb, var(--op-fg-1, #fff) 6%, transparent);
}
.op-mp-row-wrap[data-selected="1"] {
  background: var(--op-accent-soft, rgba(102, 157, 246, 0.14));
  border-color: color-mix(in srgb, var(--op-accent, #669DF6) 28%, transparent);
}
.op-mp-row-wrap[data-selected="1"][data-highlighted="1"] {
  background: color-mix(in srgb, var(--op-accent, #669DF6) 18%, transparent);
}
.op-mp-row-wrap[data-unavailable="1"] {
  opacity: 0.54;
}

.op-mp-row {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 6px 6px 8px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--op-fg-1, #F2F2F5);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}
.op-mp-row:disabled {
  cursor: default;
}
.op-mp-row-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.op-mp-row-title {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.op-mp-row-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.3;
}
.op-mp-row-wrap[data-selected="1"] .op-mp-row-name {
  font-weight: 600;
  color: var(--op-fg-1, #F2F2F5);
}
.op-mp-row-sub {
  font-size: 10.5px;
  line-height: 1.2;
  color: var(--op-fg-3, #8A8A98);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.op-mp-reasoning-dot {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--op-accent, #669DF6) 13%, transparent);
  color: var(--op-accent, #669DF6);
}
.op-mp-check {
  flex: 0 0 auto;
  color: var(--op-accent, #669DF6);
}
.op-mp-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: 0 0 auto;
  padding-right: 6px;
}
.op-mp-star-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--op-fg-3, #8A8A98);
  opacity: 0.32;
  cursor: pointer;
  transition: opacity 130ms ease, color 130ms ease, background-color 130ms ease;
}
.op-mp-row-wrap:hover .op-mp-star-btn,
.op-mp-row-wrap[data-highlighted="1"] .op-mp-star-btn,
.op-mp-star-btn[data-starred="1"] {
  opacity: 1;
}
.op-mp-star-btn:hover {
  background: color-mix(in srgb, var(--op-fg-1, #fff) 8%, transparent);
  color: #F5B942;
}
.op-mp-star-btn[data-starred="1"] {
  color: #F5B942;
}

.op-mp-badge {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 5px;
  border: 1px solid var(--op-border-2, rgba(218, 228, 255, 0.14));
  background: color-mix(in srgb, var(--op-fg-3, #8A8A98) 12%, transparent);
  color: var(--op-fg-3, #8A8A98);
  font-size: 10px;
  line-height: 1.3;
}

.op-mp-status,
.op-mp-empty {
  padding: 28px 16px;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: var(--op-fg-3, #8A8A98);
}
.op-mp-error,
.op-mp-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 6px 8px 2px;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.35;
  background: color-mix(in srgb, var(--op-status-err, #F06A63) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--op-status-err, #F06A63) 28%, transparent);
  color: var(--op-fg-1, #F2F2F5);
}
.op-mp-retry {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--op-border-3, rgba(255, 255, 255, 0.2));
  background: color-mix(in srgb, var(--op-fg-1, #fff) 8%, transparent);
  color: inherit;
  font-size: 11px;
  cursor: pointer;
}
.op-mp-toast {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 2147482910;
  max-width: 300px;
  padding: 8px 10px;
  border-radius: var(--op-radius-control, 10px);
  background: var(--op-menu-bg, rgba(16, 17, 22, 0.96));
  border: 1px solid color-mix(in srgb, var(--op-status-err, #F06A63) 40%, var(--op-border-2));
  box-shadow: var(--op-card-shadow);
  color: var(--op-fg-1, #F2F2F5);
  font-size: 11.5px;
  line-height: 1.4;
}

/* ── Lower Full-Width Cut-Crystal Reasoning Effort Dock (356px fixed) ──── */
.op-mp-effort-dock {
  --op-effort-peak-a: var(--op-prism-iris, #9B72CB);
  --op-effort-peak-b: var(--op-prism-cyan, #5CC6FC);
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px 10px;
  border-top: 1px solid var(--op-border-1, rgba(218, 228, 255, 0.08));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--op-bg-2, #141418) 64%, transparent) 0%,
    color-mix(in srgb, var(--op-bg-0, #08090C) 52%, transparent) 100%
  );
  user-select: none;
  -webkit-user-select: none;
}
html[data-op-enabled="1"][data-op-effective-theme="dark"][data-op-dark-preset="warm"][data-op-accent="follow"] .op-mp-effort-dock,
html[data-op-enabled="1"][data-op-effective-theme="light"][data-op-light-preset="alabaster"][data-op-accent="follow"] .op-mp-effort-dock,
html[data-op-enabled="1"][data-op-accent="terracotta"] .op-mp-effort-dock,
html[data-op-enabled="1"][data-op-accent="amber"] .op-mp-effort-dock,
html[data-op-enabled="1"][data-op-accent="rose"] .op-mp-effort-dock {
  --op-effort-peak-a: #E5A93B;
  --op-effort-peak-b: #FDBA74;
}
html[data-op-effective-theme="light"] .op-mp-effort-dock {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--op-bg-2, #F6F8FC) 70%, transparent) 0%,
    color-mix(in srgb, var(--op-bg-3, #EDF1F8) 60%, transparent) 100%
  );
}
.op-mp-effort-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
}
.op-mp-effort-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--op-fg-2, #C4C4CE);
  letter-spacing: 0.01em;
}
.op-mp-effort-icon {
  color: var(--op-accent, #669DF6);
}
.op-mp-effort-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--op-fg-1, #F2F2F5);
  background: color-mix(in srgb, var(--op-accent, #669DF6) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--op-accent, #669DF6) 36%, transparent);
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
}
.op-mp-effort-badge[data-tier="off"] {
  color: var(--op-fg-3, #8A8A98);
  background: color-mix(in srgb, var(--op-fg-3, #8A8A98) 12%, transparent);
  border-color: color-mix(in srgb, var(--op-fg-3, #8A8A98) 26%, transparent);
}
.op-mp-effort-badge[data-tier="max"] {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--op-accent, #669DF6) 24%, transparent),
    color-mix(in srgb, var(--op-effort-peak-a, #9B72CB) 26%, transparent)
  );
  border-color: color-mix(in srgb, var(--op-accent, #669DF6) 52%, transparent);
}
.op-mp-effort-badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--op-accent, #669DF6);
  box-shadow: 0 0 6px var(--op-accent-glow, rgba(102, 157, 246, 0.5));
}
.op-mp-effort-badge[data-tier="off"] .op-mp-effort-badge-dot {
  background: var(--op-fg-3, #8A8A98);
  box-shadow: none;
}

/* Theme-Adapted Cut-Crystal Effort Slider */
.op-effort-slider {
  --op-effort-c1: color-mix(in srgb, var(--op-accent, #669DF6) 72%, var(--op-bg-0, #08090C));
  --op-effort-c2: var(--op-accent, #669DF6);
  --op-effort-c3: color-mix(in srgb, var(--op-accent, #669DF6) 72%, #FFFFFF);
  --op-effort-glow: var(--op-accent-glow, rgba(102, 157, 246, 0.42));
  --op-effort-star: color-mix(in srgb, var(--op-accent, #669DF6) 28%, #FFFFFF);
  --op-effort-track-bg: linear-gradient(
    180deg,
    color-mix(in srgb, var(--op-bg-0, #08090C) 90%, transparent) 0%,
    color-mix(in srgb, var(--op-bg-3, #1C1C22) 84%, transparent) 100%
  );
  --op-effort-track-border: var(--op-border-2, rgba(218, 228, 255, 0.14));
  --op-effort-stop-color: var(--op-fg-3, #8A8A98);
  --op-effort-stop-active-color: var(--op-fg-1, #F2F2F5);
  --op-effort-stop-active-bg: color-mix(in srgb, var(--op-accent, #669DF6) 16%, transparent);
  --op-effort-stop-active-border: color-mix(in srgb, var(--op-accent, #669DF6) 42%, transparent);
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* Warm Palettes & Warm Accents: harmonize high/max refraction into champagne gold & rose */
html[data-op-enabled="1"][data-op-effective-theme="dark"][data-op-dark-preset="warm"][data-op-accent="follow"] .op-effort-slider,
html[data-op-enabled="1"][data-op-effective-theme="light"][data-op-light-preset="alabaster"][data-op-accent="follow"] .op-effort-slider,
html[data-op-enabled="1"][data-op-accent="terracotta"] .op-effort-slider,
html[data-op-enabled="1"][data-op-accent="amber"] .op-effort-slider,
html[data-op-enabled="1"][data-op-accent="rose"] .op-effort-slider {
  --op-effort-peak-a: #E5A93B;
  --op-effort-peak-b: #FDBA74;
}

.op-effort-slider[data-tier="off"] {
  --op-effort-c1: color-mix(in srgb, var(--op-fg-3, #8A8A98) 42%, var(--op-bg-2, #141418));
  --op-effort-c2: color-mix(in srgb, var(--op-fg-3, #8A8A98) 60%, var(--op-bg-2, #141418));
  --op-effort-c3: color-mix(in srgb, var(--op-fg-3, #8A8A98) 76%, #FFFFFF);
  --op-effort-glow: rgba(148, 163, 184, 0.18);
  --op-effort-stop-active-bg: color-mix(in srgb, var(--op-fg-3, #8A8A98) 14%, transparent);
  --op-effort-stop-active-border: color-mix(in srgb, var(--op-fg-3, #8A8A98) 34%, transparent);
}
.op-effort-slider[data-tier="low"] {
  --op-effort-c1: color-mix(in srgb, var(--op-accent, #669DF6) 56%, var(--op-bg-2, #141418));
  --op-effort-c2: color-mix(in srgb, var(--op-accent, #669DF6) 86%, var(--op-bg-3, #1C1C22));
  --op-effort-c3: color-mix(in srgb, var(--op-accent, #669DF6) 78%, #FFFFFF);
}
.op-effort-slider[data-tier="mid"] {
  --op-effort-c1: color-mix(in srgb, var(--op-accent, #669DF6) 78%, var(--op-bg-1, #0B0B0E));
  --op-effort-c2: var(--op-accent, #669DF6);
  --op-effort-c3: color-mix(in srgb, var(--op-accent, #669DF6) 66%, #FFFFFF);
}
.op-effort-slider[data-tier="high"] {
  --op-effort-c1: var(--op-accent, #669DF6);
  --op-effort-c2: color-mix(in srgb, var(--op-accent, #669DF6) 62%, var(--op-effort-peak-a));
  --op-effort-c3: color-mix(in srgb, var(--op-effort-peak-a) 68%, #FFFFFF);
  --op-effort-stop-active-bg: color-mix(in srgb, var(--op-accent, #669DF6) 20%, transparent);
  --op-effort-stop-active-border: color-mix(in srgb, var(--op-accent, #669DF6) 50%, transparent);
}
.op-effort-slider[data-tier="max"] {
  --op-effort-c1: var(--op-accent, #669DF6);
  --op-effort-c2: color-mix(in srgb, var(--op-accent, #669DF6) 44%, var(--op-effort-peak-a));
  --op-effort-c3: color-mix(in srgb, var(--op-effort-peak-b) 78%, #FFFFFF);
  --op-effort-stop-active-bg: linear-gradient(
    135deg,
    color-mix(in srgb, var(--op-accent, #669DF6) 22%, transparent),
    color-mix(in srgb, var(--op-effort-peak-a) 24%, transparent),
    color-mix(in srgb, var(--op-effort-peak-b) 18%, transparent)
  );
  --op-effort-stop-active-border: color-mix(in srgb, var(--op-accent, #669DF6) 58%, transparent);
}

.op-effort-track-wrap {
  position: relative;
  width: 100%;
  padding: 1px 0;
}
.op-effort-track {
  position: relative;
  width: 100%;
  height: 24px;
  border-radius: 12px;
  background: var(--op-effort-track-bg);
  border: 1px solid var(--op-effort-track-border);
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.44),
    inset 0 -1px 0 rgba(255, 255, 255, 0.06);
  overflow: hidden;
  cursor: pointer;
  touch-action: none;
  outline: none;
  transition: border-color 160ms ease, box-shadow 180ms ease;
}
.op-effort-track:hover {
  border-color: color-mix(in srgb, var(--op-accent, #669DF6) 46%, var(--op-effort-track-border));
}
.op-effort-track:focus-visible {
  border-color: var(--op-accent, #669DF6);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--op-accent, #669DF6) 38%, transparent),
    inset 0 1px 3px rgba(0, 0, 0, 0.44);
}

.op-effort-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--op-effort-fill, 24px);
  border-radius: 12px;
  background: linear-gradient(90deg, var(--op-effort-c1) 0%, var(--op-effort-c2) 58%, var(--op-effort-c3) 100%);
  box-shadow:
    0 0 12px var(--op-effort-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 2px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  pointer-events: none;
  transition: width 200ms var(--op-ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}
.op-effort-slider[data-dragging="1"] .op-effort-fill {
  transition: none;
}
.op-effort-slider[data-crystal="1"] .op-effort-fill {
  opacity: 0.72;
}
.op-effort-fill::after {
  content: "";
  position: absolute;
  left: 3px;
  right: 3px;
  top: 1px;
  height: 44%;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.34) 0%, rgba(255, 255, 255, 0.02) 100%);
  pointer-events: none;
}
.op-effort-slider[data-crystal="1"] .op-effort-fill::after {
  opacity: 0;
}
.op-effort-sweep {
  position: absolute;
  inset: 0;
  width: 46%;
  background: linear-gradient(
    105deg,
    transparent 0%,
    rgba(255, 255, 255, 0.14) 36%,
    rgba(255, 255, 255, 0.38) 50%,
    rgba(255, 255, 255, 0.12) 64%,
    transparent 100%
  );
  animation: op-effort-sweep 3.2s ease-in-out infinite;
  opacity: calc(0.16 + var(--op-effort-energy, 0.4) * 0.54);
  pointer-events: none;
}
.op-effort-slider[data-tier="off"] .op-effort-sweep {
  animation: none;
  opacity: 0;
}

/* Layer 2: WebGL2 Voronoi Cut-Crystal canvas */
.op-effort-crystal-cv {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: 0.84;
}
html[data-op-effective-theme="light"] .op-effort-crystal-cv {
  mix-blend-mode: normal;
  opacity: 0.78;
}

/* Layer 3: Constellation starfield */
.op-effort-stars {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--op-effort-fill, 24px);
  border-radius: 12px;
  overflow: hidden;
  pointer-events: none;
  transition: width 200ms var(--op-ease-out, cubic-bezier(0.16, 1, 0.3, 1)), opacity 220ms ease;
}
.op-effort-slider[data-dragging="1"] .op-effort-stars {
  transition: opacity 220ms ease;
}
.op-effort-star {
  position: absolute;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  animation-name: op-effort-star-drift;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: left, opacity;
}
.op-effort-star[data-active="0"] {
  display: none;
}
.op-effort-star-dot {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 50%;
  background: radial-gradient(circle, #FFFFFF 0%, var(--op-effort-star) 56%, transparent 100%);
  box-shadow: 0 0 4px #FFFFFF, 0 0 9px var(--op-effort-glow);
  animation: op-effort-star-twinkle 1.9s ease-in-out infinite;
}
.op-effort-slider[data-tier="high"] .op-effort-star:nth-child(3n) .op-effort-star-dot::before,
.op-effort-slider[data-tier="max"] .op-effort-star:nth-child(2n) .op-effort-star-dot::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 8px;
  height: 1px;
  transform: translate(-50%, -50%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.92), transparent);
}
.op-effort-slider[data-tier="high"] .op-effort-star:nth-child(3n) .op-effort-star-dot::after,
.op-effort-slider[data-tier="max"] .op-effort-star:nth-child(2n) .op-effort-star-dot::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1px;
  height: 8px;
  transform: translate(-50%, -50%);
  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.92), transparent);
}

/* Layer 4: Faceted detent tick markers */
.op-effort-ticks {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.op-effort-tick {
  position: absolute;
  top: 50%;
  width: 3.5px;
  height: 3.5px;
  border-radius: 999px;
  transform: translate(-50%, -50%) rotate(45deg);
  background: rgba(255, 255, 255, 0.24);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.22);
  transition: background-color 160ms ease, opacity 160ms ease;
}
.op-effort-tick[data-reached="1"] {
  background: rgba(255, 255, 255, 0.72);
}
.op-effort-tick[data-active="1"] {
  opacity: 0;
}

/* Layer 5: Cut-Crystal faceted thumb knob */
.op-effort-knob {
  position: absolute;
  top: 50%;
  left: var(--op-effort-knob, 12px);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  background:
    radial-gradient(
      circle at 34% 28%,
      rgba(255, 255, 255, 0.98) 0%,
      color-mix(in srgb, var(--op-effort-c3) 26%, rgba(242, 246, 255, 0.94)) 42%,
      color-mix(in srgb, var(--op-effort-c2) 34%, rgba(203, 213, 225, 0.92)) 80%,
      rgba(148, 163, 184, 0.92) 100%
    );
  border: 1px solid rgba(255, 255, 255, 0.86);
  box-shadow:
    0 2px 7px rgba(0, 0, 0, 0.42),
    0 0 12px var(--op-effort-glow),
    inset 0 2px 3px rgba(255, 255, 255, 0.95),
    inset 0 -2px 3px rgba(15, 23, 42, 0.22);
  transition:
    left 200ms var(--op-ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
    transform 150ms var(--op-ease-spring, cubic-bezier(0.34, 1.4, 0.64, 1)),
    box-shadow 180ms ease;
}
.op-effort-knob::before {
  content: "";
  position: absolute;
  inset: 2.5px;
  border-radius: 50%;
  background: conic-gradient(
    from 25deg,
    rgba(255, 255, 255, 0.78) 0deg,
    color-mix(in srgb, var(--op-accent, #669DF6) 36%, transparent) 85deg,
    color-mix(in srgb, var(--op-effort-peak-a) 38%, transparent) 170deg,
    rgba(255, 255, 255, 0.68) 250deg,
    rgba(255, 255, 255, 0.78) 360deg
  );
  opacity: 0.76;
}
.op-effort-slider[data-dragging="1"] .op-effort-knob {
  transition: transform 120ms ease, box-shadow 140ms ease;
  transform: translate(-50%, -50%) scale(1.1);
}

/* Localized clickable stop pills */
.op-effort-labels {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 4px;
  margin-top: 6px;
  width: 100%;
}
.op-effort-stop {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 22px;
  padding: 0 4px;
  border-radius: calc(var(--op-radius-control, 10px) - 3px);
  border: 1px solid transparent;
  background: transparent;
  color: var(--op-effort-stop-color);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  outline: none;
  transition: color 130ms ease, background-color 130ms ease, border-color 130ms ease;
}
.op-effort-labels[data-dense="1"] .op-effort-stop {
  padding: 0 2px;
  font-size: 10.5px;
}
.op-effort-stop:hover:not(:disabled) {
  color: var(--op-effort-stop-active-color);
  background: color-mix(in srgb, var(--op-fg-1, #fff) 6%, transparent);
}
.op-effort-stop:focus-visible {
  border-color: var(--op-accent, #669DF6);
}
.op-effort-stop[data-active="1"] {
  color: var(--op-effort-stop-active-color);
  font-weight: 600;
  background: var(--op-effort-stop-active-bg);
  border-color: var(--op-effort-stop-active-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
.op-effort-error {
  margin-top: 5px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--op-status-err, #F06A63);
}

/* Compact Keyboard Footer Hint */
.op-mp-footer-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 12px;
  border-top: 1px solid var(--op-border-1, rgba(218, 228, 255, 0.06));
  background: color-mix(in srgb, var(--op-bg-0, #08090C) 44%, transparent);
  color: var(--op-fg-3, #8A8A98);
  font-size: 10px;
  letter-spacing: 0.02em;
}

/* Light Theme Calibration (Crystal & Alabaster) */
html[data-op-effective-theme="light"] .op-mp-rail {
  background: color-mix(in srgb, var(--op-bg-3, #ECEEF4) 68%, transparent);
}
html[data-op-effective-theme="light"] .op-mp-search {
  background: color-mix(in srgb, var(--op-bg-2, #F8FAFD) 82%, transparent);
}
html[data-op-effective-theme="light"] .op-mp-footer-hint {
  background: color-mix(in srgb, var(--op-bg-3, #ECEEF4) 55%, transparent);
}
html[data-op-effective-theme="light"] .op-effort-slider {
  --op-effort-track-bg: linear-gradient(
    180deg,
    color-mix(in srgb, var(--op-bg-3, #E8EEF8) 88%, var(--op-fg-1, #0F172A) 6%) 0%,
    color-mix(in srgb, var(--op-bg-2, #F5F7FB) 94%, transparent) 100%
  );
  --op-effort-track-border: var(--op-border-2, rgba(15, 23, 42, 0.14));
  --op-effort-stop-color: var(--op-fg-3, #64748B);
  --op-effort-stop-active-color: var(--op-fg-1, #0F172A);
  --op-effort-stop-active-bg: color-mix(in srgb, var(--op-accent, #2563EB) 13%, transparent);
  --op-effort-stop-active-border: color-mix(in srgb, var(--op-accent, #2563EB) 38%, transparent);
}
html[data-op-effective-theme="light"] .op-effort-track {
  box-shadow:
    inset 0 1px 3px rgba(15, 23, 42, 0.13),
    inset 0 -1px 0 rgba(255, 255, 255, 0.82);
}
html[data-op-effective-theme="light"] .op-effort-stop:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.05);
}
html[data-op-effective-theme="light"] .op-effort-tick {
  background: rgba(15, 23, 42, 0.24);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.52);
}
html[data-op-effective-theme="light"] .op-effort-tick[data-reached="1"] {
  background: rgba(255, 255, 255, 0.92);
}
html[data-op-effective-theme="light"] .op-effort-knob {
  border-color: color-mix(in srgb, var(--op-accent, #2563EB) 34%, #FFFFFF);
  box-shadow:
    0 2px 6px rgba(15, 23, 42, 0.22),
    0 0 10px var(--op-effort-glow),
    inset 0 2px 3px rgba(255, 255, 255, 0.96);
}

@media (prefers-reduced-motion: reduce) {
  .op-ambient-aura::before,
  .op-ambient-aura::after,
  html[data-op-enabled="1"] [data-composer-card]::before,
  .op-selection-pill,
  html[data-op-enabled="1"][data-op-choreography="1"] [data-op-arrive="1"],
  html[data-op-enabled="1"][data-op-choreography="1"] details[open][data-op-unfold="1"] > :not(summary),
  html[data-op-enabled="1"][data-op-choreography="1"] [data-op-complete-pulse="1"],
  .op-status-vial[data-vial-state="streaming"] .op-vial-liquid,
  .op-effort-sweep,
  .op-effort-star,
  .op-effort-star-dot {
    animation: none !important;
  }
  .op-effort-star[data-active="1"] {
    left: 50%;
    opacity: 0.75;
  }
  .op-ripple-host[data-ripple-mode="conv"] {
    display: none !important;
  }
}
`;
}
