import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, resourcePath, sha256 } from '../src/utils.mjs';
import { assessCompleteness, retryTransientResource } from '../src/capture.mjs';
import { inspectCapturedRuntime } from '../src/source-analysis.mjs';
import { classifyOfflineCacheRequests } from '../src/offline-cache.mjs';

function inferResourceType(urlStr, contentType = '', fallback = 'fetch') {
  try {
    const pathname = new URL(urlStr).pathname.toLowerCase();
    if (/\.(?:png|jpe?g|gif|webp|svg|ico)(?:$|\?)/i.test(pathname) || /^image\//i.test(contentType)) return 'image';
    if (/\.(?:mp3|wav|ogg|aac|m4a|mp4|webm)(?:$|\?)/i.test(pathname) || /^(?:audio|video)\//i.test(contentType)) return 'media';
    if (/\.(?:ttf|otf|woff2?|eot)(?:$|\?)/i.test(pathname) || /^font\//i.test(contentType)) return 'font';
    if (/\.(?:css)(?:$|\?)/i.test(pathname) || /text\/css/i.test(contentType)) return 'stylesheet';
    if (/\.(?:js|mjs)(?:$|\?)/i.test(pathname) || /javascript/i.test(contentType)) return 'script';
    if (/\.(?:html?)(?:$|\?)/i.test(pathname) || /text\/html/i.test(contentType)) return 'document';
  } catch {}
  return fallback;
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const archiveRoot = path.resolve(valueAfter('--archive') || '');
const urls = process.argv.slice(process.argv.indexOf('--url') + 1).filter(value => /^https?:\/\//.test(value));
if (!archiveRoot || !urls.length) throw new Error('用法：node scripts/add-archive-resources.mjs --archive <目录> --url <URL...>');

const manifestPath = path.join(archiveRoot, 'archive', 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

for (const url of urls) {
  const existingIndex = manifest.resources.findIndex(item => (item.method || 'GET') === 'GET' && item.url === url);
  const existing = existingIndex >= 0 ? manifest.resources[existingIndex] : null;
  if (existing?.saved && existing.bytes > 0 && existing.status >= 200 && existing.status < 300) continue;
  const downloaded = await retryTransientResource(async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`补抓返回 HTTP ${response.status}`);
    const body=Buffer.from(await response.arrayBuffer());
    if(inferResourceType(url)!=='document'&&/^\s*(?:<!doctype\s+html|<html\b)/i.test(body.toString('utf8',0,1024)))throw new Error('Expected asset, received HTML: '+url);
    return {
      body,
      contentType: response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream',
      status: response.status
    };
  }, {
    onRetry: ({ attempt, delayMs, error }) => console.warn(`补抓失败，将在 ${delayMs}ms 后重试（${attempt}/3）：${error}`)
  });
  const { body, contentType, status } = downloaded;
  const destination = resourcePath(archiveRoot, url, contentType, '', 'game');
  await ensureDir(path.dirname(destination));
  await writeFile(destination, body);
  const item = {
    ...existing,
    url,
    method: 'GET',
    status,
    type: existing?.type && existing.type !== 'fetch' && existing.type !== 'other' ? existing.type : inferResourceType(url, contentType, 'fetch'),
    contentType,
    saved: true,
    bytes: body.length,
    sha256: sha256(body),
    path: path.relative(archiveRoot, destination).replaceAll('\\', '/'),
    recoveredBy: 'resource-repair'
  };
  delete item.error;
  delete item.ignored;
  if (existingIndex >= 0) manifest.resources[existingIndex] = item;
  else manifest.resources.push(item);
  console.log(`已补齐：${url}`);
}

manifest.runtimeInspection = await inspectCapturedRuntime(archiveRoot, manifest);
await classifyOfflineCacheRequests(archiveRoot, manifest);
manifest.completeness = assessCompleteness(manifest);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
