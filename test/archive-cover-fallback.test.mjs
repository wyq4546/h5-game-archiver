import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startWebUi } from '../src/web.mjs';

const pngSignature = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

async function withServer(setup, run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'h5-cover-fallback-'));
  const downloadRoot = path.join(root, 'download');
  await setup(downloadRoot);
  const { server, url } = await startWebUi({
    port: 0, startAnalyzer: false, downloadRoot,
    databasePath: path.join(root, 'archives.sqlite')
  });
  try {
    await run(url, downloadRoot);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
}

async function makeArchive(downloadRoot, name) {
  const archiveRoot = path.join(downloadRoot, name);
  await mkdir(path.join(archiveRoot, 'archive'), { recursive: true });
  await mkdir(path.join(archiveRoot, 'preview'), { recursive: true });
  await writeFile(path.join(archiveRoot, 'archive', 'manifest.json'), JSON.stringify({ gameTitle: name, resources: [] }));
  return archiveRoot;
}

test('archive without a saved cover serves the replay screenshot as thumbnail', async () => {
  await withServer(async downloadRoot => {
    const archiveRoot = await makeArchive(downloadRoot, 'Screenshot-Game');
    await writeFile(path.join(archiveRoot, 'preview', 'local.png'), Buffer.concat([pngSignature, Buffer.alloc(64, 7)]));
  }, async url => {
    const response = await fetch(`${url}/api/archives/Screenshot-Game/cover`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('x-cover-source'), 'screenshot');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()).subarray(0, 8), pngSignature.subarray(0, 8));
  });
});

test('capture-end screenshot is used when the replay screenshot is missing', async () => {
  await withServer(async downloadRoot => {
    const archiveRoot = await makeArchive(downloadRoot, 'Shell-Only-Game');
    await writeFile(path.join(archiveRoot, 'preview', 'capture-end.png'), Buffer.concat([pngSignature, Buffer.alloc(32, 3)]));
  }, async url => {
    const response = await fetch(`${url}/api/archives/Shell-Only-Game/cover`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-cover-source'), 'screenshot');
  });
});

test('saved cover still wins over the screenshot fallback', async () => {
  const coverBytes = Buffer.concat([pngSignature, Buffer.alloc(128, 9)]);
  await withServer(async downloadRoot => {
    const archiveRoot = await makeArchive(downloadRoot, 'Covered-Game');
    await writeFile(path.join(archiveRoot, 'preview', 'local.png'), Buffer.concat([pngSignature, Buffer.alloc(64, 7)]));
    await writeFile(path.join(archiveRoot, 'preview', 'cover.json'), JSON.stringify({
      source: 'website', mime: 'image/png', width: 512, height: 384, image: coverBytes.toString('base64')
    }));
  }, async url => {
    const response = await fetch(`${url}/api/archives/Covered-Game/cover`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-cover-source'), null);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), coverBytes);
  });
});

test('archive with neither cover nor screenshot keeps returning 404', async () => {
  await withServer(async downloadRoot => {
    await makeArchive(downloadRoot, 'Empty-Game');
  }, async url => {
    const response = await fetch(`${url}/api/archives/Empty-Game/cover`);
    assert.equal(response.status, 404);
  });
});
