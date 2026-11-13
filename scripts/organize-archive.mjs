import { access, copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { safeSlug } from '../src/utils.mjs';

const source = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('用法：npm run organize -- <旧归档目录>');

const oldManifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
const gameUrl = oldManifest.gameUrl || oldManifest.finalUrl || oldManifest.sourceUrl;
const gamePathName = new URL(gameUrl).pathname.split('/').filter(Boolean).at(-1) || '';
const sourcePathName = new URL(oldManifest.sourceUrl).pathname.split('/').filter(Boolean).at(-1) || '';
const urlName = /^(?:index\.html|[a-f0-9]{20,})$/i.test(gamePathName)
  ? sourcePathName || gamePathName
  : gamePathName || sourcePathName || new URL(gameUrl).hostname;
const gameTitle = oldManifest.gameTitle
  || urlName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
let target = path.join(path.dirname(source), safeSlug(gameTitle));
for (let suffix = 2; ; suffix += 1) {
  try {
    await access(target);
    target = path.join(path.dirname(source), `${safeSlug(gameTitle)}-${suffix}`);
  } catch {
    break;
  }
}

await mkdir(path.join(target, 'archive'), { recursive: true });
await mkdir(path.join(target, 'preview'), { recursive: true });
await cp(path.join(source, 'resources'), path.join(target, 'game'), { recursive: true });

const manifest = structuredClone(oldManifest);
manifest.version = 2;
manifest.layoutVersion = 2;
manifest.gameTitle = gameTitle;
for (const item of manifest.resources) {
  if (item.path?.startsWith('resources/')) item.path = `game/${item.path.slice('resources/'.length)}`;
}
await writeFile(path.join(target, 'archive', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

for (const filename of ['session.har', 'verification.json']) {
  await copyFile(path.join(source, filename), path.join(target, 'archive', filename)).catch(() => {});
}
for (const filename of ['final.png', 'offline.png', 'played.png', 'no-platform-ui.png']) {
  await copyFile(path.join(source, filename), path.join(target, 'preview', filename)).catch(() => {});
}

const entry = manifest.resources
  .filter(item => item.saved && item.type === 'document' && item.path)
  .sort((a, b) => new URL(b.url).pathname.length - new URL(a.url).pathname.length)[0];
if (entry) await copyFile(path.join(target, entry.path), path.join(target, 'index.html'));

await writeFile(path.join(target, 'README.txt'), [
  `游戏：${gameTitle}`,
  '',
  'index.html       游戏入口源码（请通过回放服务运行）',
  'game/            游戏脚本、图片、音频、模型等资源',
  'archive/         抓包记录与资源映射清单',
  'preview/         抓取及验证截图',
  '',
  `启动：npm run replay -- --archive "${target}" --port 8080`
].join('\r\n'));

console.log(target);
