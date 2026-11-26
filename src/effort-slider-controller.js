import { parseModelGroupConfig } from './settings-store.js';
// Obsidian Prism Unified Model Picker + Cut-Crystal Reasoning Effort Deck
// Occupies DSH's `conversation.input.model` slot at priority -1 (shadowing native ModelSelect
// while Obsidian Prism & the picker feature are enabled, and yielding back cleanly when disabled).
// Combines a fixed-width, zero-page-flip provider-rail model selector with a theme-adapted,
// fully localized (ZH/EN) Cut-Crystal WebGL2 + starfield reasoning effort slider.

import { isZhUi } from './i18n.js';
import {
  getProviderBrandSpec,
  renderProviderLogoSvg,
  resolveProviderBrandKey,
  setProviderBrandOverrides,
} from './provider-logos.js';

const OP_MP_FAVORITES_KEY = 'dsh-obsidian-prism:model-favorites:v1';
const OP_MP_T3_FAVORITES_KEY = 'dsh.t3-model-picker.favorites.v1';
const OP_MP_JUMP_COUNT = 9;
const OP_MP_FAVORITE_BOOST = 24;
const OP_MP_PANEL_WIDTH = 356;
const OP_MP_PANEL_MARGIN = 12;
const OP_MP_TRACK_HEIGHT = 24;
const OP_MP_KNOB_RADIUS = OP_MP_TRACK_HEIGHT / 2;
const OP_MP_MAX_STARS = 16;
const OP_MP_COMMIT_THROTTLE_MS = 110;
const OP_MP_COMMIT_DEADLINE_MS = 10000;

export const EFFORT_ROW_LABELS = [
  '推理等级',
  'Effort',
  '強度',
  '推論の強さ',
  'Esfuerzo',
  'Effort de raisonnement',
  'Aufwand',
  'Усилие',
  'Интенсивность рассуждений',
  'Esforço',
];

// Deterministic 16-star constellation along the lit light track (golden-ratio vertical spread)
export const STAR_SPECS = Array.from({ length: OP_MP_MAX_STARS }, (_, i) => {
  const frac = ((i * 0.61803398875 + 0.17) % 1);
  const yPct = 16 + frac * 68;
  const size = 1.7 + ((i * 37) % 10) * 0.13;
  const baseDur = 2.3 + ((i * 53) % 17) * 0.18;
  const phase = ((i * 0.38196601125 + 0.09) % 1);
  const bright = 0.62 + ((i * 29) % 10) * 0.042;
  return Object.freeze({
    id: i,
    yPct: Number(yPct.toFixed(1)),
    size: Number(size.toFixed(2)),
    baseDur: Number(baseDur.toFixed(2)),
    phase: Number(phase.toFixed(3)),
    bright: Number(bright.toFixed(3)),
  });
});

const OP_MP_COPY = {
  zh: {
    triggerFallback: '选择模型',
    triggerLoading: '加载模型…',
    triggerAria: (model) => `选择模型，当前 ${model}`,
    triggerAriaEffort: (model, effort) => `选择模型，当前 ${model}，推理等级 ${effort}`,
    panelAria: '模型与推理等级选择器',
    railAria: '模型提供方',
    railFavorites: '收藏模型',
    railAll: '全部模型',
    searchPlaceholder: '搜索模型或提供方…',
    searchClear: '清空搜索',
    badgeUnavailable: '不可用',
    badgeReasoning: '支持调节推理等级',
    favoriteAdd: '加入收藏',
    favoriteRemove: '取消收藏',
    emptyModels: '没有匹配的模型',
    emptyFavorites: '暂无收藏模型，点击右侧星标即可置顶常用模型',
    statusLoading: '正在加载模型目录…',
    errorLoad: (msg) => `模型目录加载失败：${msg}`,
    errorAction: (msg) => `切换失败：${msg}`,
    errorSessionInUse: '当前会话正被其他 DSH 实例占用，请先关闭其他实例后重试。',
    errorEffortTimeout: '推理等级切换超时，已恢复原档位。',
    actionRetry: '重试',
    effortTitle: '推理等级',
    effortAria: '推理等级滑块',
    hintKeys: '单击切换 · 双击/点外部关闭 · ⌘1-9 速切',
    hintKeysWin: '单击切换 · 双击/点外部关闭 · Ctrl+1-9 速切',
    warningGroupLoad: (name, msg) => `${name} 加载失败：${msg}`,
  },
  en: {
    triggerFallback: 'Select model',
    triggerLoading: 'Loading models…',
    triggerAria: (model) => `Select model, current ${model}`,
    triggerAriaEffort: (model, effort) => `Select model, current ${model}, reasoning effort ${effort}`,
    panelAria: 'Model and reasoning effort picker',
    railAria: 'Model providers',
    railFavorites: 'Favorites',
    railAll: 'All models',
    searchPlaceholder: 'Search models or providers…',
    searchClear: 'Clear search',
    badgeUnavailable: 'Unavailable',
    badgeReasoning: 'Supports reasoning effort',
    favoriteAdd: 'Add to favorites',
    favoriteRemove: 'Remove from favorites',
    emptyModels: 'No matching models',
    emptyFavorites: 'No favorites yet — star any model to pin it here',
    statusLoading: 'Loading model catalog…',
    errorLoad: (msg) => `Catalog failed to load: ${msg}`,
    errorAction: (msg) => `Switch failed: ${msg}`,
    errorSessionInUse: 'This session is held by another DSH instance. Quit other instances and retry.',
    errorEffortTimeout: 'Reasoning effort update timed out; reverted.',
    actionRetry: 'Retry',
    effortTitle: 'Reasoning Effort',
    effortAria: 'Reasoning effort slider',
    hintKeys: 'Click select · Dbl-click / outside closes · ⌘1-9',
    hintKeysWin: 'Click select · Dbl-click / outside closes · Ctrl+1-9',
    warningGroupLoad: (name, msg) => `${name} failed to load: ${msg}`,
  },
};

const EFFORT_LOCALIZED_MAP = {
  'provider-default': { zh: '默认', en: 'Default' },
  default: { zh: '默认', en: 'Default' },
  auto: { zh: '自动', en: 'Auto' },
  off: { zh: '关闭', en: 'Off' },
  none: { zh: '关闭', en: 'Off' },
  disabled: { zh: '关闭', en: 'Off' },
  '0': { zh: '关闭', en: 'Off' },
  minimal: { zh: '极低', en: 'Minimal' },
  min: { zh: '极低', en: 'Minimal' },
  xlow: { zh: '极低', en: 'Minimal' },
  very_low: { zh: '极低', en: 'Minimal' },
  'very-low': { zh: '极低', en: 'Minimal' },
  low: { zh: '低', en: 'Low' },
  medium: { zh: '中', en: 'Medium' },
  med: { zh: '中', en: 'Medium' },
  normal: { zh: '中', en: 'Medium' },
  balanced: { zh: '均衡', en: 'Balanced' },
  standard: { zh: '标准', en: 'Standard' },
  high: { zh: '高', en: 'High' },
  xhigh: { zh: '极高', en: 'XHigh' },
  extra_high: { zh: '极高', en: 'XHigh' },
  'extra-high': { zh: '极高', en: 'XHigh' },
  extrahigh: { zh: '极高', en: 'XHigh' },
  very_high: { zh: '极高', en: 'XHigh' },
  'very-high': { zh: '极高', en: 'XHigh' },
  veryhigh: { zh: '极高', en: 'XHigh' },
  max: { zh: '最高', en: 'Max' },
  maximum: { zh: '最高', en: 'Max' },
  ultra: { zh: '极限', en: 'Ultra' },
  extreme: { zh: '极限', en: 'Extreme' },
};

export function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function isOffEffortId(id) {
  if (typeof id !== 'string') return false;
  const k = id.trim().toLowerCase();
  return k === 'off' || k === 'none' || k === 'disabled' || k === '0';
}

/**
 * Localize an effort level object or effort ID into concise ZH or EN text.
 */
export function localizeEffortLabel(levelOrId, zh = true) {
  const lang = zh ? 'zh' : 'en';
  if (levelOrId === undefined || levelOrId === null) {
    return EFFORT_LOCALIZED_MAP.default[lang];
  }
  if (typeof levelOrId === 'string') {
    const key = levelOrId.trim().toLowerCase().replace(/\s+/g, '_');
    if (EFFORT_LOCALIZED_MAP[key]) return EFFORT_LOCALIZED_MAP[key][lang];
    return levelOrId.trim();
  }
  if (levelOrId.isDefault || levelOrId.key === 'provider-default') {
    return EFFORT_LOCALIZED_MAP.default[lang];
  }
  const idKey = typeof levelOrId.id === 'string'
    ? levelOrId.id.trim().toLowerCase().replace(/\s+/g, '_')
    : '';
  if (idKey && EFFORT_LOCALIZED_MAP[idKey]) {
    return EFFORT_LOCALIZED_MAP[idKey][lang];
  }
  const rawName = typeof levelOrId.rawLabel === 'string'
    ? levelOrId.rawLabel
    : (typeof levelOrId.label === 'string' ? levelOrId.label : (typeof levelOrId.name === 'string' ? levelOrId.name : ''));
  const nameKey = rawName.trim().toLowerCase().replace(/\s+/g, '_');
  if (nameKey && EFFORT_LOCALIZED_MAP[nameKey]) {
    return EFFORT_LOCALIZED_MAP[nameKey][lang];
  }
  return rawName.trim() || (typeof levelOrId.id === 'string' ? levelOrId.id : EFFORT_LOCALIZED_MAP.default[lang]);
}

/**
 * Derive exact model-supported effort choices from a DSH ModelDirectory snapshot.
 * Matches DSH ModelSelect.tsx semantics (including provider-default when defaultEffort === undefined).
 * When `opts?.zh` is provided as a boolean, `label` is localized; otherwise preserves raw model labels.
 */
