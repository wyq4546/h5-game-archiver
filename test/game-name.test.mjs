import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveDirectoryName, normalizeGameTitle, resolveGameName } from '../src/game-name.mjs';
import { compareGameIdentity } from '../src/utils.mjs';

const crazyTitle = '🎮 Man Runner 2048 🕹️ Play on CrazyGames';
const hashedBuilds = ['48c046a079694258a68ea63092a70fa1.data.br',
  'max_512mb_b2b276284482c87f392e6771e13c230c.wasm.br'];

test('Run Healthy 2 excludes the publisher unblocked game description from its name and directory', () => {
  const resolved = resolveGameName({sourceUrl: 'https://www.yad.com/Run-Healthy-2',
    pageTitle: 'Run Healthy 2 - Running Unblocked Game',
    landingTitle: 'Run Healthy 2 - Running Unblocked Game'});
  assert.equal(resolved.name, 'Run Healthy 2');
  assert.equal(archiveDirectoryName(resolved.name,new Date(2026,9,8,14,51,25)),
    'Run-Healthy-2-20261008-145125');
});

test('Yad native game title outranks the catalog SEO metadata without losing a real subtitle', () => {
  const resolved=resolveGameName({sourceUrl:'https://www.yad.com/Run-Healthy-2',
    gameFrameTitle:'Run Healthy 2 - Winter Edition',
    pageMetaTitle:'Run Healthy 2 - Running Unblocked Game',pageTitle:'Run Healthy 2'});
  assert.equal(resolved.name,'Run Healthy 2 - Winter Edition');
  assert.equal(resolved.source,'game-frame-title');
});

test('unblocked promotional suffixes are cleaned across separators while actual titles and subtitles survive', () => {
  for (const [title, want] of [
    ['Run Healthy 2 - Running Unblocked Game', 'Run Healthy 2'],
    ['Race 3D – Racing Unblocked Games', 'Race 3D'],
    ['Parking Puzzle | Free Online Unblocked Games', 'Parking Puzzle'],
    ['Tower Escape: Unblocked Game Online', 'Tower Escape'],
    ['Unblocked Game', 'Unblocked Game'],
    ['Run Healthy 2 - Winter Edition', 'Run Healthy 2 - Winter Edition'],
    ['Running Adventure 3D', 'Running Adventure 3D']
  ]) assert.equal(normalizeGameTitle(title),want,title);
});

test('undelimited unblocked copy requires URL corroboration before shortening a title', () => {
  assert.equal(resolveGameName({sourceUrl:'https://www.yad.com/Run-Healthy-2',
    pageTitle:'Run Healthy 2 Running Unblocked Game'}).name,'Run Healthy 2');
  assert.equal(resolveGameName({sourceUrl:'https://www.yad.com/Other-Game',
    pageTitle:'Run Healthy 2 Running Unblocked Game'}).name,'Run Healthy 2 Running Unblocked Game');
  assert.equal(resolveGameName({sourceUrl:'https://www.yad.com/Run-Healthy-2',
    pageTitle:'Run Healthy 2 3D'}).name,'Run Healthy 2 3D');
});

test('URL corroboration preserves sequel numbers instead of replacing a different native title', () => {
  for (const title of ['Run Healthy 3 Running Unblocked Game','Run Healthy 3 Best Arcade Game']) {
    assert.equal(resolveGameName({sourceUrl:'https://www.yad.com/Run-Healthy-2',gameFrameTitle:title}).name,title);
  }
  assert.equal(resolveGameName({sourceUrl:'https://www.yad.com/Run-Healthy-2',
    gameFrameTitle:'Run Healthy 2 Running Unblocked Game'}).name,'Run Healthy 2');
});

test('CrazyGames retains its catalog identity instead of memory and hash build names', () => {
  const resolved = resolveGameName({sourceUrl: 'https://www.crazygames.com/game/man-runner-2048',
    landingTitle: crazyTitle, landingMetaTitle: crazyTitle, pageTitle: crazyTitle,
    pageMetaTitle: crazyTitle, buildFilenames: hashedBuilds});
  assert.equal(resolved.name, 'Man Runner 2048');
  assert.equal(resolved.platform, 'crazygames');
  assert.notEqual(resolved.source, 'build');
  assert.equal(archiveDirectoryName(resolved.name, new Date(2026, 9, 3, 9, 50, 19)),
    'Man-Runner-2048-20261003-095019');
});

