import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runLevels } from './runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback;
};
const num = (name, fallback) => {
  const raw = opt(name, null);
  const value = Number(raw);
  return raw == null || !Number.isFinite(value) ? fallback : value;
};

const record = !args.includes('--play') && !args.includes('--no-record');
const visible = args.includes('--visible');
const startLevel = num('--start-level', num('--start', 1));
const levels = num('--levels', null);
let endLevel = num('--end', null);
if (endLevel == null) endLevel = startLevel + (levels ?? 10) - 1;
if (endLevel <= 0) endLevel = startLevel + 99;   // --end 0 = 不限关数
const batch = opt('--batch', null);
const winTailMs = num('--win-tail-ms', 1200);
const deadlineMs = num('--deadline', 95000);
const attempts = num('--attempts', 4);

console.log(`Mad Medicine 自动化：root=${root}`);
console.log(`  模式 ${record ? '录制' : '纯游玩'}｜关卡 ${startLevel}-${endLevel}｜批次 ${batch || '(新建)'}｜通关尾巴 ${winTailMs}ms｜每关最多 ${attempts} 次`);

runLevels({ root, startLevel, endLevel, record, visible, batch, winTailMs, deadlineMs, attempts })
  .then(result => {
    console.log(`批次结束：${result.batchName}，本次记录 ${result.reports.length} 关`);
    process.exit(0);
  })
  .catch(error => {
    console.error(`自动化失败：${error.stack || error.message}`);
    process.exit(1);
  });