export function buildEffortLevels(snapshot, opts = null) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { levels: [], activeIndex: -1, modelKey: null, model: null, current: null };
  }
  const current = snapshot.current;
  const groups = Array.isArray(snapshot.groups) ? snapshot.groups : [];
  if (!current || typeof current.provider !== 'string' || typeof current.model !== 'string') {
    return { levels: [], activeIndex: -1, modelKey: null, model: null, current: null };
  }

  let matchedModel = null;
  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i];
    if (!group || group.id !== current.provider || !Array.isArray(group.models)) continue;
    for (let j = 0; j < group.models.length; j += 1) {
      const m = group.models[j];
      if (m && m.id === current.model) {
        matchedModel = m;
        break;
      }
    }
    if (matchedModel) break;
  }

  const modelKey = `${current.provider}\0${current.model}`;
  const reasoning = matchedModel?.reasoning;
  if (!reasoning || !Array.isArray(reasoning.efforts) || reasoning.efforts.length === 0) {
    return { levels: [], activeIndex: -1, modelKey, model: matchedModel, current };
  }

  const hasLangOpt = Boolean(opts && typeof opts.zh === 'boolean');
  const zh = hasLangOpt ? opts.zh : false;
  const levels = [];
  if (reasoning.defaultEffort === undefined) {
    const rawLabel = 'Default';
    levels.push({
      key: 'provider-default',
      id: undefined,
      rawLabel,
      label: hasLangOpt ? localizeEffortLabel({ key: 'provider-default', isDefault: true }, zh) : rawLabel,
      isDefault: true,
    });
  }
  for (let i = 0; i < reasoning.efforts.length; i += 1) {
    const e = reasoning.efforts[i];
    if (!e || typeof e.id !== 'string' || !e.id) continue;
    const rawLabel = typeof e.name === 'string' && e.name.trim() ? e.name.trim() : e.id;
    levels.push({
      key: `effort:${e.id}`,
      id: e.id,
      rawLabel,
      label: hasLangOpt ? localizeEffortLabel({ id: e.id, rawLabel, isDefault: false }, zh) : rawLabel,
      isDefault: false,
    });
  }

  if (levels.length === 0) {
    return { levels: [], activeIndex: -1, modelKey, model: matchedModel, current };
  }

  const effectiveId = current.reasoningEffort !== undefined ? current.reasoningEffort : reasoning.defaultEffort;
  let activeIndex = 0;
  if (effectiveId === undefined) {
    const defIdx = levels.findIndex((lv) => lv.isDefault);
    activeIndex = defIdx >= 0 ? defIdx : 0;
  } else {
    const idx = levels.findIndex((lv) => lv.id === effectiveId);
    activeIndex = idx >= 0 ? idx : 0;
  }

  return { levels, activeIndex, modelKey, model: matchedModel, current };
}

/**
 * Compute continuous visual intensity, tier, star count, and star drift speed for any level count.
 */
export function computeEffortVisualState(ratioOrIndex, count, activeLevelId) {
  const ratio = count > 1
    ? clamp01(ratioOrIndex > 1 ? ratioOrIndex / (count - 1) : ratioOrIndex)
    : 1;
  const isOff = isOffEffortId(activeLevelId);

  let tier = 'mid';
  if (isOff) {
    tier = 'off';
  } else if (ratio >= 0.96) {
    tier = 'max';
  } else if (ratio >= 0.66) {
    tier = 'high';
  } else if (ratio >= 0.34) {
    tier = 'mid';
  } else {
    tier = 'low';
  }

  const energy = isOff ? 0 : clamp01(0.22 + ratio * 0.78);
  const starCount = isOff ? 0 : Math.min(OP_MP_MAX_STARS, Math.max(3, Math.round(3 + ratio * (OP_MP_MAX_STARS - 3))));
  const speedFactor = isOff ? 0 : Number((0.68 + ratio * 1.48).toFixed(3));

  return { ratio, tier, energy, starCount, speedFactor, isOff };
}

/**
 * Compute exact knob center position ratio so the lit bar always wraps the thumb circle cleanly.
 */
export function computeKnobFillRatio(progress, trackWidth = 328, trackHeight = OP_MP_TRACK_HEIGHT) {
  const p = clamp01(progress);
  const w = Math.max(trackHeight + 2, Number(trackWidth) || 328);
  const r = trackHeight * 0.5;
  const centerPx = r + p * (w - trackHeight);
  return clamp01(centerPx / w);
}

/**
 * Resolve crystal-prism-core spectrum code from Obsidian Prism settings & effort tier.
 */
export function resolveCrystalAccentForSettings(settings, tier, isDark) {
  const accent = settings?.accent || 'follow';
  if (accent === 'amethyst') return 'iris';
  if (accent === 'amber') return 'amber';
  if (accent === 'cobalt') return 'cobalt';
  if (accent === 'terracotta') return 'warm';
  if (accent === 'prism') return 'default';
  if (accent === 'emerald' || accent === 'rose') return 'default';

  const preset = isDark ? settings?.darkPreset : settings?.lightPreset;
  if (preset === 'warm' || preset === 'alabaster') {
    return tier === 'max' ? 'amber' : 'warm';
  }
  if (tier === 'max') return 'default';
  if (tier === 'high') return 'iris';
  return 'cobalt';
}

// ── Search scoring (tiered tokenized + subsequence fuzzy + favorite boost) ────

function mpNormalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function mpLengthPenalty(value, query) {
  return Math.min(Math.max(value.length - query.length, 0), 30) * 0.01;
}

function mpBoundaryIndex(value, query, seps) {
  let cursor = value.indexOf(query);
  while (cursor !== -1) {
    if (cursor > 0 && seps.includes(value[cursor - 1])) return cursor;
    cursor = value.indexOf(query, cursor + 1);
  }
  return null;
}

function mpScoreSubsequence(value, query) {
  let score = 0;
  let cursor = 0;
  let previous = -1;
  for (let i = 0; i < query.length; i += 1) {
    const found = value.indexOf(query[i], cursor);
    if (found === -1) return null;
    if (previous !== -1) {
      const gap = found - previous - 1;
      if (gap > 0) score += gap * 3;
    } else {
      score += found * 2;
    }
    previous = found;
    cursor = found + 1;
  }
  return score + mpLengthPenalty(value, query);
}

function mpScoreField(value, query, base) {
  if (!value || !query) return null;
  if (value === query) return base;
  if (value.startsWith(query)) return base + 2 + mpLengthPenalty(value, query);
  const boundary = mpBoundaryIndex(value, query, [' ', '-', '_', '/', '.']);
  if (boundary !== null) return base + 4 + boundary * 2 + mpLengthPenalty(value, query);
  const inc = value.indexOf(query);
  if (inc !== -1) return base + 6 + inc * 2 + mpLengthPenalty(value, query);
  if (query.length >= 3) {
    const fuzzy = mpScoreSubsequence(value, query);
    if (fuzzy !== null) return base + 100 + fuzzy;
  }
  return null;
}

function mpSearchText(row) {
  return mpNormalize([
    row.model?.name,
    row.model?.id,
    row.model?.description,
    row.displayGroupName,
    row.displayGroupTooltip,
    row.displayGroupId,
    row.provider,
    row.providerName,
  ].filter((v) => typeof v === 'string' && v.length > 0).join(' '));
}

export function scoreModelRow(row, query) {
  const tokens = mpNormalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const name = mpNormalize(row.model?.name);
  const id = mpNormalize(row.model?.id);
  const desc = mpNormalize(row.model?.description);
  const groupName = mpNormalize(row.displayGroupName);
  const groupTip = mpNormalize(row.displayGroupTooltip);
  const prov = mpNormalize(row.provider);
  const provName = mpNormalize(row.providerName);
  const combined = mpSearchText(row);
  const fields = [name, id, desc, groupName, groupTip, prov, provName, combined].filter(Boolean);
  let total = 0;
  for (let ti = 0; ti < tokens.length; ti += 1) {
    const token = tokens[ti];
    let best = null;
    for (let fi = 0; fi < fields.length; fi += 1) {
      const s = mpScoreField(fields[fi], token, fi * 10);
      if (s !== null && (best === null || s < best)) best = s;
    }
    if (best === null) return null;
    total += best;
  }
  return row.favorite ? total - OP_MP_FAVORITE_BOOST : total;
}

// ── Provider naming, glyphs, shortcuts ────────────────────────────────────────

function mpIsMacPlatform() {
  const platform = typeof navigator === 'undefined' ? '' : String(navigator.platform ?? '');
  return /mac|iphone|ipad|ipod/i.test(platform);
}

function mpJumpLabel(index) {
  return `${mpIsMacPlatform() ? '⌘' : 'Ctrl+'}${index + 1}`;
}

function mpToggleLabel() {
  return mpIsMacPlatform() ? '⌘⇧M' : 'Ctrl+Shift+M';
}

function mpJumpIndexFromEvent(event) {
  const primary = mpIsMacPlatform() ? event.metaKey : event.ctrlKey;
  if (!primary || event.shiftKey || event.altKey) return null;
  if (!/^[1-9]$/u.test(String(event.key || ''))) return null;
  return Number(event.key) - 1;
}

function mpIsToggleChord(event) {
  const primary = mpIsMacPlatform() ? event.metaKey : event.ctrlKey;
  if (!primary || !event.shiftKey || event.altKey || event.repeat) return false;
  return event.code === 'KeyM' || String(event.key || '').toLowerCase() === 'm';
}

function mpIsRendered(node) {
  return node?.isConnected === true && typeof node.getClientRects === 'function' && node.getClientRects().length > 0;
}

function mpDisplayProviderName(name) {
  const value = String(name ?? '');
  if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/u.test(value) || !/[_-]/u.test(value)) return value;
  return value
    .split(/[_-]+/u)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function mpInitialsOf(name) {
  const words = String(name ?? '').replace(/[_-]+/gu, ' ').split(/\s+/u).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
  return words.slice(0, 2).map((w) => Array.from(w)[0] ?? '').join('').toUpperCase();
}