test('CrazyGames catalog metadata outranks an unrelated embedded wrapper title', () => {
  assert.equal(resolveGameName({sourceUrl: 'https://www.crazygames.com/game/man-runner-2048',
    landingMetaTitle: crazyTitle, pageTitle: 'Crazy Games Loader', buildFilenames: hashedBuilds}).name,
  'Man Runner 2048');
});

test('opaque build identifiers do not report a game mismatch on any platform', () => {
  assert.equal(compareGameIdentity('Man Runner 2048', hashedBuilds).match, null);
  assert.equal(resolveGameName({sourceUrl: 'https://example.org/game/man-runner-2048',
    pageTitle: 'Man Runner 2048', buildFilenames: hashedBuilds}).name, 'Man Runner 2048');
});

test('descriptive build prefixes still detect and correct a different game despite hash suffixes', () => {
  const files = ['Potato-Rush_b2b276284482c87f392e6771e13c230c.data.br'];
  assert.equal(compareGameIdentity('Make Fries', files).match, false);
  assert.equal(resolveGameName({sourceUrl: 'https://kiz10.com/make-fries/',
    landingTitle: 'Make Fries', buildFilenames: files}).name, 'Potato Rush');
});

test('FreeGame localized catalog titles produce a game directory instead of the publisher name', () => {
  const resolved = resolveGameName({
    sourceUrl: 'https://www.freegame.com/cs/game/bubble-shooter-classic-pop',
    landingTitle: '泡泡龙全民版 | 免费益智小游戏在线',
    landingMetaTitle: '泡泡龙全民版 - FreeGame.Com',
    pageTitle: '泡泡龙全民版 | 免费益智小游戏在线',
    pageMetaTitle: '泡泡龙全民版 - FreeGame.Com'
  });
  assert.equal(resolved.name, 'Bubble Shooter Classic Pop');
  assert.equal(archiveDirectoryName(resolved.name, new Date(2026, 9, 1, 14, 20, 30)),
    'Bubble-Shooter-Classic-Pop-20261001-142030');
});

test('FreeGame publisher suffix is removed without removing part of a game title', () => {
  assert.equal(normalizeGameTitle('泡泡龙全民版 - FreeGame.Com'), '泡泡龙全民版');
  assert.equal(normalizeGameTitle('Bubble Shooter | FreeGame.com'), 'Bubble Shooter');
  assert.equal(normalizeGameTitle('Freegame Adventure'), 'Freegame Adventure');
});

test('FreeGame prefers its game iframe title to catalog metadata and the URL fallback', () => {
  const resolved = resolveGameName({
    sourceUrl: 'https://www.freegame.com/cs/game/bubble-shooter-classic-pop',
    gameFrameTitle: 'Bubble Shooter - Classic Pop Deluxe',
    pageMetaTitle: '泡泡龙全民版 - FreeGame.Com',
    pageTitle: '泡泡龙全民版 | 免费益智小游戏在线'
  });
  assert.equal(resolved.name, 'Bubble Shooter Classic Pop Deluxe');
  assert.equal(resolved.source, 'game-frame-title');
  assert.equal(resolved.platform, 'freegame');
});

for (const titleField of ['pageTitle', 'pageMetaTitle']) {
  test(`Yad removes corroborated promotional copy from ${titleField}`, () => {
    const resolved = resolveGameName({
      sourceUrl: 'https://www.yad.com/Count-Master-Match-Color-Run#goog_game_inter',
      landingTitle: 'Count Master Match Color Run Best Arcade Game',
      [titleField]: 'Count Master Match Color Run Best Arcade Game'
    });
    assert.equal(resolved.name, 'Count Master Match Color Run');
    assert.equal(resolved.source, 'source-url');
    assert.equal(resolved.evidence, 'Count Master Match Color Run Best Arcade Game');
    assert.equal(archiveDirectoryName(resolved.name, new Date(2026, 8, 25, 1, 9, 43)),
      'Count-Master-Match-Color-Run-20260925-010943');
  });
}

