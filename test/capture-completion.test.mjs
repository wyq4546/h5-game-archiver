import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { captureGame } from '../src/capture.mjs';

test('capture reassesses runtime readiness after completing a declared Unity build over HTTP', async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    if (req.url === '/game/index.html') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<title>Build Completion Fixture</title><canvas width="300" height="500"></canvas><script>
        const buildUrl="Build";const loaderUrl=buildUrl+"/fixture.loader.js";
        const config={dataUrl:buildUrl+"/fixture.data",codeUrl:buildUrl+"/fixture.wasm",frameworkUrl:buildUrl+"/fixture.framework.js"};
        // SDK gate never calls createUnityInstance(); dependencies must still be completed.
        </script>`);
    } else if (/^\/game\/Build\/fixture\.(?:loader\.js|framework\.js|wasm|data)$/.test(req.url)) {
      res.writeHead(200, { 'content-type': req.url.endsWith('.js') ? 'application/javascript' : 'application/octet-stream' });
      res.end(req.url.endsWith('.wasm') ? Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]) : '// fixture build bytes');
    } else { res.writeHead(404); res.end('missing'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const temporaryRoot = path.resolve('.tmp');
  await mkdir(temporaryRoot, { recursive: true });
  const output = await mkdtemp(path.join(temporaryRoot, 'capture-completion-'));
  try {
    const result = await captureGame({ url: `http://127.0.0.1:${server.address().port}/game/index.html`, output, headless: true, interact: false, duration: 0 });
    assert.ok(requests.includes('/game/Build/fixture.wasm'));
    assert.equal(result.manifest.assetCompletion.fetchedAssets, 4);
    assert.equal(result.manifest.runtimeInspection.coreReady, true);
    assert.equal(result.manifest.completeness.status, 'core-complete');
    const saved = JSON.parse(await readFile(path.join(result.captureRoot, 'archive/manifest.json'), 'utf8'));
    assert.equal(saved.runtimeInspection.coreReady, true);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(output), temporaryRoot);
    await rm(output, { recursive: true, force: true });
  }
});
