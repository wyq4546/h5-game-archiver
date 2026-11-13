import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startWebUi } from '../src/web.mjs';

test('archive list exposes Construct decoding coverage rather than only file counts', async () => {
  const tmp = path.resolve('.tmp');
  await mkdir(tmp, { recursive: true });
  const root = await mkdtemp(path.join(tmp, 'construct-list-'));
  const archiveRoot = path.join(root, 'download', 'Tilo');
  await mkdir(path.join(archiveRoot, 'archive'), { recursive: true });
  await mkdir(path.join(archiveRoot, 'analysis'), { recursive: true });
  await writeFile(path.join(archiveRoot, 'archive/manifest.json'), JSON.stringify({ gameTitle: 'Tilo', resources: [], runtimeInspection: { engine: 'Construct', confidence: 'high', coreReady: true, coreFiles: [] } }));
  await writeFile(path.join(archiveRoot, 'analysis/report.json'), JSON.stringify({ engine: 'Construct', counts: { gameTextSources: 15 }, construct: { status: 'partial', format: 'construct2-export', counts: { conditions: 235, actions: 357 }, warnings: [{ kind: 'expression' }] } }));
  const { server, url } = await startWebUi({ port: 0, startAnalyzer: false, downloadRoot: path.join(root, 'download'), databasePath: path.join(root, 'archives.sqlite') });
  try {
    const response = await fetch(`${url}/api/archives`);
    const { archives } = await response.json();
    assert.equal(archives[0].analysis.construct?.status, 'partial');
    assert.equal(archives[0].analysis.construct.counts.conditions, 235);
    assert.equal(archives[0].analysis.construct.unresolved, 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(root), tmp);
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('archive list uses saved runtime inspection without rescanning game files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'h5-archive-list-'));
  const downloadRoot = path.join(root, 'download');
  const archiveRoot = path.join(downloadRoot, 'Saved-Game');
  await mkdir(path.join(archiveRoot, 'archive'), { recursive: true });
  await writeFile(path.join(archiveRoot, 'archive', 'manifest.json'), JSON.stringify({
    sourceUrl: 'https://example.com/saved-game',
    gameTitle: 'Saved Game',
    resources: [],
    runtimeInspection: {
      engine: 'LayaAir 3D', confidence: 'high', coreReady: true,
      coreFiles: ['game/index.js'], coreRule: 'saved at capture time'
    }
  }));
  const { server, url } = await startWebUi({
    port: 0, startAnalyzer: false, downloadRoot,
    databasePath: path.join(root, 'archives.sqlite')
  });
  try {
    const response = await fetch(`${url}/api/archives`);
    assert.equal(response.status, 200);
    const { archives } = await response.json();
    assert.equal(archives.length, 1);
    assert.equal(archives[0].runtime.engine, 'LayaAir 3D');
    assert.equal(archives[0].runtime.coreReady, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
    assert.ok(root.startsWith(path.resolve(os.tmpdir()) + path.sep));
    await rm(root, { recursive: true, force: true });
  }
});
