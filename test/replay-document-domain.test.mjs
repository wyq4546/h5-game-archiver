import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createReplayServer } from '../src/replay.mjs';

test('a portal document.domain assignment cannot abort offline replay', async () => {
  // 门户页头部的 document.domain = '<父域>' 在 127.0.0.1 上必然抛 SecurityError，
  // 而它往往是页面最早的独立脚本：异常会让后续初始化整段不执行，被误判成回放失败。
  const root = path.resolve('.tmp/domain-replay-regression');
  await mkdir(path.join(root, 'archive'), { recursive: true });
  const source = 'https://flash.example.com/game/index.html';
  const document = `<!DOCTYPE html><html><head><script>document.domain='example.com'</script></head>
<body><script>window.booted = true; window.reportedDomain = document.domain;</script></body></html>`;
  await writeFile(path.join(root, 'index.html'), document);
  await writeFile(path.join(root, 'archive/manifest.json'), JSON.stringify({
    gameUrl: source,
    resources: [{ url: source, method: 'GET', status: 200, saved: true, type: 'document', contentType: 'text/html', path: 'index.html' }]
  }));

  const replay = await createReplayServer(root);
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(replay.url).origin ? route.continue() : route.abort());
    await page.goto(replay.url);
    await page.waitForFunction(() => window.booted === true, null, { timeout: 3000 });
    assert.deepEqual(pageErrors, []);
    assert.equal(await page.evaluate(() => window.reportedDomain), '127.0.0.1');
  } finally {
    await browser.close();
    replay.server.closeAllConnections();
    await new Promise(resolve => replay.server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
