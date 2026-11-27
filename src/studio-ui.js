// Appearance Studio UI (bilingual React components for both DSH Settings Section and Slide-Over Drawer)

import {
  getScenePresetPatch,
  detectActiveScenePreset,
  exportSettingsBackup,
  parseSettingsBackup,
} from './settings-store.js';
import { isZhUi } from './i18n.js';

const SCENE_PRESET_OPTIONS = [
  {
    id: 'ultra',
    zh: '完整光效',
    en: 'Full Prism',
    descZh: '矩阵涟漪 · 棱镜流光 · 编排与伙伴全开',
    descEn: 'Matrix ripple, prism rim, choreography & mascots',
  },
  {
    id: 'focus',
    zh: '专注编码',
    en: 'Focus Code',
    descZh: '黑曜切面 · 柔和流光 · 关闭主页涟漪与伙伴',
    descEn: 'Smoked facets & subtle rim, calm focus canvas',
  },
  {
    id: 'eco',
    zh: '静默省电',
    en: 'Quiet Eco',
    descZh: '保留配色与切面 · 关闭全部光效与动效',
    descEn: 'Keep palette & facets, zero GPU/motion overhead',
  },
];

const UI_LANG_OPTIONS = [
  { id: 'auto', zh: '跟随系统', en: 'Auto' },
  { id: 'zh', zh: '简体中文', en: '中文' },
  { id: 'en', zh: 'English', en: 'English' },
];

