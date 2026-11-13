import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [archive, countText] = process.argv.slice(2);
const count = Number(countText);
if (!archive || !Number.isInteger(count) || count < 1) {
  throw new Error('Usage: node scripts/make-natural-videos.mjs <archive> <level-count>');
}
const scripts = path.resolve(archive, 'scripts');
const index = JSON.parse(await readFile(path.join(scripts, 'logs/natural-full-success.json'), 'utf8'));
if (index.completed !== count || !index.videoDirectory || !index.resultFile) {
  throw new Error(`No complete natural-speed 1–${count} recording batch`);
}
const rows = (await readFile(index.resultFile, 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
if (rows.length !== count || rows.some((row, i) => row.level !== i + 1 || row.pace !== 'natural-v2' || (row.win !== undefined && row.win !== 1) || row.painted !== (row.cubes ?? row.total))) {
  throw new Error('The natural-speed batch has missing levels or incomplete wins');
}
const cutter = fileURLToPath(new URL('./native-tiktok-cutter.mjs', import.meta.url));
const output = path.join(scripts, 'video', `tiktok-natural-${count}`);
const replacements = await readFile(path.join(scripts, 'logs/natural-replacements.json'), 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return {};
  throw error;
});
const args = [cutter, index.videoDirectory, output, String(count)];
if (Object.keys(replacements).length) args.push('--replacements', JSON.stringify(replacements));
const child = spawn(process.execPath, args, { stdio: 'inherit' });
child.on('error', error => { throw error; });
child.on('close', code => { process.exitCode = code ?? 1; });
