// Shared UI language resolver for dsh-obsidian-prism

export function resolveUiLang(settings) {
  const pref = settings && typeof settings.uiLanguage === 'string' ? settings.uiLanguage : 'auto';
  if (pref === 'zh' || pref === 'en') return pref;
  if (typeof document !== 'undefined') {
    const docLang = (document.documentElement?.lang || '').toLowerCase();
    if (docLang.startsWith('zh')) return 'zh';
    if (docLang.startsWith('en')) return 'en';
  }
  if (typeof navigator !== 'undefined') {
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('zh')) return 'zh';
  }
  return 'en';
}

export function isZhUi(settings) {
  return resolveUiLang(settings) === 'zh';
}
