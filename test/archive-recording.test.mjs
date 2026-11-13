import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { startWebUi } from '../src/web.mjs';

async function fixture(t,{recordingEntry=true}={}) {
  const tempRoot = path.resolve('.tmp');
  await mkdir(tempRoot, { recursive: true });
  const root = await mkdtemp(path.join(tempRoot, 'archive-recording-'));
  const name = path.basename(root);
  const archive = path.join(root, 'download', name);
  const startsFile = path.join(archive, 'scripts', 'recording-data', 'starts.log');
  await mkdir(path.join(archive, 'archive'), { recursive: true });
  await mkdir(path.join(archive, 'scripts', 'internal'), { recursive: true });
  await mkdir(path.dirname(startsFile), { recursive: true });
  await writeFile(path.join(archive, 'archive', 'manifest.json'), JSON.stringify({
    gameTitle: 'Recording Fixture', resources: [],
    runtimeInspection: { engine: 'Construct', coreReady: true, coreFiles: [] }
  }));
  await writeFile(path.join(archive, 'scripts', 'internal', recordingEntry?'record-levels.mjs':'run-auto.mjs'),
    "import {appendFile} from 'node:fs/promises';\nif(process.argv.includes('--end'))throw Error('Daily launcher must not force a finite ending');\nawait appendFile('scripts/recording-data/starts.log', 'started\\n');\nsetInterval(() => {}, 1000);\n");
  const { server, url } = await startWebUi({
    port: 0, startAnalyzer: false, downloadRoot: path.join(root, 'download'),
    databasePath: path.join(root, 'archives.sqlite')
  });
  const pids = new Set();
  t.after(async () => {
    for (const pid of pids) {
      try { process.kill(pid); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(root), tempRoot);
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  async function start() {
    const response = await fetch(`${url}/api/archives/${name}/start-record`, { method: 'POST' });
    const body = await response.json();
    if (body.pid) pids.add(body.pid);
    return { status: response.status, body };
  }
  async function recording() {
    const { archives } = await (await fetch(`${url}/api/archives`)).json();
    return archives.find(item => item.name === name).recording;
  }
  return { start, recording, startsFile };
}

test('a live task is shown as recording before its first video exists', async t => {
  const { start, recording } = await fixture(t);
  assert.equal((await start()).status, 200);
  const state = await recording();
  assert.equal(state.status, 'recording');
  assert.equal(state.isRecording, true);
  assert.equal(state.videoCount, 0);
});

test('starting an already running task returns its existing PID', async t => {
  const { start } = await fixture(t);
  const first = await start();
  assert.equal(first.status, 200);
  const second = await start();
  assert.equal(second.status, 200);
  assert.equal(second.body.pid, first.body.pid);
  assert.equal(second.body.alreadyRunning, true);
});

test('simultaneous start requests launch only one worker', async t => {
  const { start, startsFile } = await fixture(t);
  const results = await Promise.all([start(), start()]);
  for (const result of results) assert.equal(result.status, 200);
  assert.equal(results[0].body.pid, results[1].body.pid);
  let starts = '';
  for (let attempt = 0; attempt < 100; attempt++) {
    try { starts = await readFile(startsFile, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (starts) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(starts, 'started\n');
});

test('a gameplay-only legacy worker is not reported as a recorder',async t=>{
  const {start}=await fixture(t,{recordingEntry:false});const result=await start();
  assert.equal(result.status,400);assert.match(result.body.error,/只支持游玩/);
});
