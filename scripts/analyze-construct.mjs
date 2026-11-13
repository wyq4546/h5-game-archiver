import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { analyzeCapturedGame, inspectCapturedRuntime } from '../src/source-analysis.mjs';

const argument = process.argv[2];
if (!argument) {
  console.error('用法：npm run construct -- download/<游戏归档目录>');
  process.exitCode = 1;
} else {
  const root = path.resolve(argument);
  const manifest = JSON.parse(await readFile(path.join(root, 'archive/manifest.json'), 'utf8'));
  const inspection = await inspectCapturedRuntime(root, manifest);
  if (inspection.engine !== 'Construct') throw new Error(`该归档识别为 ${inspection.engine}，不是 Construct。`);
  const report = await analyzeCapturedGame(root, manifest, event => { if (event.message) console.log(event.message); });
  console.log(JSON.stringify({ status: report.construct.status, counts: report.construct.counts, warnings: report.construct.warnings.length, output: path.join(root, 'analysis/construct') }, null, 2));
  if (report.construct.status !== 'decoded') process.exitCode = 2;
}
