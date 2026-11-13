import { chromium } from 'playwright';

const EXE = process.env.HOME + '/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome';

const probe = async (label, opts) => {
  try {
    const browser = await chromium.launch(opts);
    try {
      const page = await browser.newPage();
      const info = await page.evaluate(() => {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (!gl) return { renderer: 'NO WEBGL' };
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no-debug-ext' };
      });
      console.log(`[${label}] ${JSON.stringify(info)}`);
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (e) {
    console.log(`[${label}] 启动失败 ${String(e.message).split('\n')[0]}`);
  }
};

await probe('完整chromium 默认', {
  executablePath: EXE,
  headless: true,
  args: ['--no-sandbox'],
});

await probe('完整chromium 去disable-gpu', {
  executablePath: EXE,
  headless: true,
  ignoreDefaultArgs: ['--disable-gpu', '--enable-unsafe-swiftshader'],
  args: ['--no-sandbox', '--use-angle=vulkan', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