const OP_MP_PROVIDER_HUES = [
  '#669DF6',
  '#9B72CB',
  '#38B889',
  '#D97757',
  '#E5A93B',
  '#5CC6FC',
  '#E86A8A',
  '#7A93F8',
];

function mpProviderColor(providerId) {
  const id = String(providerId || '').toLowerCase();
  if (id.includes('deepseek')) return '#4F8BFF';
  if (id.includes('antigravity') || id.includes('agy')) return '#4285F4';
  if (id.includes('codex')) return '#5C7CFA';
  if (id.includes('aws')) return '#FF9900';
  if (id.includes('anthropic') || id.includes('claude')) return '#D97757';
  if (id.includes('openai')) return '#38B889';
  if (id.includes('google') || id.includes('gemini')) return '#7A93F8';
  if (id.includes('kimi') || id.includes('moonshot')) return '#5CC6FC';
  if (id.includes('qwen') || id.includes('aliyun')) return '#A07CE8';
  if (id.includes('zhipu') || id.includes('glm')) return '#E5A93B';
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return OP_MP_PROVIDER_HUES[hash % OP_MP_PROVIDER_HUES.length];
}

// ── Magpie Upstream Group Normalization ───────────────────────────────────────
// DSH's settings.yaml packs Magpie models into protocol buckets (`magpie`,
// `magpie-responses`, `magpie-anthropic`) because llm-pi-ai requires one API
// protocol per provider entry, while encoding the real Magpie upstream group
// as the `<slug>/` prefix of each model ID (`group/*`, `codex/*`, `agy-cli/*`,
// `aws-quick/*`, ...). Regroup those gateway buckets into Magpie's logical
// groups while preserving the real DSH `provider` ID on every row for select(),
// favorites, and routability checks.

const MAGPIE_GROUP_META = Object.freeze({
  group: {
    zh: '路由组',
    en: 'Routing Groups',
    tooltipZh: '路由组',
    tooltipEn: 'Routing Groups',
    order: 0,
  },
  codex: {
    zh: 'Codex',
    en: 'Codex',
    tooltipZh: 'Codex',
    tooltipEn: 'Codex',
    order: 10,
  },
  'agy-cli': {
    zh: 'Antigravity',
    en: 'Antigravity',
    tooltipZh: 'Antigravity (local agy CLI)',
    tooltipEn: 'Antigravity (local agy CLI)',
    order: 20,
  },
  antigravity: {
    zh: 'Antigravity',
    en: 'Antigravity',
    tooltipZh: 'Antigravity (local agy CLI)',
    tooltipEn: 'Antigravity (local agy CLI)',
    order: 21,
  },
  'aws-quick': {
    zh: 'AWS Quick',
    en: 'AWS Quick',
    tooltipZh: 'AWS Quick',
    tooltipEn: 'AWS Quick',
    order: 30,
  },
  qwen: { zh: 'Qwen', en: 'Qwen', order: 40 },
  deepseek: { zh: 'DeepSeek', en: 'DeepSeek', order: 50 },
  openai: { zh: 'OpenAI', en: 'OpenAI', order: 60 },
  anthropic: { zh: 'Anthropic', en: 'Anthropic', order: 70 },
  gemini: { zh: 'Gemini', en: 'Gemini', order: 80 },
  google: { zh: 'Google', en: 'Google', order: 81 },
  kimi: { zh: 'Kimi', en: 'Kimi', order: 90 },
  moonshot: { zh: 'Moonshot', en: 'Moonshot', order: 91 },
  zhipu: { zh: 'Zhipu', en: 'Zhipu', order: 92 },
  minimax: { zh: 'MiniMax', en: 'MiniMax', order: 93 },
  openrouter: { zh: 'OpenRouter', en: 'OpenRouter', order: 94 },
  bedrock: { zh: 'AWS Bedrock', en: 'AWS Bedrock', order: 95 },
  ollama: { zh: 'Ollama', en: 'Ollama', order: 96 },
});

function isMagpieGatewayProviderId(id) {
  const s = String(id || '').trim().toLowerCase();
  return s === 'magpie' || s.startsWith('magpie-') || s.startsWith('magpie_');
}

function extractMagpieModelSlug(modelId) {
  const s = String(modelId || '').trim();
  const slash = s.indexOf('/');
  if (slash <= 0) return null;
  const slug = s.slice(0, slash).trim().toLowerCase();
  return slug || null;
}

function formatMagpieSlugFallback(slug) {
  const value = String(slug ?? '').trim();
  if (!value) return 'Magpie';
  if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/u.test(value)) return value;
  return value
    .split(/[_-]+/u)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function resolveMagpieGroupMeta(slug, zh, overrides = null) {
  const meta = MAGPIE_GROUP_META[slug];
  const ov = overrides && overrides[slug];
  if (ov) {
    const base = meta ? (zh ? meta.zh : meta.en) : formatMagpieSlugFallback(slug);
    const name = ov.name || base;
    const order = typeof ov.order === 'number' ? ov.order : (meta ? meta.order : 1000);
    return { name, tooltip: ov.name || (meta ? (zh ? (meta.tooltipZh || meta.zh) : (meta.tooltipEn || meta.en)) : name), order };
  }
  if (meta) {
    const name = zh ? meta.zh : meta.en;
    const tooltip = zh ? (meta.tooltipZh || meta.zh) : (meta.tooltipEn || meta.en);
    return { name, tooltip, order: meta.order };
  }
  const name = formatMagpieSlugFallback(slug);
  return { name, tooltip: name, order: 1000 };
}

export function buildModelPickerCatalog(rawGroups, opts = null) {
  const groups = Array.isArray(rawGroups) ? rawGroups : [];
  const zh = Boolean(opts?.zh);
  const favoriteKeys = opts?.favoriteKeys instanceof Set ? opts.favoriteKeys : new Set();
  const routableKnown = Boolean(opts?.routableKnown);
  const routableSet = opts?.routableSet instanceof Set ? opts.routableSet : new Set();
  const groupOverrides = opts?.groupOverrides && typeof opts.groupOverrides === 'object' ? opts.groupOverrides : null;

  const beforeMagpie = [];
  const afterMagpie = [];
  const magpieBuckets = new Map();
  let seenMagpie = false;
  let magpieSeq = 0;

  for (let gi = 0; gi < groups.length; gi += 1) {
    const group = groups[gi];
    if (!group || typeof group.id !== 'string') continue;
    const models = Array.isArray(group.models) ? group.models : [];
    const rawProviderName = mpDisplayProviderName(group.name || group.id);
    const isMagpie = isMagpieGatewayProviderId(group.id);

    if (!isMagpie) {
      const bucket = {
        id: group.id,
        name: rawProviderName,
        tooltip: rawProviderName,
        isVirtualMagpie: false,
        rawProviderId: group.id,
        rows: [],
      };
      for (let mi = 0; mi < models.length; mi += 1) {
        const model = models[mi];
        if (!model || typeof model.id !== 'string') continue;
        const key = `${group.id}\0${model.id}`;
        const hasReasoning = Boolean(model?.reasoning && Array.isArray(model.reasoning.efforts) && model.reasoning.efforts.length > 0);
        bucket.rows.push({
          key,
          provider: group.id,
          providerName: rawProviderName,
          displayGroupId: bucket.id,
          displayGroupName: bucket.name,
          displayGroupTooltip: bucket.tooltip,
          model,
          groupIndex: 0,
          modelIndex: bucket.rows.length,
          favorite: favoriteKeys.has(key),
          unavailable: routableKnown && !routableSet.has(group.id),
          hasReasoning,
        });
      }
      if (seenMagpie) afterMagpie.push(bucket);
      else beforeMagpie.push(bucket);
      continue;
    }

    seenMagpie = true;
    for (let mi = 0; mi < models.length; mi += 1) {
      const model = models[mi];
      if (!model || typeof model.id !== 'string') continue;
      const slug = extractMagpieModelSlug(model.id);
      let bucketKey;
      let bucketName;
      let bucketTooltip;
      let bucketOrder;
      let isVirtual;

      if (slug) {
        const meta = resolveMagpieGroupMeta(slug, zh, groupOverrides);
        bucketKey = `magpie-group:${slug}`;
        bucketName = meta.name;
        bucketTooltip = meta.tooltip;
        bucketOrder = meta.order;
        isVirtual = true;
      } else {
        bucketKey = group.id;
        bucketName = rawProviderName;
        bucketTooltip = rawProviderName;
        bucketOrder = 2000;
        isVirtual = false;
      }

      let bucket = magpieBuckets.get(bucketKey);
      if (!bucket) {
        bucket = {
          id: bucketKey,
          name: bucketName,
          tooltip: bucketTooltip,
          isVirtualMagpie: isVirtual,
          rawProviderId: group.id,
          order: bucketOrder,
          firstSeen: magpieSeq,
          rows: [],
        };
        magpieSeq += 1;
        magpieBuckets.set(bucketKey, bucket);
      }

      const key = `${group.id}\0${model.id}`;
      const hasReasoning = Boolean(model?.reasoning && Array.isArray(model.reasoning.efforts) && model.reasoning.efforts.length > 0);
      bucket.rows.push({
        key,
        provider: group.id,
        providerName: rawProviderName,
        displayGroupId: bucket.id,
        displayGroupName: bucket.name,
        displayGroupTooltip: bucket.tooltip,
        model,
        groupIndex: 0,
        modelIndex: bucket.rows.length,
        favorite: favoriteKeys.has(key),
        unavailable: routableKnown && !routableSet.has(group.id),
        hasReasoning,
      });
    }
  }

  const sortedMagpie = Array.from(magpieBuckets.values()).sort(
    (a, b) => (a.order - b.order) || (a.firstSeen - b.firstSeen),
  );

  const combined = [...beforeMagpie, ...sortedMagpie, ...afterMagpie];
  const displayGroups = [];
  const allRows = [];

  for (let di = 0; di < combined.length; di += 1) {
    const bucket = combined[di];
    for (let ri = 0; ri < bucket.rows.length; ri += 1) {
      const row = bucket.rows[ri];
      row.groupIndex = di;
      row.modelIndex = ri;
      allRows.push(row);
    }
    const unavailable = routableKnown && (
      bucket.rows.length > 0
        ? bucket.rows.every((r) => r.unavailable)
        : !routableSet.has(bucket.rawProviderId)
    );
    displayGroups.push({
      id: bucket.id,
      name: bucket.name,
      tooltip: bucket.tooltip,
      count: bucket.rows.length,
      unavailable,
      isVirtualMagpie: bucket.isVirtualMagpie,
      rows: bucket.rows,
    });
  }

  return { displayGroups, allRows };
}