const COPY = {
  zh: {
    brand: '黑曜棱镜',
    brandSub: 'Obsidian Prism',
    fab: '棱镜外观',
    close: '关闭',
    reset: '恢复默认',
    langSwitch: 'EN',
    secMaster: '主题与色彩',
    uiLanguage: '界面语言',
    enabled: '启用黑曜棱镜主题套件',
    enabledSub: '关闭后立即恢复 DeepSeek Harness 原生外观',
    themeMode: '明暗模式',
    modeAuto: '跟随 DSH',
    modeDark: '深色',
    modeLight: '浅色',
    darkPalette: '深色系调色板',
    lightPalette: '浅色系调色板',
    accent: '强调色',
    corners: '界面圆角',
    codeFont: '代码字体',
    secGlow: '光效与动效',
    ambientGlow: '棱镜氛围光效',
    ambientOff: '关闭',
    ambientSubtle: '柔和',
    ambientRich: '璀璨',
    prismRim: '输入框动态棱镜流光边框',
    prismRimSub: '2D Canvas 指针追踪高光与生成期流光轨道，静止自动休眠 0fps',
    effortSlider: '棱镜模型选择器与推理滑块',
    effortSliderSub: '固定紧凑宽度、零翻页提供方侧栏+秒搜收藏+底置切工水晶推理滑块，全面汉化并同步当前主题配色（快捷键 ⌘⇧M）',
    effortSliderCrystal: '推理滑块切工水晶光学折射',
    effortSliderCrystalSub: '为底置推理滑块叠加多面切工水晶折射与追光高光（静默省电预设自动关闭）',
    statusVial: '输入框状态胶囊（就绪 / 轮数 / 工具）',
    statusVialSub: '停靠在输入框下方栏，显示耗时、轮数与工具数；也可直接点胶囊右侧 × 关闭',
    homeRipple: '空会话主页矩阵涟漪与地平线光晕',
    homeRippleSub: 'WebGL2 ASCII 字符矩阵交互涟漪，静止自动休眠 0fps',
    convRipple: '对话页微光涟漪',
    convRippleSub: '对话流背景轻互动涟漪（启用本地壁纸时自动让位）',
    convOff: '关闭',
    convSubtle: '柔和',
    convMedium: '标准',
    smokedFacets: '黑曜切面质感统一',
    smokedFacetsSub: '为消息气泡、工具块、交付卡片、芯片与键盘键帽注入微光切面',
    streamFade: '流式回复文字柔光淡入',
    streamFadeSub: '通过 CSS Highlight API 无侵入渲染，不干扰 React 文本更新',
    streamChoreography: '流式入场编排与丝滑折叠',
    streamChoreographySub: '新段落柔和入场、思考/工具折叠丝滑展开，生成完成轻闪提示',
    smoothCaret: '输入框丝滑光标',
    smoothCaretSub: '追踪输入位置，带弹簧缓动与微光拖尾',
    secPresets: '场景预设与配置备份',
    presetsHint: '一键切换光效与性能档位，保留当前明暗调色板与壁纸',
    presetCustom: '当前为自定义组合',
    exportJson: '导出配置 JSON',
    importJson: '导入配置 JSON',
    exportedMsg: '已导出 obsidian-prism-config.json',
    importedMsg: '已导入并应用配置',
    importErrMsg: '导入失败：文件不是有效的黑曜棱镜 JSON 配置',
    secMascot: '像素伙伴舞台',
    mascotHint: '驻留在输入框上沿，可拖拽、互动，回复时会进入工作动画（含 Deepy 像素鲸鱼）',
    secWallpaper: '日常效率工作台与本地壁纸',
    selectionAsk: '划词快捷追问浮条',
    selectionAskSub: '选中对话中任意文字，一键引用追问、请求解释或复制，不打断阅读',
    promptSuggest: '下一步提示词推荐',
    promptSuggestSub: '回复结束后在输入框上方给出一条接着问的建议，点一下或按 Tab 填入',
    uploadWp: '上传图片 / 视频壁纸',
    uploading: '上传中…',
    clearWp: '清除当前壁纸',
    wpEmpty: '尚未上传壁纸（支持 PNG / JPG / WebP / GIF / MP4 / WebM，最大 80MB）',
    wpOpacity: '壁纸不透明度',
    wpBlur: '壁纸模糊度',
    wpGlass: '卡片磨砂透底',
    wpGlassSub: '启用半透明背景以透出自定义壁纸',
    codeFold: '长代码块自动折叠',
    codeFoldSub: '超出设定行数的代码块显示折叠吸顶栏',
    codeThreshold: '折叠阈值（行数）',
    turnOutline: '右侧会话大纲导航（可检索/收起）',
    turnOutlineSub: '支持关键词筛选、分类（提问/代码/工具）直达与一键收起，快捷键 Alt+Shift+O',
    quickTrigger: '显示右下角快捷入口',
    quickTriggerSub: '快捷键 Alt+Shift+P 随时开关外观抽屉',
  },
  en: {
    brand: 'Obsidian Prism',
    brandSub: 'Appearance Studio',
    fab: 'Prism',
    close: 'Close',
    reset: 'Reset Defaults',
    langSwitch: '中',
    secMaster: 'Theme & Palette',
    uiLanguage: 'Studio Language',
    enabled: 'Enable Obsidian Prism',
    enabledSub: 'Disable anytime to restore native DeepSeek Harness appearance',
    themeMode: 'Color Mode',
    modeAuto: 'Follow DSH',
    modeDark: 'Dark',
    modeLight: 'Light',
    darkPalette: 'Dark Palettes',
    lightPalette: 'Light Palettes',
    accent: 'Accent Tone',
    corners: 'Corner Geometry',
    codeFont: 'Code Typography',
    secGlow: 'Glow & Motion',
    ambientGlow: 'Prism Ambient Glow',
    ambientOff: 'Off',
    ambientSubtle: 'Subtle',
    ambientRich: 'Rich',
    prismRim: 'Dynamic Composer Prism Rim',
    prismRimSub: 'Zero-idle 2D canvas specular highlight & streaming orbital beam',
    effortSlider: 'Prism Model Picker & Effort Slider',
    effortSliderSub: 'Fixed-width zero-page-flip provider rail, instant search, favorites & docked Cut-Crystal effort slider (⌘⇧M)',
    effortSliderCrystal: 'Cut-Crystal Slider Optics',
    effortSliderCrystalSub: 'Adds Voronoi cut-crystal refraction & directional specular lighting on the docked effort track',
    statusVial: 'Composer Status Capsule (Ready / Turns / Tools)',
    statusVialSub: 'Docked below the composer card for timer & session depth; also closable via its × button',
    homeRipple: 'Home Matrix Ripple & Horizon Glow',
    homeRippleSub: 'WebGL2 ASCII matrix ripples on empty sessions; sleeps at 0fps when idle',
    convRipple: 'Conversation Ripple',
    convRippleSub: 'Subtle ambient ripple behind chats (auto-yields when wallpaper is active)',
    convOff: 'Off',
    convSubtle: 'Subtle',
    convMedium: 'Medium',
    smokedFacets: 'Smoked Obsidian Facets',
    smokedFacetsSub: 'Unifies bubbles, tool blocks, deliverable cards, chips & keycaps with specular depth',
    streamFade: 'Streaming Text Fade-In',
    streamFadeSub: 'Non-invasive CSS Custom Highlight API fade without mutating DOM',
    streamChoreography: 'Stream Choreography & Smooth Details',
    streamChoreographySub: 'Soft block arrivals, smooth collapsible unfold & completion shimmer',
    smoothCaret: 'Smooth Composer Caret',
    smoothCaretSub: 'Spring-interpolated glowing caret inside the composer input',
    secPresets: 'Scene Presets & Config Backup',
    presetsHint: 'Switch glow & performance profiles without changing your palette or wallpaper',
    presetCustom: 'Custom mix active',
    exportJson: 'Export JSON',
    importJson: 'Import JSON',
    exportedMsg: 'Exported obsidian-prism-config.json',
    importedMsg: 'Configuration imported and applied',
    importErrMsg: 'Import failed: invalid Obsidian Prism JSON config',
    secMascot: 'Pixel Mascot Stage',
    mascotHint: 'Interactive pixel companions perched above the composer (including Deepy whale)',
    secWallpaper: 'Productivity Workbench & Wallpaper',
    selectionAsk: 'Selection Quick-Ask Bar',
    selectionAskSub: 'Highlight any reply snippet to quote & ask, explain, or copy instantly',
    promptSuggest: 'Next-Prompt Suggestion',
    promptSuggestSub: 'After a reply, suggest one follow-up above the composer; click or press Tab to use it',
    uploadWp: 'Upload Image / Video',
    uploading: 'Uploading…',
    clearWp: 'Clear Wallpaper',
    wpEmpty: 'No local wallpapers yet (PNG, JPG, WebP, GIF, MP4, WebM up to 80MB)',
    wpOpacity: 'Wallpaper Opacity',
    wpBlur: 'Wallpaper Blur',
    wpGlass: 'Frosted Glass Surfaces',
    wpGlassSub: 'Translucent surfaces so your wallpaper shines through cleanly',
    codeFold: 'Auto-Fold Long Code Blocks',
    codeFoldSub: 'Adds a sticky collapse/expand bar on code blocks above threshold',
    codeThreshold: 'Fold Threshold (Lines)',
    turnOutline: 'Searchable Conversation Outline',
    turnOutlineSub: 'Filter by keyword or type (turns/code/tools), pin or collapse (Alt+Shift+O)',
    quickTrigger: 'Show Floating Studio Button',
    quickTriggerSub: 'Shortcut Alt+Shift+P always toggles the drawer',
  },
};

