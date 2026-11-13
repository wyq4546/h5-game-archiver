import { descriptiveBuildName, compareGameIdentity, displayNameFromTokens, identityTokens, safeSlug, toTitleCaseSlug } from './utils.mjs';

const UNBLOCKED_PROMOTION = String.raw`(?:(?:Running|Racing|Arcade|Puzzle|Action|Adventure|Sports|Casual|Free|Online)\s+)*Unblocked\s+Games?(?:\s+(?:Online|For\s+Free))?[!.]?`;
const SEPARATED_UNBLOCKED_PROMOTION = new RegExp(`\\s*[-:|–—]\\s*${UNBLOCKED_PROMOTION}\\s*$`, 'i');
const TRAILING_PROMOTION = new RegExp(`\\s+(?:[-:|–—]\\s*)?(?:best\\s+arcade\\s+games?[!.]?|${UNBLOCKED_PROMOTION})\\s*$`, 'i');

export function normalizeGameTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
    .replace(/^🎮\s*/u, '')
    .replace(/\s*(?:🕹\uFE0F?\s*)?Play on CrazyGames\s*$/iu, '')
    // Chinese portal promo suffixes
    .replace(/\s*[:：|–—-]\s*(?:立即)?在\s*(?:Playhop|Y8(?:\.com)?|Poki|CrazyGames|Kiz10(?:\.com)?|Yad(?:\.com)?|FreeGame(?:\.com)?)\s*上(?:免费在线)?(?:畅玩|玩)(?:游戏)?[！!。.]?\s*$/i, '')
    .replace(/\s*[:|–—-]\s*(?:play\s+(?:online|for\s+free|now)\b.*|免费在线玩.*)$/i, '')
    // Generic SEO / promo phrases like "- Fun Online Game", "- Best Arcade Game", etc.
    .replace(/\s*[-:|–—]\s*(?:(?:Fun|Free|Best|Top|Hot|Cool|New|Popular|Online)\s+)+(?:Online\s+)?(?:Game[s]?|Arcade)\b.*$/i, '')
    .replace(/\s*[-:|–—]\s*Online\s*Game[s]?\b.*$/i, '')
    .replace(SEPARATED_UNBLOCKED_PROMOTION, '')
    // Known portal names and brands
    .replace(/\s*(?:[:：|–—-]\s*)?Game\s*Monetize(?:\.com)?\s*$/i, '')
    .replace(/\s*[|–—-]\s*(?:Y8(?:\.com)?|Poki|Playhop|CrazyGames|Kiz10(?:\.com)?|Yad(?:\.com)?|FreeGame(?:\.com)?|PlayPlayFun|Lagged(?:\.com)?|GamePix|Friv|Kizi|Armor\s*Games|itch\.io)\s*$/i, '')
    // Trailing dangling separators
    .replace(/\s*[-:|–—]+\s*$/g, '')
    .trim();
}

function meaningful(value) {
  const text = String(value || '').trim();
  return Boolean(text && !/^(?:[\da-f-]{20,}|\d+)$/i.test(text) &&
    !/^(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}\/?$/i.test(text) &&
    !/^(?:playhop|poki|crazygames|y8(?:\.com)?|kiz10(?:\.com)?|yad(?:\.com)?|game\s*monetize(?:\.com)?)$/i.test(text) &&
    !/^(?:(?:unity|webgl|player|build|text|fullscreen|release|development|loading|please wait|game|index|html5|platform|wrapper|web|\d+)[\s_.|-]*)+$/i.test(text));
}

export function archiveDirectoryName(title, date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const cleanedTitle = normalizeGameTitle(title);
  const slug = toTitleCaseSlug(cleanedTitle).slice(0, 50).replace(/[-._]+$/g, '') || 'Capture';
  return `${slug}-${stamp}`;
}

// The source page determines the naming rule. Embedded game hosts often belong
// to a different publisher or engine, so their domain must not select it.
const PLATFORM_RULES = [
  // FreeGame's catalog metadata is localized. The named game iframe has the
  // build's own title; its descriptive catalog URL is the portable fallback.
  { id: 'freegame', hosts: ['freegame.com'], gameFrameName: 'play_game_frame', gameHost: 'cdn.freegame.com', order: ['game-frame-title', 'source-url', 'page-meta', 'page-title', 'landing-meta', 'landing-title'] },
  { id: 'y8', hosts: ['y8.com'], order: ['page-meta', 'page-title', 'landing-meta', 'landing-title', 'source-url'] },
  { id: 'yad', hosts: ['yad.com'], gameFrameName: 'game_frame', order: ['game-frame-title', 'page-meta', 'page-title', 'landing-meta', 'landing-title', 'source-url'] },
  { id: 'layabox', hosts: ['layabox.com'], order: ['page-meta', 'source-url', 'page-title', 'landing-meta', 'landing-title'], parentSlugFor: ['index'] },
  { id: 'playhop', hosts: ['playhop.com'], order: ['page-meta', 'page-title', 'landing-meta', 'landing-title', 'source-url'] },
  { id: 'crazygames', hosts: ['crazygames.com'], order: ['landing-meta', 'landing-title', 'source-url', 'page-meta', 'page-title'] },
  { id: 'kiz10', hosts: ['kiz10.com'], order: ['page-meta', 'page-title', 'landing-meta', 'landing-title', 'source-url'] },
  { id: 'playplayfun', hosts: ['playplayfun.com'], order: ['page-meta', 'page-title', 'landing-meta', 'landing-title', 'source-url'], parentSlugFor: ['play'] }
];
const GENERIC_RULE = { id: 'generic', order: ['page-meta', 'page-title', 'landing-meta', 'landing-title', 'source-url'] };

