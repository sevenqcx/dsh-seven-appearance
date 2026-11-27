import { createReadStream, existsSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
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
    samplesPath: join(root, 'speech-samples.json'),
    eventsPath: join(root, 'suggest-events.jsonl'),
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

const MAX_SPEECH_SAMPLES = 40;
const MAX_SAMPLE_CHARS = 60;

export async function readSpeechSamples(dirs) {
  try {
    if (!existsSync(dirs.samplesPath)) return [];
    const parsed = JSON.parse(await readFile(dirs.samplesPath, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && x.trim()).slice(-MAX_SPEECH_SAMPLES) : [];
  } catch {
    return [];
  }
}

// 记下他真实发过的话，下次生成建议时作为「他平时怎么说」的参考
export async function appendSpeechSample(dirs, text) {
  const flatText = String(text || '').replace(/\s+/g, ' ').trim();
  const firstSentence = flatText.split(/[。！？!?\n]/)[0].trim();
  const clean = firstSentence.length >= 2 && firstSentence.length <= MAX_SAMPLE_CHARS ? firstSentence : '';
  if (!clean) return await readSpeechSamples(dirs);
  const current = await readSpeechSamples(dirs);
  const next = current.filter((x) => x !== clean);
  next.push(clean);
  const trimmed = next.slice(-MAX_SPEECH_SAMPLES);
  await ensureDirs(dirs);
  await writeFile(dirs.samplesPath, JSON.stringify(trimmed, null, 2), 'utf8');
  return trimmed;
}

const MAX_EVENT_LINES = 2000;

// 建议效果的原始事件：出现 / 采纳 / 换一条 / 自己打字放弃
export async function appendSuggestEvent(dirs, event) {
  const kind = String(event?.kind || '');
  if (!['shown', 'accepted', 'cycled', 'dismissed'].includes(kind)) return false;
  const row = {
    t: new Date().toISOString(),
    kind,
    model: String(event?.model || '').slice(0, 120),
    ms: Number.isFinite(event?.ms) ? Math.round(event.ms) : null,
    source: String(event?.source || '').slice(0, 20),
  };
  await ensureDirs(dirs);
  await appendFile(dirs.eventsPath, JSON.stringify(row) + '\n', 'utf8');
  return true;
}

export function summarizeSuggestEvents(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const count = { shown: 0, accepted: 0, cycled: 0, dismissed: 0 };
  const latencies = [];
  const byModel = {};
  for (const row of list) {
    if (!row || !count.hasOwnProperty(row.kind)) continue;
    count[row.kind] += 1;
    if (row.kind === 'shown' && Number.isFinite(row.ms) && row.ms > 0) latencies.push(row.ms);
    const key = row.model || 'unknown';
    if (!byModel[key]) byModel[key] = { shown: 0, accepted: 0 };
    if (row.kind === 'shown') byModel[key].shown += 1;
    if (row.kind === 'accepted') byModel[key].accepted += 1;
  }
  const decided = count.accepted + count.dismissed;
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    ...count,
    acceptRate: decided > 0 ? Math.round((count.accepted / decided) * 1000) / 10 : null,
    latency: sorted.length
      ? {
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p90: sorted[Math.floor(sorted.length * 0.9)] ?? sorted[sorted.length - 1],
        samples: sorted.length,
      }
      : null,
    byModel,
  };
}

async function readSuggestEvents(dirs) {
  try {
    if (!existsSync(dirs.eventsPath)) return [];
    const raw = await readFile(dirs.eventsPath, 'utf8');
    const rows = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line)); } catch { /* skip broken line */ }
    }
    return rows.slice(-MAX_EVENT_LINES);
  } catch {
    return [];
  }
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

// 「解释」要的是最短时间出结果：固定走最快的一档，不跟会话模型走
const EXPLAIN_MAX_CONTEXT = 2400;
const EXPLAIN_MAX_ANSWER_TOKENS = 700;

