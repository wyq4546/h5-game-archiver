import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.bin': 'application/octet-stream',
  '.ls': 'application/octet-stream',
  '.lh': 'application/octet-stream',
  '.lani': 'application/octet-stream',
  '.lm': 'application/octet-stream',
  '.lmat': 'application/octet-stream',
  '.scene': 'application/octet-stream',
  '.atlas': 'application/json; charset=utf-8'
};

export async function createReplayServer(root) {
  const manifestPath = path.join(root, 'archive/manifest.json');
  let manifest = null;
  const urlMap = new Map();

  const gameBase = path.join(root, 'game/app-239345.games.s3.yandex.net/239345/ah0ml9s8l3ff12dub6p3bzgqezjbmszq');
  const yandexBase = path.join(root, 'game/app-239345.games.s3.yandex.net');
  const xzBase = path.join(root, 'game/xz.fzhdnet.com');
  const generalGameBase = path.join(root, 'game');

  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      for (const res of manifest.resources || []) {
        if (res.url && res.path) {
          try {
            const u = new URL(res.url);
            urlMap.set(u.pathname, path.join(root, res.path));
            // Also store stripped version
            urlMap.set(u.pathname.replace(/^\/+/, ''), path.join(root, res.path));
          } catch {}
        }
      }
    } catch (e) {
      console.warn('[ReplayServer] Warning reading manifest:', e.message);
    }
  }

  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(parsed.pathname);

    if (pathname === '/__archive_info') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        sourceUrl: manifest?.sourceUrl || 'https://playhop.com/zh/app/beauty-fight-239345',
        replayUrl: '/'
      }));
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      const entryPath = path.join(gameBase, 'index-ac2e58d4ca.html');
      if (fs.existsSync(entryPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        fs.createReadStream(entryPath).pipe(res);
        return;
      }
    }

    // Specific redirects / aliases for game root files
    if (pathname === '/index.js' || pathname.startsWith('/index.js')) {
      const p = path.join(gameBase, 'index-4ba3ed5454.js');
      if (fs.existsSync(p)) return serveFile(p, res);
    }
    if (pathname === '/sdk.js') {
      const p = path.join(yandexBase, 'sdk.js');
      if (fs.existsSync(p)) return serveFile(p, res);
    }
    if (pathname === '/version.json' || pathname === '/../version.json') {
      const p = path.join(gameBase, 'version.json');
      if (fs.existsSync(p)) return serveFile(p, res);
    }
    if (pathname === '/fileconfig.json' || pathname === '/../fileconfig.json') {
      const p = path.join(gameBase, 'fileconfig.json');
      if (fs.existsSync(p)) return serveFile(p, res);
    }
    if (pathname.includes('VkApp.js') || pathname.includes('VkApp')) {
      const p = path.join(xzBase, 'newsdk/VkApp-d825135435.js');
      if (fs.existsSync(p)) return serveFile(p, res);
    }
    if (pathname.includes('md5.js')) {
      const p = path.join(xzBase, 'vk_game/common/coinsdk/md5.js');
      if (fs.existsSync(p)) return serveFile(p, res);
    }
    if (pathname.includes('bundle.js')) {
      const p = path.join(gameBase, 'ru/js/bundle-910497ed1c.js');
      if (fs.existsSync(p)) return serveFile(p, res);
    }
    if (pathname.endsWith('.lh') && (pathname.includes('_level') || pathname.includes('Level') || pathname.includes('level'))) {
      const p = path.join(gameBase, 'en/res/map_1/_level1.lh');
      if (fs.existsSync(p)) return serveFile(p, res);
    }
    if (pathname.endsWith('.mp3')) {
      const p = path.join(gameBase, 'ru/res/sounds/bgmggx.mp3');
      if (fs.existsSync(p)) return serveFile(p, res);
    }

    // Normalize relative paths with ../
    let norm = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (norm.startsWith('/') || norm.startsWith('\\')) norm = norm.slice(1);

    // Try candidates in order:
    // 1. gameBase / norm
    let candidate = path.join(gameBase, norm);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return serveFile(candidate, res);
    }

    // 2. gameBase / ru / norm
    candidate = path.join(gameBase, 'ru', norm);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return serveFile(candidate, res);
    }

    // 3. yandexBase / norm
    candidate = path.join(yandexBase, norm);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return serveFile(candidate, res);
    }

    // 4. xzBase / norm
    candidate = path.join(xzBase, norm);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return serveFile(candidate, res);
    }

    // 5. generalGameBase / norm
    candidate = path.join(generalGameBase, norm);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return serveFile(candidate, res);
    }

    // 6. manifest urlMap lookup
    if (urlMap.has(pathname)) {
      candidate = urlMap.get(pathname);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return serveFile(candidate, res);
      }
    }
    if (urlMap.has(norm)) {
      candidate = urlMap.get(norm);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return serveFile(candidate, res);
      }
    }

    // 7. Direct root lookup
    candidate = path.join(root, norm);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return serveFile(candidate, res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end('Not Found: ' + pathname);
  });

  function serveFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  }

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;

  return {
    server,
    port,
    url,
    close: () => new Promise(r => server.close(r))
  };
}