test('a shorter URL does not truncate a descriptive game-page title', () => {
  assert.equal(resolveGameName({ sourceUrl: 'https://www.yad.com/Maze-Paint',
    pageTitle: 'Maze Paint 3D' }).name, 'Maze Paint 3D');
  assert.equal(resolveGameName({ sourceUrl: 'https://www.yad.com/Best-Arcade-Game',
    pageTitle: 'Best Arcade Game' }).name, 'Best Arcade Game');
  assert.equal(resolveGameName({ sourceUrl: 'https://www.yad.com/Other-Game',
    pageTitle: 'Count Master Match Color Run Best Arcade Game' }).name,
  'Count Master Match Color Run Best Arcade Game');
});

test('Y8 prefers a descriptive game-page title over its landing title', () => {
  assert.deepEqual(resolveGameName({
    sourceUrl: 'https://zh.y8.com/games/maze_paint',
    landingTitle: 'Maze Paint - 立即在 Y8.com 上玩',
    pageTitle: 'Maze Paint 3D'
  }), { name: 'Maze Paint 3D', source: 'page-title', platform: 'y8' });
});

test('Y8 ignores an unrelated embedded-page title when the catalog name matches its URL', () => {
  assert.deepEqual(resolveGameName({
    sourceUrl: 'https://zh.y8.com/games/maze_paint',
    landingTitle: 'Maze Paint - 立即在 Y8.com 上玩',
    pageTitle: 'Advertising Platform'
  }), { name: 'Maze Paint', source: 'landing-title', platform: 'y8' });
});

test('Yad uses the game slug when LayaBox supplies a generic title and landing copy is promotional', () => {
  assert.deepEqual(resolveGameName({
    sourceUrl: 'https://www.yad.com/Watermelon-Run-3d',
    gameUrl: 'https://html5.gamedistribution.com/game/index.html',
    landingTitle: 'Watermelon Run 3D 🍉 An Interesting Run Game!',
    pageTitle: 'www.layabox.com'
  }), { name: 'Watermelon Run 3D', source: 'source-url', platform: 'yad', evidence: 'Watermelon Run 3D 🍉 An Interesting Run Game!' });
});

test('direct LayaBox links use a descriptive parent slug when the page title is the engine domain', () => {
  assert.deepEqual(resolveGameName({
    sourceUrl: 'https://www.layabox.com/games/watermelon-run/index.html',
    pageTitle: 'www.layabox.com'
  }), { name: 'Watermelon Run', source: 'source-url', platform: 'layabox' });
});

test('Playhop prefers the embedded game title when it differs from the catalog title', () => {
  assert.deepEqual(resolveGameName({
    sourceUrl: 'https://playhop.com/zh/app/pancake-stack-248784',
    landingTitle: 'Pancake Stack: 在 Playhop 上免费在线畅玩',
    pageTitle: 'Cake Art 3D'
  }), { name: 'Cake Art 3D', source: 'page-title', platform: 'playhop' });
});

test('Kiz10 keeps descriptive build-name correction', () => {
  assert.deepEqual(resolveGameName({
    sourceUrl: 'https://kiz10.com/make-fries/',
    landingTitle: 'Make Fries',
    buildFilenames: ['Potato-Rush.data']
  }), { name: 'Potato Rush', source: 'build', platform: 'kiz10', evidence: 'Potato-Rush' });
});

test('PlayPlayFun uses the game path above its generic play endpoint', () => {
  assert.deepEqual(resolveGameName({
    sourceUrl: 'https://playplayfun.com/barrel-roller-amazing-runner/play/',
    pageTitle: 'Loading'
  }), { name: 'Barrel Roller Amazing Runner', source: 'source-url', platform: 'playplayfun' });
});

test('unlisted platforms retain the generic fallback', () => {
  assert.deepEqual(resolveGameName({
    sourceUrl: 'https://example.org/games/rocket-run',
    pageTitle: 'Rocket Run'
  }), { name: 'Rocket Run', source: 'page-title', platform: 'generic' });
});
