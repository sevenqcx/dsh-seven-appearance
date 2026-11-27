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

function resolveMagpieEndpoint() {
  const base = (process.env.MAGPIE_BASE_URL || 'http://127.0.0.1:3425')
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '');
  const key = process.env.MAGPIE_GATEWAY_KEY || '';
  return { base, key };
}

async function listMagpieTextModels() {
  const { base, key } = resolveMagpieEndpoint();
  const res = await globalThis.fetch(`${base}/v1/models`, {
    headers: key ? { authorization: `Bearer ${key}` } : {},
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`magpie ${res.status}`);
  const data = (await res.json())?.data || [];
  const models = [];
  const seen = new Set();
  for (const m of data) {
    const id = typeof m?.id === 'string' ? m.id.trim() : '';
    if (!id || seen.has(id)) continue;
    const outputMods = m?.modalities?.output;
    if (Array.isArray(outputMods) && !outputMods.includes('text')) continue;
    seen.add(id);
    const label = String(m?.display_name || m?.magpie_label || id).trim() || id;
    models.push({ id, label });
  }
  return models;
}

function pickFastDefaultModel(models, envPreferred) {
  if (envPreferred) {
    if (models.some((m) => m.id === envPreferred)) return envPreferred;
    if (!models.length) return envPreferred;
  }
  const priorities = [
    (id) => /(^|\/)qwen-flash/i.test(id),
    (id) => /(^|\/)qwen3-coder-flash/i.test(id),
    (id) => /flash/i.test(id) && !/omni|image|audio|video|reason|think/i.test(id),
    (id) => /(^|\/)qwen-doc-turbo/i.test(id),
    (id) => id === 'aws-quick/fast',
    (id) => id === 'group/fastest-first',
  ];
  for (const match of priorities) {
    const found = models.find((m) => match(m.id));
    if (found) return found.id;
  }
  return models[0]?.id || envPreferred || 'group/fastest-first';
}

export function createHostHandlers(baseDir) {
  const dirs = getDataDirs(baseDir);
  const MODEL_CACHE_TTL_MS = 30_000;
  let cachedModels = null;

  async function getMagpieTextModels({ forceRefresh = false } = {}) {
    const { base, key } = resolveMagpieEndpoint();
    const cacheKey = `${base}|${key}`;
    const now = Date.now();
    if (
      !forceRefresh &&
      cachedModels &&
      cachedModels.cacheKey === cacheKey &&
      now - cachedModels.fetchedAt < MODEL_CACHE_TTL_MS
    ) {
      return cachedModels.models;
    }
    const models = await listMagpieTextModels();
    cachedModels = { cacheKey, fetchedAt: now, models };
    return models;
  }

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
      // Next-prompt suggestion: list available Magpie text models (GET) or generate one follow-up (POST).
      path: '/api/dsh-obsidian-prism/prompt-suggest',
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      async fetch(request) {
        try {
          const { base, key } = resolveMagpieEndpoint();
          const envPreferred = (process.env.OP_SUGGEST_MODEL || '').trim();

          if (request.method === 'GET') {
            const models = await getMagpieTextModels({ forceRefresh: true });
            const defaultModel = pickFastDefaultModel(models, envPreferred);
            return Response.json({ ok: true, models, defaultModel });
          }

          const body = await request.json();
          const user = String(body?.user || '').slice(-500);
          const assistant = String(body?.assistant || '').slice(-1200);
          if (!assistant) return Response.json({ ok: false, error: 'empty' });

          let models = await getMagpieTextModels();
          const requestedModel = typeof body?.model === 'string' ? body.model.trim() : '';
          let model = pickFastDefaultModel(models, envPreferred);
          if (requestedModel) {
            if (!models.some((m) => m.id === requestedModel)) {
              models = await getMagpieTextModels({ forceRefresh: true });
              if (!models.some((m) => m.id === requestedModel)) {
                return Response.json({ ok: false, error: 'Unknown or unsupported model' }, { status: 400 });
              }
            }
            model = requestedModel;
          }
          if (!model) {
            return Response.json({ ok: false, error: 'No available text model' }, { status: 400 });
          }

          const zh = body?.zh !== false;
          const exclude = Array.isArray(body?.exclude)
            ? body.exclude.map((x) => String(x || '').trim()).filter(Boolean).slice(-5)
            : [];
          const sys = zh
            ? '你是输入建议助手。根据对话预测用户下一句最可能发的话。只输出这一句中文，不超过35字，不加引号和解释。'
            : "Predict the user's most likely next message. Output only that one sentence, under 20 words, no quotes.";
          let promptContent = user ? `用户：${user}\n\n助手：${assistant}` : `助手：${assistant}`;
          if (exclude.length > 0) {
            promptContent += zh
              ? `\n\n请换一个不同角度的建议，不要重复：\n- ${exclude.join('\n- ')}`
              : `\n\nSuggest a different angle; do not repeat:\n- ${exclude.join('\n- ')}`;
          }
          const res = await globalThis.fetch(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
            body: JSON.stringify({
              model,
              max_tokens: 72,
              temperature: exclude.length > 0 ? 0.75 : 0.35,
              messages: [
                { role: 'system', content: sys },
                { role: 'user', content: promptContent },
              ],
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) throw new Error(`magpie ${res.status}`);
          const j = await res.json();
          const raw = String(j?.choices?.[0]?.message?.content || '').trim();
          const firstLine = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
          const text = firstLine.replace(/^["“「'‘]+|["”」'’]+$/g, '').trim().slice(0, 120);
          return Response.json({ ok: Boolean(text), text });
        } catch (error) {
          return Response.json({ ok: false, error: error?.message || 'suggest failed' });
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