function buildExplainMessages({ text, context, role, question, history, zh }) {
  const excerpt = String(text || '').trim().slice(0, 3000);
  const around = String(context || '').trim().slice(0, EXPLAIN_MAX_CONTEXT);
  const sys = zh
    ? [
      '你是主人身边的助理。他在读对话时选中了一段文字，要你解释这段是什么意思。',
      '要求：用日常中文，三两句话说清这段在讲什么、为什么这么说；说得越短越好，不寒暄、不复述原文、不加标题和编号，不用列表。',
      '原文是代码、命令或报错时，说清它在做什么、会有什么影响。',
      '他追问时再展开；没问到的不要主动扩展。',
    ].join('\n')
    : [
      'You are the assistant of a busy reader. He selected a passage while reading a conversation and wants to know what it means.',
      'Answer in plain language in two or three short sentences, no greeting, no restating the passage, no headings or lists.',
      'When the passage is code, a command or an error, say what it does and what it affects.',
      'Expand only when he follows up.',
    ].join('\n');
  const block = zh
    ? [
      `【选中的文字，出自${role === 'user' ? '他' : '助手'}说的那一句】`,
      excerpt,
      ...(around ? ['', '【这段所在的整条消息】', around] : []),
    ].join('\n')
    : [
      `【Selected text, from a message by ${role === 'user' ? 'the reader' : 'the assistant'}】`,
      excerpt,
      ...(around ? ['', '【The whole message it came from】', around] : []),
    ].join('\n');
  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: `${block}\n\n${question ? question : (zh ? '解释一下这段是什么意思。' : 'Explain what this passage means.')}` },
  ];
  for (const item of history) {
    if (!item || (item.role !== 'user' && item.role !== 'assistant')) continue;
    const content = String(item.content || '').trim().slice(0, 2000);
    if (content) messages.push({ role: item.role, content });
  }
  return messages;
}

// 把 Magpie 的 SSE 增量直接转成纯文本流，前端边收边显示
function relayExplainStream(upstream) {
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let index = buffer.search(/\r?\n/);
          let out = '';
          while (index !== -1) {
            const line = buffer.slice(0, index).trim();
            buffer = buffer.slice(index + (buffer[index] === '\r' ? 2 : 1));
            if (line.startsWith('data:')) {
              const payload = line.slice(5).trim();
              if (payload && payload !== '[DONE]') {
                try {
                  const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
                  if (typeof delta === 'string') out += delta;
                } catch {
                  // 不完整的 JSON 行，跳过
                }
              }
            }
            index = buffer.search(/\r?\n/);
          }
          if (out) controller.enqueue(encoder.encode(out));
        }
        buffer += decoder.decode();
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

