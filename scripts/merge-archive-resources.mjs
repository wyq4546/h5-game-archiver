import { cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const sourceRoot = path.resolve(valueAfter('--source') || '');
const targetRoot = path.resolve(valueAfter('--target') || '');
if (!sourceRoot || !targetRoot) {
  throw new Error('用法：node scripts/merge-archive-resources.mjs --source <补抓归档> --target <目标归档>');
}

const manifestAt = root => path.join(root, 'archive', 'manifest.json');
const [sourceManifest, targetManifest] = await Promise.all([
  readFile(manifestAt(sourceRoot), 'utf8').then(JSON.parse),
  readFile(manifestAt(targetRoot), 'utf8').then(JSON.parse)
]);

await cp(path.join(sourceRoot, 'game'), path.join(targetRoot, 'game'), {
  recursive: true,
  force: true
});

const identity = item => `${item.method || 'GET'} ${item.url}`;
const merged = new Map(targetManifest.resources.map(item => [identity(item), item]));
for (const item of sourceManifest.resources) {
  const existing = merged.get(identity(item));
  if (!existing || (!existing.saved && item.saved)) merged.set(identity(item), item);
}

const uniqueObjects = values => [...new Map(values.map(value => [JSON.stringify(value), value])).values()];
targetManifest.resources = [...merged.values()];
targetManifest.pages = uniqueObjects([...(targetManifest.pages || []), ...(sourceManifest.pages || [])]);
targetManifest.frames = uniqueObjects([...(targetManifest.frames || []), ...(sourceManifest.frames || [])]);
targetManifest.gameUrl = sourceManifest.sourceUrl;
targetManifest.recoveredGameArchive = path.basename(sourceRoot);
targetManifest.recoveredAt = new Date().toISOString();

await writeFile(manifestAt(targetRoot), `${JSON.stringify(targetManifest, null, 2)}\n`);
console.log(`已合并资源：${sourceManifest.resources.filter(item => item.saved).length}`);
console.log(`目标资源总数：${targetManifest.resources.filter(item => item.saved).length}`);
console.log(`真实游戏入口：${targetManifest.gameUrl}`);
