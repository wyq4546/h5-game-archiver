import { chromium } from 'playwright';

const probe = async (label, opts) => {
  const browser = await chromium.launch(opts);
  try {
    const page = await browser.newPage();
    const info = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return { renderer: 'NO WEBGL', vendor: '' };
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no-debug-ext',
        vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '',
      };
    });
    console.log(`[${label}] ${JSON.stringify(info)}`);
  } catch (e) {
    console.log(`[${label}] 失败 ${e.message.split('\n')[0]}`);
  } finally {
    await browser.close().catch(() => {});
  }
};

await probe('默认 headless（现状）', {
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=gl-egl'],
});

await probe('去掉 --disable-gpu', {
  headless: true,
  ignoreDefaultArgs: ['--disable-gpu'],
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=gl-egl'],
});

await probe('new headless + vulkan', {
  headless: true,
  ignoreDefaultArgs: ['--disable-gpu'],
  args: ['--no-sandbox', '--headless=new', '--use-angle=vulkan', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});

await probe('new headless + egl', {
  headless: true,
  ignoreDefaultArgs: ['--disable-gpu'],
  args: ['--no-sandbox', '--headless=new', '--use-gl=egl', '--ignore-gpu-blocklist'],
});