function mpReadEffectiveDark() {
  const attr = document.documentElement?.getAttribute?.('data-op-effective-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return Boolean(
    document.body?.hasAttribute?.('data-ds-dark-theme') ||
    document.documentElement?.hasAttribute?.('data-ds-dark-theme') ||
    document.documentElement?.classList?.contains?.('dark')
  );
}

function mpIsReducedMotion() {
  try {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

function mpResolveAmbientFloat(settings) {
  if (!settings) return 0.72;
  if (settings.ambientGlow === 'rich') return 1.0;
  if (settings.ambientGlow === 'subtle') return 0.72;
  return 0.48;
}

// ── Persistent Favorites & Routable Providers Stores ──────────────────────────

function mpReadFavoritesList() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const parse = (key) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed
        .filter((e) => e && typeof e === 'object' && typeof e.provider === 'string' && typeof e.model === 'string')
        .map((e) => ({ provider: e.provider, model: e.model }));
    } catch {
      return null;
    }
  };
  const own = parse(OP_MP_FAVORITES_KEY);
  if (own !== null) return own;
  // Seamless one-way migration from dsh-t3-model-picker favorites if present
  const migrated = parse(OP_MP_T3_FAVORITES_KEY);
  if (migrated && migrated.length > 0) {
    try {
      window.localStorage.setItem(OP_MP_FAVORITES_KEY, JSON.stringify(migrated));
    } catch {
      // ignore
    }
    return migrated;
  }
  return [];
}

export function createModelFavoritesStore() {
  let value = mpReadFavoritesList();
  const listeners = new Set();
  return {
    getSnapshot: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    toggle(provider, model) {
      const exists = value.some((e) => e.provider === provider && e.model === model);
      value = exists
        ? value.filter((e) => !(e.provider === provider && e.model === model))
        : [...value, { provider, model }];
      try {
        window.localStorage.setItem(OP_MP_FAVORITES_KEY, JSON.stringify(value));
      } catch {
        // ignore storage quota errors
      }
      for (const listener of [...listeners]) {
        try { listener(); } catch { /* ignore */ }
      }
    },
  };
}

export function createRoutableProvidersStore(remote) {
  let value = { status: 'idle', providers: [] };
  const listeners = new Set();
  let inflight;
  const publish = (next) => {
    value = next;
    for (const listener of [...listeners]) {
      try { listener(); } catch { /* ignore */ }
    }
  };
  const load = () => {
    if (inflight !== undefined) return inflight;
    if (!remote?.session || typeof remote.session.modelCatalog !== 'function') {
      return Promise.resolve();
    }
    publish({ status: 'loading', providers: value.providers });
    inflight = Promise.resolve()
      .then(() => remote.session.modelCatalog())
      .then((res) => {
        if (!res || !res.ok) throw new Error(res?.error ? `${res.error.code}: ${res.error.message}` : 'catalog failed');
        publish({ status: 'ready', providers: Array.isArray(res.value?.routableProviders) ? [...res.value.routableProviders] : [] });
      })
      .catch(() => {
        publish({ status: 'error', providers: [] });
      })
      .finally(() => {
        inflight = undefined;
      });
    return inflight;
  };
  return {
    getSnapshot: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    load,
  };
}

