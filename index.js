import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';

const MAX_WALLPAPER_BYTES = 80 * 1024 * 1024; // 80 MB
const ALLOWED_EXT_MIME = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.avif', 'image/avif'],
  ['.svg', 'image/svg+xml'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mov', 'video/quicktime'],
  ['.m4v', 'video/mp4'],
]);
const MIME_TO_EXT = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif'],
  ['image/svg+xml', '.svg'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['video/quicktime', '.mov'],
]);

const SAFE_ID_RE = /^[a-zA-Z0-9._-]{1,120}$/;

export function getDataDirs(baseDir) {
  const root = baseDir ? resolve(baseDir) : join(homedir(), '.dsh', 'obsidian-prism');
  return {
    root,
    settingsPath: join(root, 'settings.json'),
    wallpapersDir: join(root, 'wallpapers'),
    manifestPath: join(root, 'wallpapers', 'manifest.json'),
  };
}

async function ensureDirs(dirs) {
  await mkdir(dirs.wallpapersDir, { recursive: true });
}

export async function readHostSettings(dirs) {
  try {
    if (!existsSync(dirs.settingsPath)) return null;
    const raw = await readFile(dirs.settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeHostSettings(dirs, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid settings payload');
  }
  await ensureDirs(dirs);
  const clean = JSON.stringify(data, null, 2);
  await writeFile(dirs.settingsPath, clean, 'utf8');
  return data;
}

async function readManifest(dirs) {
  try {
    if (!existsSync(dirs.manifestPath)) return {};
    const parsed = JSON.parse(await readFile(dirs.manifestPath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeManifest(dirs, manifest) {
  await ensureDirs(dirs);
  await writeFile(dirs.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

export async function listWallpapers(dirs) {
  await ensureDirs(dirs);
  const manifest = await readManifest(dirs);
  const files = await readdir(dirs.wallpapersDir);
  const items = [];
  for (const name of files) {
    if (name === 'manifest.json' || name.startsWith('.')) continue;
    const ext = extname(name).toLowerCase();
    const mime = ALLOWED_EXT_MIME.get(ext);
    if (!mime) continue;
    const full = join(dirs.wallpapersDir, name);
    try {
      const info = await stat(full);
      if (!info.isFile()) continue;
      const meta = manifest[name] || {};
      items.push({
        id: name,
        name: typeof meta.name === 'string' && meta.name ? meta.name : name,
        mime,
        kind: mime.startsWith('video/') ? 'video' : 'image',
        size: info.size,
        createdAt: meta.createdAt || Math.round(info.mtimeMs),
        url: `/api/dsh-obsidian-prism/wallpaper-media?id=${encodeURIComponent(name)}`,
      });
    } catch {
      // skip unreadable file
    }
  }
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return items;
}

export async function saveWallpaperBuffer(dirs, { buffer, filename = 'wallpaper', mimeType = '' }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Empty wallpaper file');
  }
  if (buffer.length > MAX_WALLPAPER_BYTES) {
    throw new Error(`Wallpaper exceeds ${Math.round(MAX_WALLPAPER_BYTES / 1024 / 1024)}MB limit`);
  }
  const cleanMime = String(mimeType || '').split(';')[0].trim().toLowerCase();
  const rawExt = extname(String(filename || '')).toLowerCase();
  const ext = ALLOWED_EXT_MIME.has(rawExt) ? rawExt : MIME_TO_EXT.get(cleanMime);
  if (!ext || !ALLOWED_EXT_MIME.has(ext)) {
    throw new Error('Unsupported wallpaper format (allowed: PNG, JPG, WebP, GIF, AVIF, MP4, WebM, MOV)');
  }
  const resolvedMime = ALLOWED_EXT_MIME.get(ext);
  await ensureDirs(dirs);
  const stamp = Date.now().toString(36);
  const rand = randomBytes(4).toString('hex');
  const id = `wp-${stamp}-${rand}${ext}`;
  const target = join(dirs.wallpapersDir, id);
  await writeFile(target, buffer);

  const manifest = await readManifest(dirs);
  const displayName = String(filename || id).replace(/[/\\]/g, '_').slice(0, 120) || id;
  const createdAt = Date.now();
  manifest[id] = { name: displayName, mime: resolvedMime, createdAt };
  await writeManifest(dirs, manifest);

  return {
    id,
    name: displayName,
    mime: resolvedMime,
    kind: resolvedMime.startsWith('video/') ? 'video' : 'image',
    size: buffer.length,
    createdAt,
    url: `/api/dsh-obsidian-prism/wallpaper-media?id=${encodeURIComponent(id)}`,
  };
}

export async function deleteWallpaper(dirs, id) {
  if (typeof id !== 'string' || !SAFE_ID_RE.test(id) || id === 'manifest.json') {
    throw new Error('Invalid wallpaper id');
  }
  const target = join(dirs.wallpapersDir, id);
  if (existsSync(target)) {
    await unlink(target);
  }
  const manifest = await readManifest(dirs);
  if (Object.prototype.hasOwnProperty.call(manifest, id)) {
    delete manifest[id];
    await writeManifest(dirs, manifest);
  }
  return { deleted: id };
}

export async function serveWallpaperMedia(dirs, request) {
  const url = new URL(request.url, 'http://localhost');
  const id = url.searchParams.get('id') || '';
  if (!SAFE_ID_RE.test(id) || id === 'manifest.json') {
    return new Response('Invalid wallpaper id', { status: 400 });
  }
  const ext = extname(id).toLowerCase();
  const mime = ALLOWED_EXT_MIME.get(ext);
  if (!mime) {
    return new Response('Unsupported media type', { status: 400 });
  }
  const target = join(dirs.wallpapersDir, id);
  if (!existsSync(target)) {
    return new Response('Not found', { status: 404 });
  }
  const info = await stat(target);
  if (!info.isFile()) {
    return new Response('Not found', { status: 404 });
  }
  const total = info.size;
  const rangeHeader = request.headers.get('range');
  const baseHeaders = {
    'content-type': mime,
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=31536000, immutable',
  };

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (!match) {
      return new Response('Invalid Range', { status: 416, headers: { 'content-range': `bytes */${total}` } });
    }
    let start = match[1] === '' ? 0 : Number.parseInt(match[1], 10);
    let end = match[2] === '' ? total - 1 : Number.parseInt(match[2], 10);
    if (match[1] === '' && match[2] !== '') {
      const suffix = Number.parseInt(match[2], 10);
      start = Math.max(0, total - suffix);
      end = total - 1;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= total || start > end) {
      return new Response('Range Not Satisfiable', { status: 416, headers: { 'content-range': `bytes */${total}` } });
    }
    const stream = Readable.toWeb(createReadStream(target, { start, end }));
    return new Response(stream, {
      status: 206,
      headers: {
        ...baseHeaders,
        'content-range': `bytes ${start}-${end}/${total}`,
        'content-length': String(end - start + 1),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(target));
  return new Response(stream, {
    status: 200,
    headers: {
      ...baseHeaders,
      'content-length': String(total),
    },
  });
}

export function createHostHandlers(baseDir) {
  const dirs = getDataDirs(baseDir);

  return [
    {
      path: '/api/dsh-obsidian-prism/settings',
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      async fetch(request) {
        try {
          if (request.method === 'GET') {
            const value = await readHostSettings(dirs);
            return Response.json({ ok: true, value });
          }
          const body = await request.json();
          const payload = body && typeof body === 'object' && 'settings' in body ? body.settings : body;
          const saved = await writeHostSettings(dirs, payload);
          return Response.json({ ok: true, value: saved });
        } catch (error) {
          return Response.json({ ok: false, error: error?.message || 'Failed to handle settings' }, { status: 400 });
        }
      },
    },
    {
      // Magpie group order straight from Magpie's own /v1/models listing
      // (model list order == Magpie's group order). Plugin never hardcodes it.
      path: '/api/dsh-obsidian-prism/magpie-groups',
      methods: ['GET'],
      requestBody: 'buffered',
      async fetch() {
        try {
          const base = process.env.MAGPIE_BASE_URL || 'http://127.0.0.1:3425';
          const key = process.env.MAGPIE_GATEWAY_KEY || '';
          const res = await globalThis.fetch(`${base.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1/models`, {
            headers: key ? { authorization: `Bearer ${key}` } : {},
            signal: AbortSignal.timeout(4000),
          });
          if (!res.ok) throw new Error(`magpie ${res.status}`);
          const data = (await res.json())?.data || [];
          const order = [];
          const owners = {};
          for (const m of data) {
            const id = String(m?.id || '');
            const i = id.indexOf('/');
            if (i <= 0) continue;
            const slug = id.slice(0, i).toLowerCase();
            if (!order.includes(slug)) order.push(slug);
            if (!owners[slug] && m?.owned_by) owners[slug] = String(m.owned_by);
          }
          return Response.json({ ok: true, order, owners });
        } catch (error) {
          return Response.json({ ok: false, error: error?.message || 'magpie unreachable' });
        }
      },
    },
    {
      path: '/api/dsh-obsidian-prism/wallpapers',
      methods: ['GET'],
      requestBody: 'buffered',
      async fetch() {
        try {
          const items = await listWallpapers(dirs);
          return Response.json({ ok: true, items });
        } catch (error) {
          return Response.json({ ok: false, error: error?.message || 'Failed to list wallpapers' }, { status: 500 });
        }
      },
    },
    {
      path: '/api/dsh-obsidian-prism/wallpaper-upload',
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        try {
          const rawName = request.headers.get('x-op-filename') || 'wallpaper';
          let filename = rawName;
          try { filename = decodeURIComponent(rawName); } catch { /* keep raw */ }
          const mimeType = request.headers.get('content-type') || '';
          const ab = await request.arrayBuffer();
          const item = await saveWallpaperBuffer(dirs, {
            buffer: Buffer.from(ab),
            filename,
            mimeType,
          });
          return Response.json({ ok: true, item });
        } catch (error) {
          return Response.json({ ok: false, error: error?.message || 'Upload failed' }, { status: 400 });
        }
      },
    },
    {
      path: '/api/dsh-obsidian-prism/wallpaper-delete',
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        try {
          const body = await request.json();
          const res = await deleteWallpaper(dirs, body?.id);
          return Response.json({ ok: true, ...res });
        } catch (error) {
          return Response.json({ ok: false, error: error?.message || 'Delete failed' }, { status: 400 });
        }
      },
    },
    {
      path: '/api/dsh-obsidian-prism/wallpaper-media',
      methods: ['GET'],
      requestBody: 'buffered',
      async fetch(request) {
        try {
          return await serveWallpaperMedia(dirs, request);
        } catch (error) {
          return new Response(error?.message || 'Media error', { status: 500 });
        }
      },
    },
  ];
}

export function apply(ctx) {
  const handlers = createHostHandlers();
  ctx.inject(['connection'], (c) => {
    for (const handler of handlers) {
      c.effect(
        () => c.connection.fetch.register(handler),
        `dsh-obsidian-prism: ${handler.path}`
      );
    }
  });
}
