import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runLevels } from './runner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

// Parse CLI flags
const args = process.argv.slice(2);
let startLevel = 1;
let startLevelSpecified = false;
let endLevel = 10;
let record = true;
let visible = false;
let outputDir = null;
let batchName = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--start' && args[i + 1]) {
    startLevel = parseInt(args[++i], 10);
    startLevelSpecified = true;
  } else if (arg === '--end' && args[i + 1]) {
    endLevel = parseInt(args[++i], 10);
  } else if (arg === '--levels' && args[i + 1]) {
    endLevel = parseInt(args[++i], 10);
  } else if (arg === '--record') {
    record = true;
  } else if (arg === '--no-record' || arg === '--play') {
    record = false;
  } else if (arg === '--visible') {
    visible = true;
  } else if (arg === '--headless') {
    visible = false;
  } else if (arg === '--output' && args[i + 1]) {
    outputDir = args[++i];
  } else if (arg === '--batch' && args[i + 1]) {
    batchName = args[++i];
  }
}

console.log(`Starting Beauty Fight Automation:`);
console.log(`  Root: ${root}`);
console.log(`  Start Level: ${startLevelSpecified ? startLevel : 'Auto/Resume'}`);
console.log(`  End Level: ${endLevel || 'Infinite'}`);
console.log(`  Record: ${record}`);
console.log(`  Visible: ${visible}`);
if (batchName) console.log(`  Batch: ${batchName}`);

runLevels({
  root,
  startLevel,
  startLevelSpecified,
  endLevel,
  record,
  visible,
  outputDir,
  batchName
}).then(res => {
  console.log(`Automation successfully completed ${res.reports.length} levels!`);
  process.exit(0);
}).catch(err => {
  console.error(`Automation failed:`, err);
  process.exit(1);
});
