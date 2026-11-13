import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coverCandidates, sameCoverImage, imageInfo } from '../src/archive-cover.mjs';
import { resolveGameName } from '../src/game-name.mjs';

test('camel-case build names match the source game title without matching unrelated games', () => {
  const image='https://www.yad.com/cdn-cgi/image/quality=78,width=1200,format=jpeg/thumb/Cat-Runner.jpg';
  const html=`<title>Cat Runner 😺 Cat Running Game</title><meta property="og:image" content="${image}">`;
  assert.equal(coverCandidates(html,'https://www.yad.com/Cat-Runner','CatRunner')[0]?.url,image);
  assert.equal(coverCandidates(html,'https://www.yad.com/Cat-Runner','CatEvolution').length,0);
});

test('Poki game-specific logo artwork is a cover while platform and other game logos are rejected', () => {
  const page='https://poki.com/en/g/subway-surfers';
  const image='https://img.poki-cdn.com/cdn-cgi/image/q=78,width=1200,f=png/1c920b9279c2bedec567c1b58129ae8f/subway-surfers-logo.png';
  const html=url=>`<title>Subway Surfers - Play Online for Free! | Poki</title><meta property="og:image" content="${url}">`;
  assert.equal(coverCandidates(html(image),page,'Subway Surfers')[0]?.url,image);
  assert.equal(coverCandidates(html(image.replace('subway-surfers-logo','subway-surfers-blast-logo')),page,'Subway Surfers').length,0);
  assert.equal(coverCandidates(html('https://a.poki-cdn.com/brand-assets/poki-logo.png'),page,'Subway Surfers').length,0);
  assert.equal(coverCandidates(html(image),page,'Other Game').length,0);
});

test('Poki captured image variants reuse only the same hashed artwork and filename', () => {
  const cover='https://img.poki-cdn.com/cdn-cgi/image/q=78,width=1200,f=png/1c920b9279c2bedec567c1b58129ae8f/subway-surfers-logo.png';
  const captured=cover.replace('width=1200,f=png','width=314,f=auto');
  assert.equal(sameCoverImage(captured,cover),true);
  assert.equal(sameCoverImage(captured.replace('1c920b9279c2bedec567c1b58129ae8f','00000000000000000000000000000000'),cover),false);
  assert.equal(sameCoverImage(captured.replace('subway-surfers-logo','other-game-logo'),cover),false);
  assert.equal(sameCoverImage(captured.replace('img.poki-cdn.com','other.example'),cover),false);
});

test('CrazyGames captured title and hashed builds preserve access to the matching catalog cover', () => {
  const pageUrl = 'https://www.crazygames.com/game/man-runner-2048';
  const title = '🎮 Man Runner 2048 🕹️ Play on CrazyGames';
  const image = 'https://imgs.crazygames.com/man-runner-2048_16x9/20260520032150/man-runner-2048_16x9-cover?metadata=none&quality=100&width=1200&height=630&fit=crop';
  const html = `<title>${title}</title><meta property="og:title" content="${title}" data-next-head=""/><meta property="og:image" content="${image.replaceAll('&', '&amp;')}" data-next-head=""/>`;
  const resolved = resolveGameName({sourceUrl: pageUrl, landingMetaTitle: title,
    buildFilenames: ['48c046a079694258a68ea63092a70fa1.data.br',
      'max_512mb_b2b276284482c87f392e6771e13c230c.wasm.br']});
  assert.equal(coverCandidates(html, pageUrl, resolved.name)[0]?.url, image);
  assert.equal(coverCandidates(html, pageUrl, 'Different Game').length, 0);
});

const y8Image = 'https://cdn2.y8.com/cloudimage/60119/file/w380h285_retina_webp-hash.webp';

test('CrazyGames native AVIF artwork is accepted with actual dimensions, while truncated boxes are rejected', () => {
  const bytes = readFileSync(new URL('./fixtures/crazygames-cover.avif', import.meta.url));
  assert.deepEqual(imageInfo(bytes), {mime: 'image/avif', width: 196, height: 110});
  assert.throws(() => imageInfo(bytes.subarray(0, 150)));
  const corrupt = Buffer.from(bytes);
  corrupt.writeUInt32BE(0xFFFFFFFF, 24);
  assert.throws(() => imageInfo(corrupt));
});

