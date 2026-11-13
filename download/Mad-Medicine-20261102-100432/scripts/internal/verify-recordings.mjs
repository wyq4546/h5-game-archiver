import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptRecordedClip } from '../../../../src/recording-acceptance.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');
const videosRoot = path.join(root, 'scripts/video');
const dataRoot = path.join(root, 'scripts/recording-data');
const only = process.argv[2] || null;

const batches = (await fs.readdir(videosRoot, { withFileTypes: true }).catch(() => []))
  .filter(entry => entry.isDirectory() && /^recording-\d{4}-\d\d-\d\dT/.test(entry.name))
  .map(entry => entry.name)
  .filter(name => !only || name === only)
  .sort();

let checked = 0;
let failed = 0;

for (const batch of batches) {
  const videoDir = path.join(videosRoot, batch);
  const dataDir = path.join(dataRoot, batch);
  const report = await fs.readFile(path.join(dataDir, 'report.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (!report) {
    console.log(`[Skip] ${batch}: Missing report.json`);
    continue;
  }

  // Directory purity check: video batch directory must ONLY contain level-00000N.mp4
  const stray = [];
  for (const entry of await fs.readdir(videoDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^level-\d{6}\.mp4$/.test(entry.name)) stray.push(entry.name);
  }
  if (stray.length) {
    failed += 1;
    console.log(`[FAIL] ${batch} video dir contains extraneous files: ${stray.join(', ')}`);
  }

  const levels = report.levels || report.completedLevels || [];
  for (const level of levels) {
    const video = level.videoMeta || level.video;
    if (!video?.file) {
      failed += 1;
      console.log(`[FAIL] ${batch} Level ${level.level}: Missing video metadata`);
      continue;
    }
    try {
      const result = await acceptRecordedClip(video, dataDir, { width: 1080, height: 1920, nativePassed: true });
      checked += 1;
      console.log(`[PASS] ${batch} Level ${String(level.level).padStart(6, '0')} ${path.basename(video.file)} ${result.duration?.toFixed(2)}s Native: ${result.nativeRefreshFps?.toFixed(2)} FPS, Encoded: ${result.nativeEncodedFps?.toFixed(2)} FPS`);
    } catch (error) {
      failed += 1;
      console.log(`[FAIL] ${batch} Level ${level.level}: ${error.message}`);
    }
  }
}

console.log(`\nVerification finished: ${batches.length} batch(es), ${checked} clip(s) passed, ${failed} failure(s)`);
if (failed) process.exitCode = 2;
