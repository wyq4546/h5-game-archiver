import { spawn, spawnSync } from 'node:child_process';
import { appendFile, copyFile, mkdir, rm, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [sourceDirectory, outputDirectory, maxLevelText, ...options] = process.argv.slice(2);
const firstSourceIndex = options.indexOf('--first-level-source');
const firstLevelSource = firstSourceIndex < 0 ? null : options[firstSourceIndex + 1];
const replacementsIndex = options.indexOf('--replacements');
const replacements = replacementsIndex < 0 ? {} : JSON.parse(options[replacementsIndex + 1]);
const maxLevel = Number(maxLevelText);
if (!sourceDirectory || !outputDirectory || !Number.isInteger(maxLevel) || maxLevel < 1) {
  throw new Error('Usage: node scripts/native-tiktok-cutter.mjs <full-recording-dir> <output-dir> <max-level>');
}
const probe = file => {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate', '-of', 'json', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`ffprobe failed for ${file}: ${result.stderr}`);
  return JSON.parse(result.stdout);
};
const trimPlan = duration => {
  if (duration <= 40) return [{ start: 0, duration }];
  const count = Math.min(6, Math.max(2, Math.ceil(duration / 12)));
  const length = 35.5 / count;
  const gap = (duration - 35.5) / (count - 1);
  return Array.from({ length: count }, (_, i) => ({ start: i * (length + gap), duration: length }));
};
const cut = (input, output, segments) => new Promise((resolve, reject) => {
  const argv = ['-hide_banner', '-loglevel', 'error', '-y'];
  for (const segment of segments) argv.push('-ss', segment.start.toFixed(6), '-t', segment.duration.toFixed(6), '-i', input);
  const filters = [];
  for (let i = 0; i < segments.length; i++) {
    filters.push(`[${i}:v]setpts=PTS-STARTPTS,format=yuv420p[v${i}]`);
    filters.push(`[${i}:a]asetpts=PTS-STARTPTS,aresample=48000[a${i}]`);
  }
  filters.push(`${segments.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${segments.length}:v=1:a=1[v][a]`);
  argv.push('-filter_complex', filters.join(';'), '-map', '[v]', '-map', '[a]',
    '-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', '21', '-b:v', '0', '-pix_fmt', 'yuv420p',
    '-r', '60', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output);
  const child = spawn('ffmpeg', argv, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  child.on('error', reject);
  child.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr}`)));
});

await mkdir(outputDirectory, { recursive: true });
const manifest = path.join(outputDirectory, 'manifest.jsonl');
await writeFile(manifest, '');
for (let level = 1; level <= maxLevel; level++) {
  const name = `level-${String(level).padStart(6, '0')}.mp4`;
  const source = replacements[level] || (level === 1 && firstLevelSource ? firstLevelSource : path.join(sourceDirectory, name));
  const output = path.join(outputDirectory, name);
  const temporary = path.join(outputDirectory, `.${name}`);
  const original = probe(source);
  const sourceSeconds = Number(original.format.duration);
  if (sourceSeconds < 1 || !original.streams.some(s => s.codec_name === 'h264') || !original.streams.some(s => s.codec_name === 'aac')) {
    throw new Error(`${name} is too short or lacks video/audio: ${sourceSeconds}s`);
  }
  const segments = trimPlan(sourceSeconds);
  try {
    if (segments.length === 1) await copyFile(source, temporary);
    else await cut(source, temporary, segments);
    const result = probe(temporary);
    const seconds = Number(result.format.duration);
    const video = result.streams.find(s => s.codec_name === 'h264');
    if (seconds < 1 || seconds > 40 || video?.width !== 1080 || video?.height !== 1920 || video?.r_frame_rate !== '60/1' || !result.streams.some(s => s.codec_name === 'aac')) {
      throw new Error(`${name} invalid export: ${seconds.toFixed(3)}s`);
    }
    await rename(temporary, output);
    await appendFile(manifest, JSON.stringify({ level, source, output, sourceSeconds, seconds, playbackSpeed: 1, jumpCuts: segments.length - 1, segments, repairedLayout: sourceDirectory.includes('Color-Maze-Puzzle-2026') && (level === 61 || level === 66) }) + '\n');
    console.log(`NATIVE TIKTOK ${level} ${seconds.toFixed(2)}s cuts=${segments.length - 1}`);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
console.log('SUCCESS', maxLevel, outputDirectory);
