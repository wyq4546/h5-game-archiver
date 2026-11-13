import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runLevels } from './runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const scriptsDir = path.resolve(__dirname, '..');
const dataRoot = path.join(scriptsDir, 'recording-data');
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

// --from-fail：从上一批次中断的那一关继续（读 checkpoint.json 的 nextLevel）
const readCheckpointLevel = batchName => {
  try {
    const pick = batchName
      ? path.join(dataRoot, batchName)
      : fs.readdirSync(dataRoot, { withFileTypes: true })
          .filter(d => d.isDirectory() && d.name.startsWith('recording-') && fs.existsSync(path.join(dataRoot, d.name, 'checkpoint.json')))
          .map(d => path.join(dataRoot, d.name))
          .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    if (!pick) return null;
    const file = path.join(pick, 'checkpoint.json');
    if (!fs.existsSync(file)) return null;
    const next = JSON.parse(fs.readFileSync(file, 'utf8')).nextLevel;
    return Number.isFinite(next) ? next : null;
  } catch {
    return null;
  }
};

const record = !args.includes('--play') && !args.includes('--no-record');
const visible = args.includes('--visible');
const batch = opt('--batch', null);
// --only N 等价于 --start-level N --end N，专门用来只跑某一关
const only = num('--only', null);
let startLevel = only ?? num('--start-level', num('--start', 1));

// 自动续跑兜底：每次都用 --start 1 会把已经录好的 1..N 关全部重录一遍。
// 只要没显式 --from-fail / --force-restart，且给的是 --start 1（或不给 start），
// 就直接改用 checkpoint.json 里的 nextLevel 接着跑。
if (only == null && !args.includes('--from-fail') && !args.includes('--force-restart') && startLevel <= 1) {
  const resumed = readCheckpointLevel(batch);
  if (resumed != null && resumed > 1) {
    console.log('');
    console.log('==================================================');
    console.log(`[auto-resume] 收到 --start ${startLevel}，但 checkpoint 已到第 ${resumed} 关`);
    console.log(`[auto-resume] 自动改为从第 ${resumed} 关开始，跳过已录的 1-${resumed - 1} 关`);
    console.log('[auto-resume] 真要全部重录，请显式加 --force-restart');
    console.log('==================================================');
    console.log('');
    startLevel = resumed;
  }
}

if (only == null && args.includes('--from-fail')) {
  const resumed = readCheckpointLevel(batch);
  if (resumed != null) {
    startLevel = resumed;
    console.log(`[from-fail] 按 checkpoint 从第 ${resumed} 关开始`);
  } else {
    console.log('[from-fail] 没找到可用 checkpoint，仍从第 1 关开始');
  }
}
const levels = num('--levels', null);
let endLevel = only ?? num('--end', null);
if (endLevel == null) endLevel = startLevel + (levels ?? 10) - 1;
if (endLevel <= 0) endLevel = startLevel + 99;   // --end 0 = 不限关数
if (endLevel < startLevel) endLevel = startLevel + (levels ?? 10) - 1;  // auto-resume 后修正
const winTailMs = num('--win-tail-ms', 400);
const deadlineMs = num('--deadline', 95000);
const attempts = num('--attempts', 4);

if (args.includes('--dry-run')) {
  console.log(`[dry-run] 计划：第 ${startLevel} 关 → 第 ${endLevel} 关｜模式 ${record ? '录制' : '纯游玩'}｜批次 ${batch || '(新建)'}`);
  process.exit(0);
}

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