export function createPickerToggleRegistry() {
  const mounted = new Set();
  const pickTarget = () => {
    let target = null;
    for (const entry of mounted) {
      if (entry.enabled()) target = entry;
    }
    return target;
  };
  const attachGlobalListener = () => {
    if (typeof window === 'undefined') return () => {};
    const onKeyDown = (event) => {
      if (!mpIsToggleChord(event)) return;
      const target = pickTarget();
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      target.toggle();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => { window.removeEventListener('keydown', onKeyDown, true); };
  };
  return {
    register(entry) {
      mounted.add(entry);
      return () => { mounted.delete(entry); };
    },
    attachGlobalListener,
  };
}

// ── React UI Factory ──────────────────────────────────────────────────────────

export function createEffortSliderSlotComponent({ React, createPortal, getCrystalCore, store }) {
  const {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
  } = React;
  const h = React.createElement;

  function useExternalSnapshot(extStore) {
    const subscribe = useCallback((fn) => extStore.subscribe(fn), [extStore]);
    const getSnapshot = useCallback(() => extStore.getSnapshot(), [extStore]);
    return useSyncExternalStore(subscribe, getSnapshot);
  }

  function svgIcon(children, { className, size = 14, filled = false } = {}) {
    return h('svg', {
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      fill: filled ? 'currentColor' : 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      focusable: false,
      className,
    }, children);
  }

  function SearchIcon({ className }) {
    return svgIcon([
      h('circle', { key: 'c', cx: 11, cy: 11, r: 8 }),
      h('path', { key: 'p', d: 'm21 21-4.3-4.3' }),
    ], { className, size: 13 });
  }

  function ClearIcon({ className }) {
    return svgIcon([
      h('path', { key: 'a', d: 'M18 6 6 18' }),
      h('path', { key: 'b', d: 'm6 6 12 12' }),
    ], { className, size: 12 });
  }

  function ChevronDownIcon({ className }) {
    return svgIcon(h('path', { d: 'm6 9 6 6 6-6' }), { className, size: 13 });
  }

  function CheckIcon({ className }) {
    return svgIcon(h('path', { d: 'M20 6 9 17l-5-5' }), { className, size: 13 });
  }

  function StarIcon({ className, filled }) {
    return svgIcon(
      h('polygon', {
        points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2',
      }),
      { className, size: 13, filled },
    );
  }

  function AllGridIcon({ className }) {
    return svgIcon([
      h('rect', { key: 'a', x: 3, y: 3, width: 7, height: 7, rx: 1.5 }),
      h('rect', { key: 'b', x: 14, y: 3, width: 7, height: 7, rx: 1.5 }),
      h('rect', { key: 'c', x: 3, y: 14, width: 7, height: 7, rx: 1.5 }),
      h('rect', { key: 'd', x: 14, y: 14, width: 7, height: 7, rx: 1.5 }),
    ], { className, size: 14 });
  }

  function PrismFacetIcon({ className, size = 12 }) {
    return svgIcon([
      h('polygon', { key: 'p', points: '12 2 21 12 12 22 3 12 12 2' }),
      h('path', { key: 'l', d: 'M12 2v20' }),
    ], { className, size });
  }

  let logoUidSeq = 0;

  function ProviderGlyph({ providerId, name, modelId, modelName, className, size = 14 }) {
    const uidRef = useRef(null);
    if (!uidRef.current) {
      logoUidSeq += 1;
      uidRef.current = `op-lg-${logoUidSeq}`;
    }
    const spec = getProviderBrandSpec(providerId, name, modelId, modelName);
    if (spec) {
      return h('span', {
        className,
        'data-op-mp-glyph': providerId,
        'data-op-mp-brand': spec.key,
        'data-op-mp-logo': '1',
        'data-op-mp-mono': spec.mono ? '1' : '0',
        style: { '--op-prov-hue': spec.hue },
      }, renderProviderLogoSvg(h, spec, { size, className: 'op-mp-logo-svg', uid: uidRef.current }));
    }
    return h('span', {
      className,
      'data-op-mp-glyph': providerId,
      'data-op-mp-logo': '0',
      style: { '--op-prov-hue': mpProviderColor(providerId) },
    }, mpInitialsOf(name));
  }

  // ── WebGL2 Cut-Crystal Optical Track Canvas ───────────────────────────────

  function CrystalTrackCanvas({ enabled, progress, tier, settings, wakeSignal, pointerRef }) {
    const canvasRef = useRef(null);
    const stateRef = useRef({ progress, tier, settings });
    stateRef.current = { progress, tier, settings };

    const instRef = useRef(null);
    const rafRef = useRef(0);
    const lastMsRef = useRef(0);
    const kickRef = useRef(null);

    useEffect(() => {
      if (!enabled) return undefined;
      const canvas = canvasRef.current;
      const core = typeof getCrystalCore === 'function' ? getCrystalCore() : null;
      if (!canvas || !core || typeof core.mountCrystalPrismBar !== 'function') return undefined;

      let disposed = false;
      const inst = core.mountCrystalPrismBar(canvas, {
        getState() {
          const cur = stateRef.current;
          const isDark = mpReadEffectiveDark();
          const rect = canvas.getBoundingClientRect();
          const p = pointerRef.current;
          return {
            progress: computeKnobFillRatio(cur.progress, rect.width || 328, OP_MP_TRACK_HEIGHT),
            ambient: mpResolveAmbientFloat(cur.settings),
            isDark,
            reduceMotion: mpIsReducedMotion(),
            accentTone: resolveCrystalAccentForSettings(cur.settings, cur.tier, isDark),
            pointerX: p.active ? p.x : -9999,
            pointerY: p.active ? p.y : -9999,
          };
        },
      });
      instRef.current = inst;

      const tick = (now) => {
        if (disposed || !instRef.current) return;
        const dt = lastMsRef.current ? Math.min(0.05, Math.max(0.001, (now - lastMsRef.current) / 1000)) : 0.016;
        lastMsRef.current = now;
        try {
          instRef.current.render(dt);
        } catch {
          return;
        }
        const reduced = mpIsReducedMotion();
        const curTier = stateRef.current.tier;
        const keepRunning = !reduced && (pointerRef.current.active || curTier !== 'off' || document.visibilityState === 'visible');
        if (keepRunning) {
          rafRef.current = window.requestAnimationFrame(tick);
        } else {
          rafRef.current = 0;
        }
      };

      const kick = () => {
        if (disposed) return;
        if (rafRef.current) return;
        lastMsRef.current = 0;
        rafRef.current = window.requestAnimationFrame(tick);
      };
      kickRef.current = kick;
      kick();

      const ro = typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            try { instRef.current?.resize(); } catch { /* ignore */ }
            kick();
          })
        : null;
      if (ro) ro.observe(canvas);

      return () => {
        disposed = true;
        kickRef.current = null;
        if (rafRef.current) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        if (ro) ro.disconnect();
        try { inst.dispose(); } catch { /* ignore */ }
        instRef.current = null;
      };
    }, [enabled]);

    useEffect(() => {
      if (!enabled || !instRef.current) return;
      if (wakeSignal > 0 && typeof instRef.current.triggerWake === 'function') {
        try { instRef.current.triggerWake(); } catch { /* ignore */ }
      }
      if (typeof kickRef.current === 'function') {
        kickRef.current();
      } else {
        try { instRef.current.render(0.016); } catch { /* ignore */ }
      }
    }, [enabled, progress, tier, settings?.accent, settings?.darkPreset, settings?.lightPreset, settings?.themeMode, settings?.ambientGlow, wakeSignal]);

    if (!enabled) return null;
    return h('canvas', { className: 'op-effort-crystal-cv', ref: canvasRef, 'aria-hidden': 'true' });
  }

  // ── Docked Cut-Crystal Reasoning Effort Slider (Zero-Page-Flip) ───────────

  function EffortSliderDock({
    levels,
    activeIndex,
    disabled,
    settings,
    zh,
    copy,
    onCommitIndex,
    errorText,
  }) {
    const [dragRatio, setDragRatio] = useState(null);
    const [wakeSignal, setWakeSignal] = useState(0);
    const [trackWidth, setTrackWidth] = useState(328);

    const trackRef = useRef(null);
    const pointerRef = useRef({ active: false, x: -9999, y: -9999 });
    const dragStateRef = useRef({ active: false, pointerId: null, lastIdx: activeIndex, lastCommitMs: 0 });
    const levelsRef = useRef(levels);
    levelsRef.current = levels;
    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    const count = levels.length;
    const safeIdx = Math.max(0, Math.min(count - 1, activeIndex));
    const displayRatio = dragRatio !== null
      ? dragRatio
      : (count > 1 ? safeIdx / (count - 1) : 1);
    const previewIdx = dragRatio !== null && count > 1
      ? Math.round(dragRatio * (count - 1))
      : safeIdx;
    const activeLevel = levels[previewIdx] || levels[0];
    const visual = computeEffortVisualState(displayRatio, count, activeLevel?.id);
    const crystalActive = Boolean(settings?.effortSliderCrystal && !mpIsReducedMotion());

    useLayoutEffect(() => {
      const el = trackRef.current;
      if (!el) return undefined;
      const measure = () => {
        const w = el.getBoundingClientRect().width;
        if (w > 40) setTrackWidth(w);
      };
      measure();
      if (typeof ResizeObserver !== 'function') return undefined;
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }, [count]);

    const ratioFromClientX = (clientX) => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const usable = Math.max(1, rect.width - OP_MP_TRACK_HEIGHT);
      return clamp01((clientX - rect.left - OP_MP_KNOB_RADIUS) / usable);
    };

    const updatePointerCoords = (clientX, clientY, active) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      pointerRef.current = {
        active,
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      if (active) {
        el.style.setProperty('--op-knob-px', `${(clientX - rect.left).toFixed(1)}px`);
        el.style.setProperty('--op-knob-py', `${(clientY - rect.top).toFixed(1)}px`);
      } else {
        el.style.setProperty('--op-knob-px', '-9999px');
        el.style.setProperty('--op-knob-py', '-9999px');
      }
    };

    const commitIdx = (idx, immediate) => {
      const bounded = Math.max(0, Math.min(levelsRef.current.length - 1, idx));
      if (bounded === activeIndexRef.current && !dragStateRef.current.active) return;
      const now = Date.now();
      if (!immediate && bounded === dragStateRef.current.lastIdx) return;
      if (!immediate && now - dragStateRef.current.lastCommitMs < OP_MP_COMMIT_THROTTLE_MS) return;
      dragStateRef.current.lastIdx = bounded;
      dragStateRef.current.lastCommitMs = now;
      setWakeSignal((n) => n + 1);
      onCommitIndex(bounded);
    };

    const onPointerDown = (e) => {
      if (disabled || count <= 1) return;
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const ratio = ratioFromClientX(e.clientX);
      const idx = Math.round(ratio * (count - 1));
      dragStateRef.current = {
        active: true,
        pointerId: e.pointerId,
        lastIdx: activeIndexRef.current,
        lastCommitMs: 0,
      };
      updatePointerCoords(e.clientX, e.clientY, true);
      setDragRatio(ratio);
      try { trackRef.current?.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      commitIdx(idx, false);
    };

    const onPointerMove = (e) => {
      updatePointerCoords(e.clientX, e.clientY, true);
      if (!dragStateRef.current.active) return;
      e.preventDefault();
      e.stopPropagation();
      const ratio = ratioFromClientX(e.clientX);
      const idx = Math.round(ratio * (count - 1));
      setDragRatio(ratio);
      commitIdx(idx, false);
    };

    const finishDrag = (e) => {
      if (!dragStateRef.current.active) return;
      e.preventDefault();
      e.stopPropagation();
      const ratio = ratioFromClientX(e.clientX);
      const idx = Math.round(ratio * (count - 1));
      dragStateRef.current.active = false;
      try { trackRef.current?.releasePointerCapture?.(dragStateRef.current.pointerId); } catch { /* ignore */ }
      setDragRatio(null);
      commitIdx(idx, true);
    };

    const onPointerLeave = () => {
      if (!dragStateRef.current.active) {
        updatePointerCoords(-9999, -9999, false);
      }
    };

    const onKeyDown = (e) => {
      if (disabled || count <= 1) return;
      let next = null;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, safeIdx - 1);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(count - 1, safeIdx + 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = count - 1;
      if (next === null) return;
      e.preventDefault();
      e.stopPropagation();
      if (next !== safeIdx) {
        setWakeSignal((n) => n + 1);
        onCommitIndex(next);
      }
    };

    const knobPx = OP_MP_KNOB_RADIUS + displayRatio * Math.max(0, trackWidth - OP_MP_TRACK_HEIGHT);
    const fillWidthPx = Math.min(trackWidth, knobPx + OP_MP_KNOB_RADIUS);

    return h('div', {
      className: 'op-mp-effort-dock',
      'data-tier': visual.tier,
      'data-crystal': crystalActive ? '1' : '0',
      'data-dragging': dragRatio !== null ? '1' : '0',
      'data-disabled': disabled ? '1' : '0',
      onMouseDown: (e) => { e.stopPropagation(); },
    },
      h('div', { className: 'op-mp-effort-head' },
        h('span', { className: 'op-mp-effort-title' },
          h(PrismFacetIcon, { className: 'op-mp-effort-icon', size: 12 }),
          h('span', null, copy.effortTitle),
        ),
        h('span', { className: 'op-mp-effort-badge', 'data-tier': visual.tier },
          h('span', { className: 'op-mp-effort-badge-dot', 'aria-hidden': 'true' }),
          activeLevel ? activeLevel.label : '',
        ),
      ),
      h('div', {
        className: 'op-effort-slider',
        'data-tier': visual.tier,
        'data-crystal': crystalActive ? '1' : '0',
        'data-dragging': dragRatio !== null ? '1' : '0',
        style: {
          '--op-effort-energy': visual.energy.toFixed(3),
          '--op-effort-knob': `${knobPx.toFixed(1)}px`,
          '--op-effort-fill': `${fillWidthPx.toFixed(1)}px`,
        },
      },
        h('div', { className: 'op-effort-track-wrap' },
          h('div', {
            ref: trackRef,
            className: 'op-effort-track',
            role: 'slider',
            tabIndex: disabled ? -1 : 0,
            'aria-label': copy.effortAria,
            'aria-valuemin': 0,
            'aria-valuemax': Math.max(0, count - 1),
            'aria-valuenow': previewIdx,
            'aria-valuetext': activeLevel ? activeLevel.label : '',
            onPointerDown,
            onPointerMove,
            onPointerUp: finishDrag,
            onPointerCancel: finishDrag,
            onPointerLeave,
            onKeyDown,
          },
            h('div', { className: 'op-effort-fill', 'aria-hidden': 'true' },
              h('div', { className: 'op-effort-sweep' }),
            ),
            h(CrystalTrackCanvas, {
              enabled: crystalActive,
              progress: displayRatio,
              tier: visual.tier,
              settings,
              wakeSignal,
              pointerRef,
            }),
            h('div', {
              className: 'op-effort-stars',
              'aria-hidden': 'true',
              style: { opacity: visual.isOff ? 0 : 1 },
            },
              STAR_SPECS.map((star, idx) => {
                const active = idx < visual.starCount;
                const dur = visual.speedFactor > 0 ? Math.max(0.8, star.baseDur / visual.speedFactor) : star.baseDur;
                const delay = -(star.phase * dur);
                return h('span', {
                  key: star.id,
                  className: 'op-effort-star',
                  'data-active': active ? '1' : '0',
                  style: {
                    top: `${star.yPct}%`,
                    animationDuration: `${dur.toFixed(2)}s`,
                    animationDelay: `${delay.toFixed(2)}s`,
                  },
                },
                  h('span', {
                    className: 'op-effort-star-dot',
                    style: {
                      width: `${star.size}px`,
                      height: `${star.size}px`,
                      '--op-star-b': star.bright,
                      animationDelay: `${(-(star.phase * 2.1)).toFixed(2)}s`,
                    },
                  }),
                );
              }),
            ),
            h('div', { className: 'op-effort-ticks', 'aria-hidden': 'true' },
              levels.map((lv, idx) => {
                const p = count > 1 ? idx / (count - 1) : 1;
                const cx = OP_MP_KNOB_RADIUS + p * Math.max(0, trackWidth - OP_MP_TRACK_HEIGHT);
                return h('span', {
                  key: lv.key,
                  className: 'op-effort-tick',
                  'data-reached': idx <= previewIdx ? '1' : '0',
                  'data-active': idx === previewIdx ? '1' : '0',
                  style: { left: `${cx.toFixed(1)}px` },
                });
              }),
            ),
            h('div', { className: 'op-effort-knob', 'aria-hidden': 'true' }),
          ),
        ),
        h('div', {
          className: 'op-effort-labels',
          'data-dense': count >= 5 ? '1' : '0',
        },
          levels.map((lv, idx) =>
            h('button', {
              key: lv.key,
              type: 'button',
              className: 'op-effort-stop',
              'data-active': idx === previewIdx ? '1' : '0',
              disabled,
              title: lv.label,
              onMouseDown: (e) => { e.preventDefault(); e.stopPropagation(); },
              onClick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (disabled || idx === safeIdx) return;
                setWakeSignal((n) => n + 1);
                onCommitIndex(idx);
              },
            }, lv.label),
          ),
        ),
      ),
      errorText ? h('div', { className: 'op-effort-error', role: 'alert' }, errorText) : null,
    );
  }

  // ── Unified Obsidian Prism Model & Reasoning Effort Picker ────────────────

  return function ObsidianPrismModelPicker({
    locked,
    available,
    directory,
    load,
    select,
    favorites,
    routable,
    toggleRegistry,
  }) {
    const state = useExternalSnapshot(directory);
    const catalog = useExternalSnapshot(routable);
    const favoriteList = useExternalSnapshot(favorites);
    const settings = useSyncExternalStore(store.subscribe, store.get);

    const zh = isZhUi(settings);
    const copy = zh ? OP_MP_COPY.zh : OP_MP_COPY.en;

    const [open, setOpen] = useState(false);
    const [pane, setPane] = useState('favorites');
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const [menuPos, setMenuPos] = useState(null);
    const [toast, setToast] = useState(null);
    const [optimisticEffortIdx, setOptimisticEffortIdx] = useState(null);
    const [effortError, setEffortError] = useState('');

    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const panelRef = useRef(null);
    const searchRef = useRef(null);
    const railRef = useRef(null);
    const rowRefs = useRef([]);
    const toastSeq = useRef(0);
    const lastActionRef = useRef('load');
    const effortDeadlineRef = useRef(0);
    const prevModelKeyRef = useRef(null);
    const pendingSelectKeyRef = useRef(null);

    const groups = Array.isArray(state?.groups) ? state.groups : [];
    const current = state?.current ?? null;
    const favoriteKeys = useMemo(
      () => new Set(favoriteList.map((e) => `${e.provider}\0${e.model}`)),
      [favoriteList],
    );
    const routableKnown = catalog.status === 'ready';
    const routableSet = useMemo(() => new Set(catalog.providers), [catalog.providers]);

    const groupConfigText = settings?.modelGroupConfig || '';
    const groupOverrides = useMemo(() => {
      const ov = parseModelGroupConfig(groupConfigText);
      setProviderBrandOverrides(ov);
      return ov;
    }, [groupConfigText]);
    const { displayGroups, allRows } = useMemo(
      () => buildModelPickerCatalog(groups, { zh, favoriteKeys, routableKnown, routableSet, groupOverrides }),
      [groups, zh, favoriteKeys, routableKnown, routableSet, groupOverrides],
    );

    const rowByKey = useMemo(() => new Map(allRows.map((r) => [r.key, r])), [allRows]);
    const currentRow = current === null ? undefined : rowByKey.get(`${current.provider}\0${current.model}`);

    // Derived localized effort levels for the currently selected model
    const parsedEffort = useMemo(() => buildEffortLevels(state, { zh }), [state, zh]);
    const effortLevels = parsedEffort.levels;
    const effectiveEffortIdx = optimisticEffortIdx !== null && optimisticEffortIdx < effortLevels.length
      ? optimisticEffortIdx
      : parsedEffort.activeIndex;
    const activeEffortLevel = effectiveEffortIdx >= 0 ? effortLevels[effectiveEffortIdx] : null;
    const triggerVisual = effortLevels.length > 0
      ? computeEffortVisualState(effectiveEffortIdx, effortLevels.length, activeEffortLevel?.id)
      : null;

    // Clear optimistic effort when model changes or host catches up
    useEffect(() => {
      if (parsedEffort.modelKey !== prevModelKeyRef.current) {
        prevModelKeyRef.current = parsedEffort.modelKey;
        setOptimisticEffortIdx(null);
        setEffortError('');
        if (effortDeadlineRef.current) {
          window.clearTimeout(effortDeadlineRef.current);
          effortDeadlineRef.current = 0;
        }
      }
    }, [parsedEffort.modelKey]);

    useEffect(() => {
      if (optimisticEffortIdx !== null && parsedEffort.activeIndex === optimisticEffortIdx) {
        setOptimisticEffortIdx(null);
        setEffortError('');
        if (effortDeadlineRef.current) {
          window.clearTimeout(effortDeadlineRef.current);
          effortDeadlineRef.current = 0;
        }
      }
    }, [parsedEffort.activeIndex, optimisticEffortIdx]);

    useEffect(() => () => {
      if (effortDeadlineRef.current) window.clearTimeout(effortDeadlineRef.current);
    }, []);

    // Auto-clear toast after 4.5s
    useEffect(() => {
      if (!toast) return undefined;
      const timer = window.setTimeout(() => { setToast(null); }, 4500);
      return () => { window.clearTimeout(timer); };
    }, [toast]);

    const providers = useMemo(
      () => displayGroups.map((g) => ({
        id: g.id,
        name: g.name,
        tooltip: g.tooltip || g.name,
        count: g.count,
        unavailable: g.unavailable,
      })),
      [displayGroups],
    );

    const searching = mpNormalize(query).length > 0;

    const listed = useMemo(() => {
      if (searching) {
        const scored = [];
        for (let i = 0; i < allRows.length; i += 1) {
          const row = allRows[i];
          const score = scoreModelRow(row, query);
          if (score !== null) scored.push({ row, score });
        }
        scored.sort((a, b) => {
          if (a.score !== b.score) return a.score - b.score;
          const af = a.row.favorite ? 0 : 1;
          const bf = b.row.favorite ? 0 : 1;
          if (af !== bf) return af - bf;
          if (a.row.groupIndex !== b.row.groupIndex) return a.row.groupIndex - b.row.groupIndex;
          if (a.row.modelIndex !== b.row.modelIndex) return a.row.modelIndex - b.row.modelIndex;
          return mpSearchText(a.row).localeCompare(mpSearchText(b.row));
        });
        const sections = [];
        const byGroup = new Map();
        for (let i = 0; i < scored.length; i += 1) {
          const { row } = scored[i];
          let sec = byGroup.get(row.displayGroupId);
          if (!sec) {
            sec = { id: row.displayGroupId, name: row.displayGroupName, rows: [], unavailable: row.unavailable };
            byGroup.set(row.displayGroupId, sec);
            sections.push(sec);
          } else if (!row.unavailable) {
            sec.unavailable = false;
          }
          sec.rows.push(row);
        }
        return { grouped: true, sections, rows: scored.map((e) => e.row) };
      }
      if (pane === 'favorites') {
        const rows = allRows
          .filter((r) => r.favorite)
          .sort((a, b) => (a.groupIndex - b.groupIndex) || (a.modelIndex - b.modelIndex));
        return { grouped: false, sections: [], rows };
      }
      if (pane === 'all') {
        const sections = [];
        const byGroup = new Map();
        for (let i = 0; i < allRows.length; i += 1) {
          const row = allRows[i];
          let sec = byGroup.get(row.displayGroupId);
          if (!sec) {
            sec = { id: row.displayGroupId, name: row.displayGroupName, rows: [], unavailable: row.unavailable };
            byGroup.set(row.displayGroupId, sec);
            sections.push(sec);
          } else if (!row.unavailable) {
            sec.unavailable = false;
          }
          sec.rows.push(row);
        }
        return { grouped: true, sections, rows: allRows };
      }
      const rows = allRows
        .filter((r) => r.displayGroupId === pane)
        .sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || (a.modelIndex - b.modelIndex));
      return { grouped: false, sections: [], rows };
    }, [allRows, pane, query, searching]);

    const visibleRows = listed.rows;
    const busy = state?.status === 'loading';
    const waiting = current === null && (state?.status === 'idle' || state?.status === 'loading');
    const modelLabel = waiting
      ? copy.triggerLoading
      : (currentRow?.model?.name || current?.model || copy.triggerFallback);
    const effortDisplayLabel = activeEffortLevel?.label;
    const triggerTitle = effortDisplayLabel
      ? `${modelLabel} · ${effortDisplayLabel} · ${mpToggleLabel()}`
      : `${modelLabel} · ${mpToggleLabel()}`;
    const triggerAria = waiting
      ? copy.triggerLoading
      : current === null
        ? copy.triggerFallback
        : effortDisplayLabel
          ? copy.triggerAriaEffort(modelLabel, effortDisplayLabel)
          : copy.triggerAria(modelLabel);
    const triggerUnavailable = currentRow?.unavailable === true
      || (current !== null && routableKnown && !routableSet.has(current.provider));

    const reload = useCallback(() => {
      lastActionRef.current = 'load';
      load();
    }, [load]);

    const close = useCallback((restoreFocus) => {
      setOpen(false);
      setQuery('');
      setHighlight(0);
      setEffortError('');
      if (restoreFocus === true) {
        queueMicrotask(() => { triggerRef.current?.focus(); });
      }
    }, []);

    const show = useCallback(() => {
      triggerRef.current?.focus();
      const hasFavs = favoriteList.some((f) => rowByKey.has(`${f.provider}\0${f.model}`));
      const currentPane = currentRow?.displayGroupId;
      const initialPane = hasFavs
        ? 'favorites'
        : (currentPane && providers.some((p) => p.id === currentPane) ? currentPane : 'all');
      setPane(initialPane);
      setQuery('');
      setHighlight(0);
      setEffortError('');
      setOpen(true);
      reload();
      routable.load();
    }, [currentRow, favoriteList, providers, reload, routable, rowByKey]);

    const toggle = useCallback(() => {
      if (open) close(true);
      else show();
    }, [close, open, show]);

    const pushToast = useCallback((text) => {
      toastSeq.current += 1;
      setToast({ seq: toastSeq.current, text });
    }, []);

    const chooseModel = useCallback((row, opts = null) => {
      if (!row) return;
      const closeOnDone = opts?.close === true;
      const isAlreadyCurrent = current !== null && current.provider === row.provider && current.model === row.model.id;
      if (isAlreadyCurrent) {
        if (closeOnDone) close(true);
        return;
      }
      if (pendingSelectKeyRef.current === row.key) {
        if (closeOnDone) close(true);
        return;
      }
      lastActionRef.current = 'select';
      pendingSelectKeyRef.current = row.key;
      const payload = {
        provider: row.provider,
        model: row.model.id,
        ...(row.model.reasoning?.defaultEffort === undefined
          ? {}
          : { reasoningEffort: row.model.reasoning.defaultEffort }),
      };
      if (closeOnDone) {
        close(true);
      }
      void select(payload).then((res) => {
        if (pendingSelectKeyRef.current === row.key) {
          pendingSelectKeyRef.current = null;
        }
        if (!res) return;
        if (res.ok) return;
        pushToast(
          res.error?.code === 'session/writer-held'
            ? copy.errorSessionInUse
            : copy.errorAction(`${res.error?.code || 'error'}: ${res.error?.message || ''}`),
        );
      }).catch(() => {
        if (pendingSelectKeyRef.current === row.key) {
          pendingSelectKeyRef.current = null;
        }
      });
    }, [close, copy, current, pushToast, select]);

    const commitEffortIndex = useCallback((idx) => {
      if (!current || !effortLevels[idx]) return;
      const target = effortLevels[idx];
      setOptimisticEffortIdx(idx);
      setEffortError('');
      if (effortDeadlineRef.current) {
        window.clearTimeout(effortDeadlineRef.current);
      }
      effortDeadlineRef.current = window.setTimeout(() => {
        effortDeadlineRef.current = 0;
        setOptimisticEffortIdx(null);
        setEffortError(copy.errorEffortTimeout);
      }, OP_MP_COMMIT_DEADLINE_MS);

      const payload = {
        provider: current.provider,
        model: current.model,
        ...(target.id === undefined ? {} : { reasoningEffort: target.id }),
      };
      lastActionRef.current = 'select';
      void select(payload).then((res) => {
        if (effortDeadlineRef.current) {
          window.clearTimeout(effortDeadlineRef.current);
          effortDeadlineRef.current = 0;
        }
        if (!res) return;
        if (!res.ok) {
          setOptimisticEffortIdx(null);
          const msg = res.error?.code === 'session/writer-held'
            ? copy.errorSessionInUse
            : copy.errorAction(`${res.error?.code || 'error'}: ${res.error?.message || ''}`);
          setEffortError(msg);
        }
      });
    }, [copy, current, effortLevels, select]);

    // Auto-focus search input when panel opens
    useLayoutEffect(() => {
      if (!open) return undefined;
      searchRef.current?.focus({ preventScroll: true });
      const frame = window.requestAnimationFrame(() => {
        searchRef.current?.focus({ preventScroll: true });
      });
      return () => { window.cancelAnimationFrame(frame); };
    }, [open]);

    useEffect(() => {
      if (!open) return;
      setHighlight(0);
    }, [open, pane, query]);

    useEffect(() => {
      if (highlight >= visibleRows.length) setHighlight(0);
    }, [highlight, visibleRows.length]);

    useEffect(() => {
      if (!open) return;
      rowRefs.current[highlight]?.scrollIntoView?.({ block: 'nearest' });
    }, [highlight, open]);

    // Outside click closes panel
    useEffect(() => {
      if (!open) return undefined;
      const onMouseDown = (event) => {
        if (rootRef.current?.contains(event.target) === true) return;
        if (panelRef.current?.contains(event.target) === true) return;
        close(false);
      };
      document.addEventListener('mousedown', onMouseDown);
      return () => { document.removeEventListener('mousedown', onMouseDown); };
    }, [close, open]);

    // Document-wide jump chords (Cmd/Ctrl+1..9) while panel is open
    useEffect(() => {
      if (!open) return undefined;
      const onKeyDown = (event) => {
        if (busy) return;
        const idx = mpJumpIndexFromEvent(event);
        if (idx === null) return;
        const row = visibleRows[idx];
        if (!row) return;
        if (row.unavailable && row.provider !== current?.provider) return;
        event.preventDefault();
        event.stopPropagation();
        chooseModel(row);
      };
      window.addEventListener('keydown', onKeyDown, true);
      return () => { window.removeEventListener('keydown', onKeyDown, true); };
    }, [busy, chooseModel, current, open, visibleRows]);

    // Register with global Cmd/Ctrl+Shift+M toggle registry
    useEffect(() => {
      if (!available || !toggleRegistry) return undefined;
      return toggleRegistry.register({
        enabled: () => locked !== true && mpIsRendered(rootRef.current),
        toggle,
      });
    }, [available, locked, toggle, toggleRegistry]);

    // Portaled fixed-width positioning above trigger (flips below if needed)
    useLayoutEffect(() => {
      if (!open) {
        setMenuPos(null);
        return undefined;
      }
      const place = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const width = panelRef.current?.offsetWidth || OP_MP_PANEL_WIDTH;
        const height = panelRef.current?.offsetHeight || 360;
        let left = rect.right - width;
        let top = rect.top - 8 - height;
        if (top < OP_MP_PANEL_MARGIN && rect.bottom + 8 + height <= window.innerHeight - OP_MP_PANEL_MARGIN) {
          top = rect.bottom + 8;
        }
        left = Math.min(Math.max(left, OP_MP_PANEL_MARGIN), Math.max(OP_MP_PANEL_MARGIN, window.innerWidth - width - OP_MP_PANEL_MARGIN));
        top = Math.min(Math.max(top, OP_MP_PANEL_MARGIN), Math.max(OP_MP_PANEL_MARGIN, window.innerHeight - height - OP_MP_PANEL_MARGIN));
        setMenuPos({ left: Math.round(left), top: Math.round(top) });
      };
      place();
      const ro = typeof ResizeObserver === 'function' && panelRef.current
        ? new ResizeObserver(place)
        : null;
      if (ro && panelRef.current) ro.observe(panelRef.current);
      window.addEventListener('scroll', place, true);
      window.addEventListener('resize', place);
      return () => {
        if (ro) ro.disconnect();
        window.removeEventListener('scroll', place, true);
        window.removeEventListener('resize', place);
      };
    }, [open, pane, query, effortLevels.length, state?.status]);

    if (!available) return null;

    const moveHighlight = (delta) => {
      const count = visibleRows.length;
      if (count === 0) return;
      setHighlight((prev) => (prev + delta + count) % count);
    };

    const onPanelKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.target?.getAttribute?.('role') === 'slider') return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const active = document.activeElement;
        if (active instanceof HTMLButtonElement && active.dataset.opMpRail !== undefined) return;
        event.preventDefault();
        moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (event.key === 'Enter' && document.activeElement === searchRef.current) {
        event.preventDefault();
        const target = visibleRows[highlight];
        if (target && !(target.unavailable && target.provider !== current?.provider)) {
          chooseModel(target);
        }
      }
    };

    const onRailKeyDown = (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const buttons = Array.from(railRef.current?.querySelectorAll('button[data-op-mp-rail]') || []);
      const idx = buttons.indexOf(document.activeElement);
      if (idx === -1 || buttons.length === 0) return;
      event.preventDefault();
      const next = buttons[(idx + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length];
      next?.focus();
    };

    const selectRailPane = (nextPane) => {
      setPane(nextPane);
      setQuery('');
      setHighlight(0);
      queueMicrotask(() => { searchRef.current?.focus({ preventScroll: true }); });
    };

    rowRefs.current = [];

    const renderModelRow = (row, index) => {
      const selected = current !== null && current.provider === row.provider && current.model === row.model.id;
      const highlighted = index === highlight;
      const rowUnavailable = row.unavailable && !selected;
      const rowDisabled = busy || rowUnavailable;
      const showProviderMeta = searching || pane === 'favorites' || pane === 'all';
      const rowBrand = resolveProviderBrandKey(row.displayGroupId, row.displayGroupName, row.model.id, row.model.name);
      const paneBrand = (!searching && pane !== 'favorites' && pane !== 'all')
        ? resolveProviderBrandKey(pane, row.displayGroupName)
        : null;
      const showRowLogo = showProviderMeta || Boolean(rowBrand && rowBrand !== paneBrand);
      const shortcut = index >= 0 && index < OP_MP_JUMP_COUNT && !rowDisabled ? mpJumpLabel(index) : null;

      return h('div', {
        key: row.key,
        className: 'op-mp-row-wrap',
        'data-highlighted': highlighted ? '1' : '0',
        'data-selected': selected ? '1' : '0',
        'data-unavailable': row.unavailable ? '1' : '0',
        onMouseEnter: () => { setHighlight(index); },
      },
        h('button', {
          ref: (node) => { rowRefs.current[index] = node; },
          type: 'button',
          className: 'op-mp-row',
          'data-op-mp-row': index,
          disabled: rowUnavailable,
          'aria-busy': busy ? 'true' : undefined,
          onMouseDown: (e) => { e.preventDefault(); },
          onClick: () => {
            if (rowUnavailable) return;
            if (busy && pendingSelectKeyRef.current !== row.key) return;
            chooseModel(row, { close: false });
          },
          onDoubleClick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (rowUnavailable) return;
            chooseModel(row, { close: true });
          },
        },
          showRowLogo
            ? h(ProviderGlyph, {
                providerId: row.displayGroupId,
                name: row.displayGroupName,
                modelId: row.model.id,
                modelName: row.model.name,
                className: 'op-mp-row-glyph',
                size: 13,
              })
            : null,
          h('span', { className: 'op-mp-row-body' },
            h('span', { className: 'op-mp-row-title' },
              h('span', { className: 'op-mp-row-name' }, row.model.name || row.model.id),
              row.hasReasoning
                ? h('span', { className: 'op-mp-reasoning-dot', title: copy.badgeReasoning },
                    h(PrismFacetIcon, { className: 'op-mp-reasoning-svg', size: 10 }),
                  )
                : null,
            ),
            showProviderMeta
              ? h('span', { className: 'op-mp-row-sub' }, row.displayGroupName)
              : null,
          ),
          row.unavailable
            ? h('span', { className: 'op-mp-badge' }, copy.badgeUnavailable)
            : null,
          selected
            ? h(CheckIcon, { className: 'op-mp-check' })
            : null,
        ),
        h('div', { className: 'op-mp-row-actions' },
          h('button', {
            type: 'button',
            className: 'op-mp-star-btn',
            'data-starred': row.favorite ? '1' : '0',
            'aria-label': row.favorite ? copy.favoriteRemove : copy.favoriteAdd,
            title: row.favorite ? copy.favoriteRemove : copy.favoriteAdd,
            onMouseDown: (e) => { e.preventDefault(); e.stopPropagation(); },
            onClick: (e) => {
              e.stopPropagation();
              favorites.toggle(row.provider, row.model.id);
            },
          }, h(StarIcon, { className: 'op-mp-star-svg', filled: row.favorite })),
          shortcut ? h('kbd', { className: 'op-mp-kbd' }, shortcut) : null,
        ),
      );
    };

    const renderSection = (section) =>
      h('div', { className: 'op-mp-section', key: section.id },
        h('div', { className: 'op-mp-section-head' },
          h(ProviderGlyph, { providerId: section.id, name: section.name, className: 'op-mp-section-glyph', size: 11 }),
          h('span', { className: 'op-mp-section-name' }, section.name),
          section.unavailable ? h('span', { className: 'op-mp-badge' }, copy.badgeUnavailable) : null,
        ),
        section.rows.map((row) => renderModelRow(row, visibleRows.indexOf(row))),
      );

    const resultNodes = listed.grouped
      ? listed.sections.map(renderSection)
      : listed.rows.map((row, idx) => renderModelRow(row, idx));

    const empty = state?.status === 'ready' && visibleRows.length === 0;
    const emptyText = !searching && pane === 'favorites' ? copy.emptyFavorites : copy.emptyModels;

    const statusNodes = [];
    if (state?.status === 'loading' && visibleRows.length === 0) {
      statusNodes.push(h('div', { className: 'op-mp-status', key: 'loading' }, copy.statusLoading));
    }
    if (state?.error && lastActionRef.current === 'load') {
      statusNodes.push(h('div', { className: 'op-mp-error', key: 'load-err' },
        h('span', null, copy.errorLoad(state.error)),
        h('button', { type: 'button', className: 'op-mp-retry', onClick: reload }, copy.actionRetry),
      ));
    }
    if (Array.isArray(state?.failures)) {
      for (let i = 0; i < state.failures.length; i += 1) {
        const f = state.failures[i];
        statusNodes.push(h('div', { className: 'op-mp-warning', key: `f:${f.id}` },
          h('span', null, copy.warningGroupLoad(f.name || f.id, f.message || '')),
          h('button', { type: 'button', className: 'op-mp-retry', onClick: reload }, copy.actionRetry),
        ));
      }
    }

    const rail = h('div', {
      ref: railRef,
      className: 'op-mp-rail',
      role: 'toolbar',
      'aria-label': copy.railAria,
      'aria-orientation': 'vertical',
      onKeyDown: onRailKeyDown,
    },
      h('div', { className: 'op-mp-rail-inner' },
        h('button', {
          type: 'button',
          'data-op-mp-rail': 'favorites',
          className: 'op-mp-rail-btn',
          'data-active': !searching && pane === 'favorites' ? '1' : '0',
          'aria-pressed': !searching && pane === 'favorites',
          'aria-label': copy.railFavorites,
          title: copy.railFavorites,
          onMouseDown: (e) => { e.preventDefault(); },
          onClick: () => { selectRailPane('favorites'); },
        }, h(StarIcon, { filled: !searching && pane === 'favorites', className: 'op-mp-rail-icon' })),
        h('button', {
          type: 'button',
          'data-op-mp-rail': 'all',
          className: 'op-mp-rail-btn',
          'data-active': !searching && pane === 'all' ? '1' : '0',
          'aria-pressed': !searching && pane === 'all',
          'aria-label': copy.railAll,
          title: copy.railAll,
          onMouseDown: (e) => { e.preventDefault(); },
          onClick: () => { selectRailPane('all'); },
        }, h(AllGridIcon, { className: 'op-mp-rail-icon' })),
        h('div', { className: 'op-mp-rail-divider' }),
        providers.map((prov) => {
          const isUnavail = Boolean(prov.unavailable);
          const isOn = !searching && pane === prov.id;
          const tip = prov.tooltip || prov.name;
          return h('button', {
            key: prov.id,
            type: 'button',
            'data-op-mp-rail': prov.id,
            className: 'op-mp-rail-btn',
            'data-active': isOn ? '1' : '0',
            'data-unavailable': isUnavail ? '1' : '0',
            'aria-pressed': isOn,
            'aria-label': tip,
            title: isUnavail ? `${tip} — ${copy.badgeUnavailable}` : tip,
            onMouseDown: (e) => { e.preventDefault(); },
            onClick: () => { selectRailPane(prov.id); },
          }, h(ProviderGlyph, { providerId: prov.id, name: prov.name, className: 'op-mp-rail-glyph', size: 16 }));
        }),
      ),
    );

    const panel = h('div', {
      ref: panelRef,
      className: 'op-mp-panel',
      'data-op-mp-panel': '1',
      style: menuPos ? { left: `${menuPos.left}px`, top: `${menuPos.top}px` } : { visibility: 'hidden', left: 0, top: 0 },
      role: 'dialog',
      'aria-label': copy.panelAria,
      onKeyDown: onPanelKeyDown,
    },
      h('div', { className: 'op-mp-upper' },
        rail,
        h('div', { className: 'op-mp-main' },
          h('div', { className: 'op-mp-search' },
            h(SearchIcon, { className: 'op-mp-search-icon' }),
            h('input', {
              ref: searchRef,
              className: 'op-mp-search-input',
              type: 'text',
              value: query,
              placeholder: copy.searchPlaceholder,
              'aria-label': copy.searchPlaceholder,
              autoComplete: 'off',
              spellCheck: false,
              onChange: (e) => { setQuery(e.target.value); },
              onMouseDown: (e) => { e.stopPropagation(); },
            }),
            query
              ? h('button', {
                  type: 'button',
                  className: 'op-mp-search-clear',
                  'aria-label': copy.searchClear,
                  onMouseDown: (e) => { e.preventDefault(); },
                  onClick: () => {
                    setQuery('');
                    searchRef.current?.focus();
                  },
                }, h(ClearIcon, { className: 'op-mp-clear-svg' }))
              : h('kbd', { className: 'op-mp-search-kbd' }, mpToggleLabel()),
          ),
          statusNodes,
          h('div', { className: 'op-mp-list' },
            resultNodes,
            empty ? h('div', { className: 'op-mp-empty' }, emptyText) : null,
          ),
        ),
      ),
      effortLevels.length > 0
        ? h(EffortSliderDock, {
            levels: effortLevels,
            activeIndex: effectiveEffortIdx,
            disabled: Boolean(locked || busy),
            settings,
            zh,
            copy,
            onCommitIndex: commitEffortIndex,
            errorText: effortError,
          })
        : null,
      h('div', { className: 'op-mp-footer-hint' },
        h('span', null, mpIsMacPlatform() ? copy.hintKeys : copy.hintKeysWin),
      ),
    );

    const triggerTier = triggerVisual?.tier || 'none';

    return h('div', {
      ref: rootRef,
      className: 'op-mp-root',
      onMouseDown: (e) => {
        if (e.target instanceof Element && e.target.closest('button') !== null) {
          e.preventDefault();
        }
      },
    },
      h('button', {
        ref: triggerRef,
        type: 'button',
        className: 'op-mp-trigger',
        'data-open': open ? '1' : '0',
        'data-tier': triggerTier,
        'aria-label': triggerAria,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        title: triggerTitle,
        disabled: locked,
        onClick: toggle,
      },
        current !== null
          ? h(ProviderGlyph, {
              providerId: currentRow?.displayGroupId || current.provider,
              name: currentRow?.displayGroupName || mpDisplayProviderName(current.provider),
              modelId: current.model,
              modelName: currentRow?.model?.name,
              className: 'op-mp-trigger-glyph',
              size: 13,
            })
          : h(PrismFacetIcon, { className: 'op-mp-trigger-prism', size: 13 }),
        h('span', { className: 'op-mp-trigger-label' }, modelLabel),
        effortDisplayLabel
          ? h('span', { className: 'op-mp-trigger-effort', 'data-tier': triggerTier },
              h('span', { className: 'op-mp-trigger-dot', 'aria-hidden': 'true' }),
              effortDisplayLabel,
            )
          : null,
        triggerUnavailable
          ? h('span', { className: 'op-mp-badge' }, copy.badgeUnavailable)
          : null,
        h(ChevronDownIcon, { className: open ? 'op-mp-chevron op-mp-chevron-open' : 'op-mp-chevron' }),
      ),
      open && typeof document !== 'undefined' && document.body
        ? createPortal(panel, document.body)
        : null,
      toast ? h('div', { key: toast.seq, className: 'op-mp-toast', role: 'status' }, toast.text) : null,
    );
  };
}