const ACCENT_OPTIONS = [
  { id: 'follow', zh: '跟随主题', en: 'Follow', dot: 'linear-gradient(135deg,#669DF6,#D97757)' },
  { id: 'prism', zh: '棱镜', en: 'Prism', dot: 'linear-gradient(135deg,#4285F4,#9B72CB,#EA4335,#FBBC04)' },
  { id: 'cobalt', zh: '钴蓝', en: 'Cobalt', dot: '#4F8BFF' },
  { id: 'terracotta', zh: '暖陶', en: 'Terracotta', dot: '#D97757' },
  { id: 'emerald', zh: '翠绿', en: 'Emerald', dot: '#38B889' },
  { id: 'amethyst', zh: '紫晶', en: 'Amethyst', dot: '#A07CE8' },
  { id: 'amber', zh: '琥珀', en: 'Amber', dot: '#E5A93B' },
  { id: 'rose', zh: '玫瑰', en: 'Rose', dot: '#E86A8A' },
];

const MASCOT_OPTIONS = [
  { id: 'off', zh: '关闭', en: 'Off' },
  { id: 'dual', zh: '双宠 (Clawd + Cat)', en: 'Dual (Clawd + Cat)' },
  { id: 'minis', zh: '双宠 + 迷你蟹群', en: 'Dual + Minis' },
  { id: 'quad', zh: '四宠 (含 Deepy 鲸鱼)', en: 'Quad (w/ Deepy)' },
  { id: 'quad-minis', zh: '四宠全生态', en: 'Full Ecosystem' },
  { id: 'r:w1', zh: '仅 Deepy 鲸鱼', en: 'Deepy Whale' },
  { id: 'r:c1', zh: '仅 Clawd', en: 'Clawd Only' },
  { id: 'r:k1', zh: '仅像素猫', en: 'Cat Only' },
  { id: 'r:d1', zh: '仅像素龙', en: 'Dragon Only' },
];

const CORNER_OPTIONS = [
  { id: 'default', zh: '标准', en: 'Default' },
  { id: 'soft', zh: '柔和圆润', en: 'Soft' },
  { id: 'sharp', zh: '精致锐利', en: 'Sharp' },
];

