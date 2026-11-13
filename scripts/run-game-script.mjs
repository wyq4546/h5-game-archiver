import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const gameDirectory = valueAfter('--game');
const scriptName = valueAfter('--script');

if (!gameDirectory || !scriptName) {
  console.error('用法：npm run play:game -- --game "游戏归档目录" --script play-level1 [--headless]');
  process.exit(1);
}

const safeName = path.basename(scriptName, path.extname(scriptName));
const directPath = path.resolve(gameDirectory, 'scripts', `${safeName}.mjs`);
const scriptPath = existsSync(directPath) ? directPath : path.resolve(gameDirectory, 'scripts', 'internal', `${safeName}.mjs`);

if (!existsSync(scriptPath)) {
  console.error(`没有找到该游戏的脚本：${scriptPath}`);
  process.exit(1);
}

await import(pathToFileURL(scriptPath).href);
