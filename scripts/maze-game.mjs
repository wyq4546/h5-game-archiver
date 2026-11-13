import { chromium } from 'playwright';
import { createReplayServer } from '../src/replay.mjs';
import { installGameAudioCapture, recordingBrowserArgs } from '../src/game-video-recorder.mjs';

export async function openMazeGame(archive, { record, startButtonY, resourcePatch }) {
  const replay = await createReplayServer(archive);
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: recordingBrowserArgs });
  const close = async () => {
    await browser.close();
    replay.server.closeAllConnections();
    await new Promise(resolve => replay.server.close(resolve));
  };
  try {
    const context = await browser.newContext({ viewport: { width: 450, height: 800 }, hasTouch: true });
    if (record) await context.addInitScript(installGameAudioCapture);
    const page = await context.newPage();
    if (resourcePatch) {
      await page.route(/data\.json/i, async route => {
        const response = await route.fetch();
        const data = resourcePatch(await response.json());
        await route.fulfill({ response, json: data });
      });
    }
    page.on('pageerror', error => console.error('PAGE ERROR', error.message.slice(0, 250)));
    await page.goto(replay.url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.c3_runtimeInterface?._GetLocalRuntime?.()?._layoutManager?._mainRunningLayout?.GetName?.()?.toLowerCase() === 'start', null, { timeout: 30_000 });
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.touchscreen.tap(225, startButtonY);
      try {
        await page.waitForFunction(() => /^L\d+$/i.test(window.c3_runtimeInterface?._GetLocalRuntime?.()?._layoutManager?._mainRunningLayout?.GetName?.() || ''), null, { timeout: 4_000 });
        break;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    return { page, close };
  } catch (error) {
    await close();
    throw error;
  }
}
