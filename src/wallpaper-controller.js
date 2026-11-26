// Local custom image/video wallpaper backdrop controller

export function createWallpaperController({ getSettings }) {
  let layerEl = null;
  let mediaEl = null;
  let currentKey = '';

  function ensureLayer() {
    if (!layerEl || !layerEl.isConnected) {
      layerEl = document.createElement('div');
      layerEl.className = 'op-wallpaper-layer';
      layerEl.setAttribute('aria-hidden', 'true');
      document.body.prepend(layerEl);
    }
  }

  function clearMedia() {
    if (mediaEl) {
      if (mediaEl.tagName === 'VIDEO') {
        try {
          mediaEl.pause();
          mediaEl.removeAttribute('src');
          mediaEl.load();
        } catch { /* ignore */ }
      }
      if (mediaEl.parentNode) mediaEl.parentNode.removeChild(mediaEl);
      mediaEl = null;
    }
    currentKey = '';
  }

  function apply() {
    const s = getSettings();
    const html = document.documentElement;
    const active = Boolean(s.enabled && s.wallpaperId && s.wallpaperKind !== 'none');

    if (!active) {
      html.removeAttribute('data-op-has-wallpaper');
      html.removeAttribute('data-op-wp-glass');
      clearMedia();
      return;
    }

    ensureLayer();
    html.setAttribute('data-op-has-wallpaper', '1');
    html.setAttribute('data-op-wp-glass', s.wallpaperSurfaceGlass ? '1' : '0');
    html.style.setProperty('--op-wp-opacity', String(s.wallpaperOpacity));
    html.style.setProperty('--op-wp-blur', `${s.wallpaperBlur}px`);

    const nextKey = `${s.wallpaperKind}:${s.wallpaperId}`;
    if (nextKey === currentKey && mediaEl && mediaEl.isConnected) return;

    clearMedia();
    currentKey = nextKey;
    const src = `/api/dsh-obsidian-prism/wallpaper-media?id=${encodeURIComponent(s.wallpaperId)}`;

    if (s.wallpaperKind === 'video') {
      const video = document.createElement('video');
      video.className = 'op-wallpaper-media';
      video.src = src;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      mediaEl = video;
      layerEl.appendChild(video);
      video.play().catch(() => {});
    } else {
      const img = document.createElement('img');
      img.className = 'op-wallpaper-media';
      img.src = src;
      img.alt = '';
      img.decoding = 'async';
      mediaEl = img;
      layerEl.appendChild(img);
    }
  }

  function onVisibilityChange() {
    if (!mediaEl || mediaEl.tagName !== 'VIDEO') return;
    if (document.hidden) {
      try { mediaEl.pause(); } catch { /* ignore */ }
    } else {
      mediaEl.play().catch(() => {});
    }
  }

  function start() {
    document.addEventListener('visibilitychange', onVisibilityChange);
    apply();
  }

  function dispose() {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    clearMedia();
    if (layerEl && layerEl.parentNode) layerEl.parentNode.removeChild(layerEl);
    layerEl = null;
    document.documentElement.removeAttribute('data-op-has-wallpaper');
    document.documentElement.removeAttribute('data-op-wp-glass');
    document.documentElement.style.removeProperty('--op-wp-opacity');
    document.documentElement.style.removeProperty('--op-wp-blur');
  }

  return { start, refresh: apply, dispose };
}