function ruleForUrl(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return GENERIC_RULE; }
  return PLATFORM_RULES.find(rule => rule.hosts.some(domain => host === domain || host.endsWith(`.${domain}`))) || GENERIC_RULE;
}

export async function readGameNameEvidence(page, sourceUrl, gameUrl) {
  const evidence = await page.evaluate(() => ({
    pageTitle: document.title,
    pageMetaTitle: document.querySelector('meta[property="og:title"]')?.content || ''
  })).catch(() => ({ pageTitle: '', pageMetaTitle: '' }));
  const rule = ruleForUrl(sourceUrl);
  // Use the entry discovered by the capture strategy; an arbitrary iframe can
  // belong to an advertisement or a different game.
  let frame = gameUrl ? page.frames().find(item => item.url() === gameUrl) : null;
  if (!frame && rule.gameFrameName) {
    frame = page.frame({ name: rule.gameFrameName });
    if (!frame) {
      try { if (new URL(page.url()).hostname === rule.gameHost) frame = page.mainFrame(); } catch {}
    }
  }
  if (frame) evidence.gameFrameTitle = await frame.evaluate(() => document.title).catch(() => '');
  return evidence;
}

function slugFromUrl(url, rule) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    let last = decodeURIComponent(parts.at(-1) || '').replace(/\.html?$/i, '');
    if (rule.parentSlugFor?.includes(last.toLowerCase())) last = decodeURIComponent(parts.at(-2) || '');
    last = last.replace(/[-_]\d{5,}$/, '');
    if (!meaningful(last)) return '';
    return last.split(/[_-]+/).map(word => /^\d+d$/i.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  } catch { return ''; }
}

export function resolveGameName(input = {}) {
  const rule = ruleForUrl(input.sourceUrl);
  const candidates = new Map([
    ['game-frame-title', input.gameFrameTitle],
    ['page-meta', input.pageMetaTitle], ['page-title', input.pageTitle],
    ['landing-meta', input.landingMetaTitle], ['landing-title', input.landingTitle]
  ].map(([source, title]) => [source, { source, name: normalizeGameTitle(title) }]));
  if (rule.id === 'freegame') {
    const frameTitle = candidates.get('game-frame-title');
    frameTitle.name = frameTitle.name.replace(/\s+[-–—]\s+/g, ' ');
  }
  const slug = slugFromUrl(input.sourceUrl, rule);
  candidates.set('source-url', { source: 'source-url', name: slug });
  if (rule.id === 'y8') {
    const landing = [candidates.get('landing-meta'), candidates.get('landing-title')].find(item => meaningful(item.name));
    const landingTokens = identityTokens(landing?.name);
    const slugTokens = identityTokens(slug);
    if (landing && slugTokens.some(token => landingTokens.includes(token))) {
      for (const source of ['page-meta', 'page-title']) {
        const page = candidates.get(source);
        if (meaningful(page.name) && !identityTokens(page.name).some(token => token.length >= 4 && landingTokens.includes(token))) {
          candidates.delete(source);
        }
      }
    }
  }
  const chosen = rule.order.map(source => candidates.get(source)).find(item => item && meaningful(item.name));
  const builds = [...new Set((input.buildFilenames || []).map(descriptiveBuildName))]
    .filter(name => meaningful(name) && identityTokens(name).length >= 2);
  // A single descriptive build can identify a different embedded game. Generic,
  // abbreviated, or conflicting build names are not strong enough to override titles.
  if (builds.length === 1 && (!chosen || compareGameIdentity(chosen.name, builds).match === false)) {
    return { name: displayNameFromTokens(identityTokens(builds[0])), source: 'build', platform: rule.id, evidence: builds[0] };
  }
  // Both landing and embedded pages can append promotional copy. A shorter URL
  // alone must not truncate a descriptive embedded title (for example "3D").
  if (chosen && slug) {
    // Build identity tokens intentionally discard short words; naming must
    // retain sequel digits and Unicode words when checking URL corroboration.
    const nameTokens = value => value.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const slugTokens = nameTokens(slug), titleTokens = nameTokens(chosen.name);
    const withoutPromotion = chosen.name.replace(TRAILING_PROMOTION, '');
    const promotionalSuffix = withoutPromotion !== chosen.name &&
      nameTokens(withoutPromotion).join(' ') === slugTokens.join(' ');
    if (slugTokens.length >= 2 && slugTokens.length < titleTokens.length &&
      (chosen.source.startsWith('landing') || promotionalSuffix) &&
      slugTokens.every((token, index) => token === titleTokens[index])) {
      return { name: slug, source: 'source-url', platform: rule.id, evidence: chosen.name };
    }
  }
  return chosen ? { name: chosen.name, source: chosen.source, platform: rule.id }
    : { name: '未命名游戏', source: 'fallback', platform: rule.id };
}