function buildSuggestRequestExtra(model) {
  if (/doubao-seed-2/i.test(String(model || ''))) {
    return { reasoning_effort: 'minimal' };
  }
  return {};
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
          const handoff = body?.handoff === true;
          const exclude = Array.isArray(body?.exclude)
            ? body.exclude.map((x) => String(x || '').trim()).filter(Boolean).slice(-5)
            : [];
          const sysCore = zh
            ? [
              '你要替这位用户想「他接下来可能说什么」，给 3 条候选，每行一条，直接输出，不要编号和引号。',
              '他是谁：项目负责人，不写代码。他关心效果、进度、花多少钱、有什么风险；说话短、直接、不客套。',
              '要求：三条各是一个不同的角度，别只换词；每条 20 字以内；贴住这一轮的具体话题；不用写函数名、报错原文这类只有程序员才说的词。',
            ]
            : [
              "Work out what this user might say next and give 3 candidates, one per line, no numbering and no quotes.",
              'He is a project owner, not a programmer: he cares about results, progress, cost and risk, and speaks briefly and directly without pleasantries.',
              "The three should take different angles, not reword one idea; keep each under 12 words; stay on this turn's topic; avoid developer jargon.",
            ];
          const sys = [
            ...sysCore,
            ...(handoff
              ? [zh
                ? '本轮补充：助手把动作交回给了他（点按钮／授权／粘贴验证码／扫码／刷新）。三条都按「他早就做完了」来写，写做完之后想推进什么，不要让他去做这一步。'
                : 'Extra: the assistant handed an action back to him. All three lines assume he already did it and move on from there.']
              : []),
          ].join('\n');
          const samples = await readSpeechSamples(dirs);
          let promptContent = user ? `用户：${user}\n\n助手：${assistant}` : `助手：${assistant}`;
          if (samples.length > 0) {
            const recent = samples.slice(-12);
            promptContent += zh
              ? `\n\n他平时真这么说过（学他的说法，别照抄）：\n- ${recent.join('\n- ')}`
              : `\n\nThings he has actually typed before (match his voice, do not copy):\n- ${recent.join('\n- ')}`;
          }
          if (exclude.length > 0) {
            promptContent += zh
              ? `\n\n这三条不要和下面重复，换别的方向：\n- ${exclude.join('\n- ')}`
              : `\n\nDo not repeat these; pick other angles:\n- ${exclude.join('\n- ')}`;
          }
          const res = await globalThis.fetch(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
            body: JSON.stringify({
              model,
              max_tokens: 160,
              temperature: exclude.length > 0 ? 0.9 : 0.8,
              ...buildSuggestRequestExtra(model),
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
          const lines = raw
            .split(/\r?\n/)
            .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.、)]|\uff08?\d+\uff09?)\s*/, '').replace(/^["“「'‘]+|["”」'’]+$/g, '').trim())
            .filter((line) => line.length >= 2 && line.length <= 60);
          const seenText = new Set();
          const texts = [];
          for (const line of lines) {
            let text = line.slice(0, 60);
            const asksToDo = /(粘贴|点一下|点继续|去点|复制|扫码|打开|授权|你来|你做)/.test(text);
            const saysDone = /(已经|好了|完了|弄好|完成|搞定|done)/i.test(text);
            if (handoff && asksToDo && !saysDone) {
              text = zh ? '已经弄好了，继续' : 'Done, continue';
            }
            if (seenText.has(text)) continue;
            seenText.add(text);
            texts.push(text);
            if (texts.length >= 3) break;
          }
          return Response.json({ ok: texts.length > 0, text: texts[0] || '', texts });
        } catch (error) {
          return Response.json({ ok: false, error: error?.message || 'suggest failed' });
        }
      },
    },
    {
      // 划词解释：最快模型就地回答，流式吐字；不建会话、不建分支
      path: '/api/dsh-obsidian-prism/explain',
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        try {
          const { base, key } = resolveMagpieEndpoint();
          const body = await request.json();
          const text = String(body?.text || '').trim();
          if (!text) return Response.json({ ok: false, error: 'empty selection' }, { status: 400 });

          const models = await getMagpieTextModels();
          const model = pickFastDefaultModel(models, (process.env.OP_EXPLAIN_MODEL || '').trim());
          if (!model) return Response.json({ ok: false, error: 'No available text model' }, { status: 400 });

          const messages = buildExplainMessages({
            text,
            context: body?.context,
            role: body?.role === 'user' ? 'user' : 'assistant',
            question: body?.question,
            history: Array.isArray(body?.history) ? body.history.slice(-6) : [],
            zh: body?.zh !== false,
          });

          const upstream = await globalThis.fetch(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
            body: JSON.stringify({
              model,
              stream: true,
              temperature: 0.3,
              max_tokens: EXPLAIN_MAX_ANSWER_TOKENS,
              ...buildSuggestRequestExtra(model),
              messages,
            }),
            signal: AbortSignal.timeout(45000),
          });
          if (!upstream.ok) throw new Error(`magpie ${upstream.status}`);

          const type = String(upstream.headers.get('content-type') || '');
          if (!upstream.body || !type.includes('event-stream')) {
            const j = await upstream.json();
            const answer = String(j?.choices?.[0]?.message?.content || '').trim();
            return new Response(answer, {
              headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-op-model': model },
            });
          }
          return new Response(relayExplainStream(upstream), {
            headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-op-model': model },
          });
        } catch (error) {
          return Response.json({ ok: false, error: error?.message || 'explain failed' }, { status: 502 });
        }
      },
    },
    {
      // 记录他真实发过的话，作为下次生成建议时的说话参考
      path: '/api/dsh-obsidian-prism/speech-sample',
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        try {
          const body = await request.json();
          const samples = await appendSpeechSample(dirs, body?.text);
          return Response.json({ ok: true, count: samples.length });
        } catch (error) {
          return Response.json({ ok: false, error: error?.message || 'Failed to store sample' }, { status: 400 });
        }
      },
    },
    {
      // 建议效果：记录出现／采纳／换一条／放弃，并给出汇总
      path: '/api/dsh-obsidian-prism/suggest-event',
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        try {
          const body = await request.json();
          const ok = await appendSuggestEvent(dirs, body);
          return Response.json({ ok });
        } catch (error) {
          return Response.json({ ok: false, error: error?.message || 'Failed to store event' }, { status: 400 });
        }
      },
    },
    {
      path: '/api/dsh-obsidian-prism/suggest-stats',
      methods: ['GET'],
      requestBody: 'buffered',
      async fetch() {
        try {
          const rows = await readSuggestEvents(dirs);
          const samples = await readSpeechSamples(dirs);
          return Response.json({ ok: true, stats: summarizeSuggestEvents(rows), speechSamples: samples.length });
        } catch (error) {
          return Response.json({ ok: false, error: error?.message || 'Failed to read stats' }, { status: 500 });
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