test('CrazyGames reuses captured cover size variants only for the same artwork and version', () => {
  const image = 'https://imgs.crazygames.com/man-runner-2048_16x9/20260520032150/man-runner-2048_16x9-cover?quality=100&width=1200&height=630';
  assert.equal(sameCoverImage('https://imgs.crazygames.com/man-runner-2048_16x9/20260520032150/man-runner-2048_16x9-cover?quality=85&width=196&dpr=1', image), true);
  assert.equal(sameCoverImage('https://imgs.crazygames.com/other-game_16x9/20260520032150/other-game_16x9-cover?width=196', image), false);
  assert.equal(sameCoverImage('https://imgs.crazygames.com/man-runner-2048_16x9/20260520032151/man-runner-2048_16x9-cover?width=196', image), false);
});

test('Y8 cover can use the catalog title when it matches the source slug and game name', () => {
  const html = `<title>Maze Paint - 立即在 Y8.com 上玩</title><meta property="og:image" content="${y8Image}">`;
  assert.equal(coverCandidates(html, 'https://zh.y8.com/games/maze_paint', 'Maze Paint 3D')[0]?.url, y8Image);
  assert.equal(coverCandidates(html, 'https://zh.y8.com/games/maze_paint', 'Different Game').length, 0);
});

test('Y8 cloudimage variants belong to one game only when their image ID matches', () => {
  assert.equal(sameCoverImage('https://cdn2.y8.com/cloudimage/60119/file/w380h285_webp-other.webp', y8Image), true);
  assert.equal(sameCoverImage('https://cdn2.y8.com/cloudimage/11325/file/w380h285_webp-other.webp', y8Image), false);
});

test('Yad thumbnail format variants share a game image path', () => {
  assert.equal(sameCoverImage(
    'https://www.yad.com/cdn-cgi/image/quality=78,format=auto/thumb/Watermelon-Run-3d.jpg',
    'https://www.yad.com/cdn-cgi/image/quality=78,width=1200,format=jpeg/thumb/Watermelon-Run-3d.jpg'
  ), true);
});

test('Yad cover uses source URL slug when page title is generic promotional copy', () => {
  const yadImage = 'https://www.yad.com/cdn-cgi/image/quality=78,width=1200,height=630,fit=pad,format=jpeg/thumb/Join-Blob-Clash.jpg';
  const html = `<title>Running Game Play On Yad</title><meta property="og:image" content="${yadImage}">`;
  assert.equal(coverCandidates(html, 'https://www.yad.com/Join-Blob-Clash', 'Join Blob Clash')[0]?.url, yadImage);
  assert.equal(coverCandidates(html, 'https://www.yad.com/Join-Blob-Clash', 'Completely Different Game').length, 0);
});

test('落地页改名后仍可用页面自身的卡片图作封面，但默认保持拒绝', () => {
  const page = 'https://poki.com/zh/g/neon-challenge-legends';
  const image = 'https://img.poki-cdn.com/cdn-cgi/image/q=78,scq=50,width=1200,height=1200,fit=cover,f=png/63a82be82b3449c174af1720e55cec67/neon-challenge-legends-logo.png';
  const title = 'Neon Challenge Legends - Poki (宝玩)';
  const html = `<title>${title}</title><meta property="twitter:image" content="${image}"/>`;
  // 构建自报名与页面标题互不相交时，默认不放行（防止给抓错的页面配封面）。
  assert.equal(coverCandidates(html, page, 'Geometry Arrow').length, 0);
  // 调用方确认过改名证据后才回落到页面自身的卡片图，并标记来源标题不符。
  const relaxed = coverCandidates(html, page, 'Geometry Arrow', {allowTitleMismatch: true});
  assert.equal(relaxed[0]?.url, image);
  assert.equal(relaxed[0]?.titleMismatch, true);
  assert.equal(relaxed[0]?.title, title);
  // 放行范围仅限与当前页 slug 同名的卡片图，别的游戏图依旧拒绝。
  const otherArtwork = html.replace(image, image.replace('neon-challenge-legends-logo', 'dreadhead-parkour-logo'));
  assert.equal(coverCandidates(otherArtwork, page, 'Geometry Arrow', {allowTitleMismatch: true}).length, 0);
  // 正常同名匹配不受影响，也不会被误标为标题不符。
  const ownPage = 'https://poki.com/en/g/subway-surfers';
  const ownImage = 'https://img.poki-cdn.com/cdn-cgi/image/q=78,width=1200,f=png/1c920b9279c2bedec567c1b58129ae8f/subway-surfers-logo.png';
  assert.equal(coverCandidates(`<title>Subway Surfers - Play Online for Free! | Poki</title><meta property="og:image" content="${ownImage}">`, ownPage, 'Subway Surfers', {allowTitleMismatch: true})[0]?.titleMismatch, false);
});