const CODE_FONT_OPTIONS = [
  { id: 'system', zh: '系统默认', en: 'System' },
  { id: 'jetbrains', zh: 'JetBrains Mono', en: 'JetBrains Mono' },
  { id: 'fira', zh: 'Fira Code', en: 'Fira Code' },
  { id: 'cascadia', zh: 'Cascadia Code', en: 'Cascadia Code' },
  { id: 'maple', zh: 'Maple Mono', en: 'Maple Mono' },
];

export function createStudioComponents({ React, createPortal, store }) {
  const h = React.createElement;
  const { useState, useEffect, useRef } = React;

  function useStoreState() {
    const [val, setVal] = useState(() => store.get());
    useEffect(() => store.subscribe(setVal), []);
    return val;
  }

  function ToggleRow({ label, sub, checked, onChange }) {
    return h('div', { className: 'op-row' },
      h('div', { className: 'op-row-label' },
        h('strong', null, label),
        sub ? h('span', null, sub) : null,
      ),
      h('button', {
        type: 'button',
        role: 'switch',
        'aria-label': label,
        'aria-checked': checked ? 'true' : 'false',
        className: 'op-switch',
        'data-on': checked ? '1' : '0',
        onClick: () => onChange(!checked),
      }),
    );
  }

  function StudioPanel() {
    const s = useStoreState();
    const zh = isZhUi(s);
    const t = zh ? COPY.zh : COPY.en;
    const [wallpapers, setWallpapers] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadErr, setUploadErr] = useState('');
    const [backupStatus, setBackupStatus] = useState(null);
    const fileInputRef = useRef(null);
    const backupInputRef = useRef(null);
    const activePreset = detectActiveScenePreset(s);

    function handleApplyPreset(presetId) {
      const patch = getScenePresetPatch(presetId, s);
      if (!patch) return;
      store.set(patch);
    }

    function handleExportJson() {
      try {
        const json = exportSettingsBackup(s);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'obsidian-prism-config.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setBackupStatus({ tone: 'ok', text: t.exportedMsg });
      } catch (err) {
        setBackupStatus({ tone: 'err', text: err?.message || t.importErrMsg });
      }
    }

    async function handleImportJson(ev) {
      const file = ev.target.files?.[0];
      ev.target.value = '';
      if (!file) return;
      try {
        const raw = await file.text();
        const res = parseSettingsBackup(raw, s);
        if (!res.ok) {
          setBackupStatus({ tone: 'err', text: t.importErrMsg });
          return;
        }
        store.set(res.settings);
        setBackupStatus({ tone: 'ok', text: t.importedMsg });
      } catch {
        setBackupStatus({ tone: 'err', text: t.importErrMsg });
      }
    }

    async function loadWallpapers() {
      try {
        const res = await fetch('/api/dsh-obsidian-prism/wallpapers', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (json && json.ok && Array.isArray(json.items)) {
          setWallpapers(json.items);
        }
      } catch {
        // ignore if host endpoint unavailable
      }
    }

    useEffect(() => {
      loadWallpapers();
    }, []);

    async function handleFileSelect(ev) {
      const file = ev.target.files?.[0];
      ev.target.value = '';
      if (!file) return;
      setUploading(true);
      setUploadErr('');
      try {
        const res = await fetch('/api/dsh-obsidian-prism/wallpaper-upload', {
          method: 'POST',
          headers: {
            'content-type': file.type || 'application/octet-stream',
            'x-op-filename': encodeURIComponent(file.name || 'wallpaper'),
          },
          body: file,
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setUploadErr(json?.error || 'Upload failed');
        } else {
          await loadWallpapers();
          store.set({ wallpaperId: json.item.id, wallpaperKind: json.item.kind });
        }
      } catch (err) {
        setUploadErr(err?.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    }

    async function handleDeleteWp(ev, id) {
      ev.stopPropagation();
      try {
        const response = await fetch('/api/dsh-obsidian-prism/wallpaper-delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!response.ok) throw new Error(zh ? '删除壁纸失败' : 'Could not delete wallpaper');
        if (s.wallpaperId === id) {
          store.set({ wallpaperId: '', wallpaperKind: 'none' });
        }
        await loadWallpapers();
      } catch (err) {
        setUploadErr(err?.message || (zh ? '删除壁纸失败' : 'Could not delete wallpaper'));
      }
    }

    return h('div', { className: 'op-studio', 'data-op-ui': '1' },
      // Section 0: Scene Presets & Backup
      h('div', { className: 'op-card' },
        h('div', { className: 'op-card-title' },
          h('span', null, t.secPresets),
          !activePreset ? h('span', { className: 'op-status-note' }, t.presetCustom) : null,
        ),
        h('div', { className: 'op-row-label' }, h('span', null, t.presetsHint)),
        h('div', { className: 'op-preset-grid' },
          SCENE_PRESET_OPTIONS.map((p) => h('button', {
            key: p.id,
            type: 'button',
            className: 'op-preset-btn',
            'data-active': activePreset === p.id ? '1' : '0',
            onClick: () => handleApplyPreset(p.id),
          },
            h('strong', null, zh ? p.zh : p.en),
            h('span', null, zh ? p.descZh : p.descEn),
          )),
        ),
        h('div', { className: 'op-backup-bar' },
          h('input', {
            ref: backupInputRef,
            type: 'file',
            accept: 'application/json,.json',
            style: { display: 'none' },
            onChange: handleImportJson,
          }),
          h('button', {
            type: 'button',
            className: 'op-btn',
            onClick: handleExportJson,
          }, t.exportJson),
          h('button', {
            type: 'button',
            className: 'op-btn',
            onClick: () => backupInputRef.current?.click(),
          }, t.importJson),
          backupStatus ? h('span', {
            className: 'op-status-note',
            'data-tone': backupStatus.tone,
          }, backupStatus.text) : null,
        ),
      ),

      // Section 1: Theme & Palette
      h('div', { className: 'op-card' },
        h('div', { className: 'op-card-title' },
          h('span', null, t.secMaster),
          h('button', {
            type: 'button',
            className: 'op-btn',
            onClick: () => store.reset(),
          }, t.reset),
        ),
        h(ToggleRow, {
          label: t.enabled,
          sub: t.enabledSub,
          checked: s.enabled,
          onChange: (v) => store.set({ enabled: v }),
        }),
        h('div', { className: 'op-row' },
          h('div', { className: 'op-row-label' }, h('strong', null, t.uiLanguage)),
          h('div', { className: 'op-pills' },
            UI_LANG_OPTIONS.map((langOpt) => h('button', {
              key: langOpt.id,
              type: 'button',
              className: 'op-pill',
              'data-active': s.uiLanguage === langOpt.id ? '1' : '0',
              onClick: () => store.set({ uiLanguage: langOpt.id }),
            }, zh ? langOpt.zh : langOpt.en)),
          ),
        ),
        h('div', { className: 'op-row' },
          h('div', { className: 'op-row-label' }, h('strong', null, t.themeMode)),
          h('div', { className: 'op-pills' },
            [
              { id: 'auto', label: t.modeAuto },
              { id: 'dark', label: t.modeDark },
              { id: 'light', label: t.modeLight },
            ].map((m) => h('button', {
              key: m.id,
              type: 'button',
              className: 'op-pill',
              'data-active': s.themeMode === m.id ? '1' : '0',
              onClick: () => store.set({ themeMode: m.id }),
            }, m.label)),
          ),
        ),
        h('div', { className: 'op-row-label' }, h('span', null, t.darkPalette)),
        h('div', { className: 'op-swatches' },
          [
            { id: 'obsidian', name: zh ? '黑曜 Obsidian' : 'Obsidian', desc: zh ? '深邃冷曜 · 钴蓝' : 'Deep Cool · Cobalt', bg: '#0B0B0E', accent: '#669DF6' },
            { id: 'warm', name: zh ? '暖炭 Warm' : 'Warm Charcoal', desc: zh ? '沉稳暖炭 · 陶橙' : 'Warm Ink · Terracotta', bg: '#141413', accent: '#D97757' },
          ].map((p) => h('button', {
            key: p.id,
            type: 'button',
            className: 'op-swatch',
            'data-active': s.darkPreset === p.id ? '1' : '0',
            onClick: () => store.set({ darkPreset: p.id }),
          },
            h('span', { className: 'op-swatch-chip', style: { background: p.bg, '--chip-accent': p.accent } }),
            h('span', { className: 'op-row-label' },
              h('strong', null, p.name),
              h('span', null, p.desc),
            ),
          )),
        ),
        h('div', { className: 'op-row-label' }, h('span', null, t.lightPalette)),
        h('div', { className: 'op-swatches' },
          [
            { id: 'crystal', name: zh ? '晶白 Crystal' : 'Crystal', desc: zh ? '清透瓷白 · 钴蓝' : 'Crisp Ice · Cobalt', bg: '#F4F7FB', accent: '#2563EB' },
            { id: 'alabaster', name: zh ? '暖陶 Alabaster' : 'Alabaster', desc: zh ? '温润纸白 · 暖陶' : 'Warm Paper · Clay', bg: '#F6F4EE', accent: '#C25934' },
          ].map((p) => h('button', {
            key: p.id,
            type: 'button',
            className: 'op-swatch',
            'data-active': s.lightPreset === p.id ? '1' : '0',
            onClick: () => store.set({ lightPreset: p.id }),
          },
            h('span', { className: 'op-swatch-chip', style: { background: p.bg, '--chip-accent': p.accent } }),
            h('span', { className: 'op-row-label' },
              h('strong', null, p.name),
              h('span', null, p.desc),
            ),
          )),
        ),
        h('div', { className: 'op-row-label' }, h('span', null, t.accent)),
        h('div', { className: 'op-pills' },
          ACCENT_OPTIONS.map((a) => h('button', {
            key: a.id,
            type: 'button',
            className: 'op-pill',
            'data-active': s.accent === a.id ? '1' : '0',
            onClick: () => store.set({ accent: a.id }),
          },
            h('span', { className: 'op-color-dot', style: { background: a.dot } }),
            zh ? a.zh : a.en,
          )),
        ),
        h('div', { className: 'op-row' },
          h('div', { className: 'op-row-label' }, h('strong', null, t.corners)),
          h('div', { className: 'op-pills' },
            CORNER_OPTIONS.map((c) => h('button', {
              key: c.id,
              type: 'button',
              className: 'op-pill',
              'data-active': s.cornerStyle === c.id ? '1' : '0',
              onClick: () => store.set({ cornerStyle: c.id }),
            }, zh ? c.zh : c.en)),
          ),
        ),
        h('div', { className: 'op-row-label' }, h('span', null, t.codeFont)),
        h('div', { className: 'op-pills' },
          CODE_FONT_OPTIONS.map((f) => h('button', {
            key: f.id,
            type: 'button',
            className: 'op-pill',
            'data-active': s.codeFont === f.id ? '1' : '0',
            onClick: () => store.set({ codeFont: f.id }),
          }, zh ? f.zh : f.en)),
        ),
      ),

      // Section 2: Glow & Motion
      h('div', { className: 'op-card' },
        h('div', { className: 'op-card-title' }, t.secGlow),
        h('div', { className: 'op-row' },
          h('div', { className: 'op-row-label' }, h('strong', null, t.ambientGlow)),
          h('div', { className: 'op-pills' },
            [
              { id: 'off', label: t.ambientOff },
              { id: 'subtle', label: t.ambientSubtle },
              { id: 'rich', label: t.ambientRich },
            ].map((lv) => h('button', {
              key: lv.id,
              type: 'button',
              className: 'op-pill',
              'data-active': s.ambientGlow === lv.id ? '1' : '0',
              onClick: () => store.set({ ambientGlow: lv.id }),
            }, lv.label)),
          ),
        ),
        h(ToggleRow, {
          label: t.prismRim,
          sub: t.prismRimSub,
          checked: s.prismRimEnabled,
          onChange: (v) => store.set({ prismRimEnabled: v }),
        }),
        h(ToggleRow, {
          label: t.effortSlider,
          sub: t.effortSliderSub,
          checked: s.effortSliderEnabled,
          onChange: (v) => store.set({ effortSliderEnabled: v }),
        }),
        s.effortSliderEnabled
          ? h(ToggleRow, {
              label: t.effortSliderCrystal,
              sub: t.effortSliderCrystalSub,
              checked: s.effortSliderCrystal,
              onChange: (v) => store.set({ effortSliderCrystal: v }),
            })
          : null,
        h(ToggleRow, {
          label: t.homeRipple,
          sub: t.homeRippleSub,
          checked: s.homeRipple,
          onChange: (v) => store.set({ homeRipple: v }),
        }),
        h('div', { className: 'op-row' },
          h('div', { className: 'op-row-label' },
            h('strong', null, t.convRipple),
            h('span', null, t.convRippleSub),
          ),
          h('div', { className: 'op-pills' },
            [
              { id: 'off', label: t.convOff },
              { id: 'subtle', label: t.convSubtle },
              { id: 'medium', label: t.convMedium },
            ].map((lv) => h('button', {
              key: lv.id,
              type: 'button',
              className: 'op-pill',
              'data-active': s.convRipple === lv.id ? '1' : '0',
              onClick: () => store.set({ convRipple: lv.id }),
            }, lv.label)),
          ),
        ),
        h(ToggleRow, {
          label: t.smokedFacets,
          sub: t.smokedFacetsSub,
          checked: s.smokedFacets,
          onChange: (v) => store.set({ smokedFacets: v }),
        }),
        h(ToggleRow, {
          label: t.streamFade,
          sub: t.streamFadeSub,
          checked: s.streamFade,
          onChange: (v) => store.set({ streamFade: v }),
        }),
        h(ToggleRow, {
          label: t.streamChoreography,
          sub: t.streamChoreographySub,
          checked: s.streamChoreography,
          onChange: (v) => store.set({ streamChoreography: v }),
        }),
        h(ToggleRow, {
          label: t.smoothCaret,
          sub: t.smoothCaretSub,
          checked: s.smoothCaret,
          onChange: (v) => store.set({ smoothCaret: v }),
        }),
      ),

      // Section 3: Pixel Mascot Stage
      h('div', { className: 'op-card' },
        h('div', { className: 'op-card-title' }, t.secMascot),
        h('div', { className: 'op-row-label' }, h('span', null, t.mascotHint)),
        h('div', { className: 'op-pills' },
          MASCOT_OPTIONS.map((m) => h('button', {
            key: m.id,
            type: 'button',
            className: 'op-pill',
            'data-active': s.mascotSpec === m.id ? '1' : '0',
            onClick: () => store.set({ mascotSpec: m.id }),
          }, zh ? m.zh : m.en)),
        ),
      ),

      // Section 4: Workbench & Wallpaper
      h('div', { className: 'op-card' },
        h('div', { className: 'op-card-title' }, t.secWallpaper),
        h(ToggleRow, {
          label: t.selectionAsk,
          sub: t.selectionAskSub,
          checked: s.selectionAskEnabled,
          onChange: (v) => store.set({ selectionAskEnabled: v }),
        }),
        h(ToggleRow, {
          label: t.promptSuggest,
          sub: t.promptSuggestSub,
          checked: s.promptSuggestEnabled,
          onChange: (v) => store.set({ promptSuggestEnabled: v }),
        }),
        h(ToggleRow, {
          label: t.turnOutline,
          sub: t.turnOutlineSub,
          checked: s.turnOutlineEnabled,
          onChange: (v) => store.set({ turnOutlineEnabled: v }),
        }),
        h(ToggleRow, {
          label: t.codeFold,
          sub: t.codeFoldSub,
          checked: s.codeFoldEnabled,
          onChange: (v) => store.set({ codeFoldEnabled: v }),
        }),
        s.codeFoldEnabled ? h('div', { className: 'op-row' },
          h('div', { className: 'op-row-label' },
            h('strong', null, `${t.codeThreshold} (${s.codeFoldThreshold})`),
          ),
          h('input', {
            type: 'range',
            className: 'op-slider',
            min: 12,
            max: 80,
            step: 2,
            value: s.codeFoldThreshold,
            onChange: (ev) => store.set({ codeFoldThreshold: Number(ev.target.value) }),
          }),
        ) : null,
        h(ToggleRow, {
          label: t.quickTrigger,
          sub: t.quickTriggerSub,
          checked: s.quickTriggerVisible,
          onChange: (v) => store.set({ quickTriggerVisible: v }),
        }),
        h('div', { className: 'op-row' },
          h('input', {
            ref: fileInputRef,
            type: 'file',
            accept: 'image/*,video/mp4,video/webm,video/quicktime',
            style: { display: 'none' },
            onChange: handleFileSelect,
          }),
          h('button', {
            type: 'button',
            className: 'op-btn',
            disabled: uploading,
            onClick: () => fileInputRef.current?.click(),
          }, uploading ? t.uploading : t.uploadWp),
          s.wallpaperId
            ? h('button', {
              type: 'button',
              className: 'op-btn op-btn-danger',
              onClick: () => store.set({ wallpaperId: '', wallpaperKind: 'none' }),
            }, t.clearWp)
            : null,
        ),
        uploadErr ? h('div', { style: { color: '#E5534B', fontSize: '11px' } }, uploadErr) : null,
        wallpapers.length === 0
          ? h('div', { className: 'op-row-label' }, h('span', null, t.wpEmpty))
          : h('div', { className: 'op-wp-grid' },
            wallpapers.map((wp) => h('div', {
              key: wp.id,
              role: 'button',
              tabIndex: 0,
              className: 'op-wp-thumb',
              'data-active': s.wallpaperId === wp.id ? '1' : '0',
              title: wp.name,
              onClick: () => store.set({ wallpaperId: wp.id, wallpaperKind: wp.kind }),
              onKeyDown: (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  store.set({ wallpaperId: wp.id, wallpaperKind: wp.kind });
                }
              },
            },
              wp.kind === 'video'
                ? h('video', { src: wp.url, muted: true, playsInline: true, preload: 'metadata' })
                : h('img', { src: wp.url, alt: wp.name, loading: 'lazy' }),
              h('span', { className: 'op-wp-badge' }, wp.kind),
              h('button', {
                type: 'button',
                className: 'op-wp-del',
                title: 'Delete',
                onClick: (ev) => handleDeleteWp(ev, wp.id),
              }, '×'),
            )),
          ),
        s.wallpaperId ? h(React.Fragment, null,
          h('div', { className: 'op-row' },
            h('div', { className: 'op-row-label' },
              h('strong', null, `${t.wpOpacity} (${Math.round(s.wallpaperOpacity * 100)}%)`),
            ),
            h('input', {
              type: 'range',
              className: 'op-slider',
              min: 0.05,
              max: 0.65,
              step: 0.01,
              value: s.wallpaperOpacity,
              onChange: (ev) => store.set({ wallpaperOpacity: Number(ev.target.value) }),
            }),
          ),
          h('div', { className: 'op-row' },
            h('div', { className: 'op-row-label' },
              h('strong', null, `${t.wpBlur} (${s.wallpaperBlur}px)`),
            ),
            h('input', {
              type: 'range',
              className: 'op-slider',
              min: 0,
              max: 24,
              step: 1,
              value: s.wallpaperBlur,
              onChange: (ev) => store.set({ wallpaperBlur: Number(ev.target.value) }),
            }),
          ),
          h(ToggleRow, {
            label: t.wpGlass,
            sub: t.wpGlassSub,
            checked: s.wallpaperSurfaceGlass,
            onChange: (v) => store.set({ wallpaperSurfaceGlass: v }),
          }),
        ) : null,
      ),
    );
  }

  function FloatingStudioHost() {
    const s = useStoreState();
    const [open, setOpen] = useState(false);
    const zh = isZhUi(s);
    const t = zh ? COPY.zh : COPY.en;

    useEffect(() => {
      const onKey = (ev) => {
        if (ev.altKey && ev.shiftKey && (ev.key === 'P' || ev.key === 'p')) {
          ev.preventDefault();
          setOpen((v) => !v);
        } else if (ev.key === 'Escape' && open) {
          setOpen(false);
        }
      };
      const onOpenStudio = () => setOpen(true);
      window.addEventListener('keydown', onKey);
      window.addEventListener('dsh-obsidian-prism:open-studio', onOpenStudio);
      return () => {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('dsh-obsidian-prism:open-studio', onOpenStudio);
      };
    }, [open]);

    const body = document.body;
    if (!body) return null;

    return createPortal(
      h(React.Fragment, null,
        s.quickTriggerVisible ? h('button', {
          type: 'button',
          className: 'op-fab',
          'data-op-ui': '1',
          title: `${t.brand} (Alt+Shift+P)`,
          onClick: () => setOpen((v) => !v),
        },
          h('span', { className: 'op-fab-dot' }),
          h('span', null, t.fab),
        ) : null,
        open ? h('div', {
          className: 'op-drawer-backdrop',
          'data-op-ui': '1',
          onClick: (ev) => {
            if (ev.target === ev.currentTarget) setOpen(false);
          },
        },
          h('aside', { className: 'op-drawer', role: 'dialog', 'aria-label': t.brand },
            h('div', { className: 'op-drawer-head' },
              h('div', { className: 'op-drawer-title' },
                h('span', { className: 'op-fab-dot' }),
                h('span', null, t.brand),
                h('span', { className: 'op-drawer-sub' }, t.brandSub),
              ),
              h('div', { className: 'op-drawer-actions' },
                h('button', {
                  type: 'button',
                  className: 'op-btn op-lang-btn',
                  title: zh ? 'Switch UI to English' : '切换为简体中文',
                  onClick: () => store.set({ uiLanguage: zh ? 'en' : 'zh' }),
                }, t.langSwitch),
                h('button', {
                  type: 'button',
                  className: 'op-btn',
                  onClick: () => setOpen(false),
                }, t.close),
              ),
            ),
            h('div', { className: 'op-drawer-body' }, h(StudioPanel)),
          ),
        ) : null,
      ),
      body,
    );
  }

  return { StudioPanel, FloatingStudioHost };
}
