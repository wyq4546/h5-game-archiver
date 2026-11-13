export function isNoiseUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    // 0. 微信小游戏/广告 SDK 探测本机微信客户端服务（localhost.weixin.qq.com:14xxx）。
    // 浏览器里根本没有微信客户端，这些请求必然 ERR_CONNECTION_REFUSED；它们既不
    // 属于游戏资源，也不可能成功，留着只会把日志刷成一片红色 ERROR。
    if (host === 'localhost.weixin.qq.com') return true;

    // 1. Yandex 遥测、视频日志与广告同步
    if (/^mc\.(?:yandex\.(?:com|ru|az|by|co\.il|com\.am|com\.ge|com\.tr|ee|fr|kg|kz|lt|lv|md|tj|tm|ua|uz)|webvisor\.(?:com|org))$/i.test(host) &&
        /^\/(?:clmap|watch|collect|webvisor|sync_cookie_[a-z_]+)(?:\/|$)/i.test(path)) return true;
    if (/(?:^|\.)(?:abs\.yandex\.(?:com|ru)|log\.strm\.yandex\.(?:ru|net)|adfox\.ru)$/i.test(host)) return true;
    if (/(?:^|\.)yango\.com$/i.test(host) && /\/mapuid/i.test(path)) return true;

    // 2. Google 广告、再营销、转化、CMP 与分析打点
    if (/^(?:www\.)?google-analytics\.com$|^analytics\.google\.com$/i.test(host) && /^\/(?:g\/)?collect(?:\/|$)/i.test(path)) return true;
    if (/(?:^|\.)google\.[a-z.]+$/i.test(host)) {
      if (/^\/(?:g\/collect|ccm|rmkt|pagead|measurement|ads|adsid|gen_204|afs|async)(?:\/|$)/i.test(path)) return true;
    }
    if (/(?:^|\.)(googlesyndication\.com|googleadservices\.com|doubleclick\.net|2mdn\.net|adtrafficquality\.google|fundingchoicesmessages\.google\.com)$/i.test(host)) return true;

    // 3. 常见预竞价（Prebid / Header Bidding）、AdTech 广告网络与数据同步
    if (/(?:^|\.)(onetag-sys\.com|id5-sync\.com|creativecdn\.com|smartadserver\.com|33across\.com|unrulymedia\.com|crwdcntrl\.net|btloader\.com|ad-delivery\.net|inmobi\.com|rubiconproject\.com|openx\.net|pubmatic\.com|casalemedia\.com|criteo\.com|taboola\.com|outbrain\.com|sonobi\.com|ingage\.tech|opera\.com)$/i.test(host)) {
      if (/\/gameSDK\//i.test(path)) return false;
      return true;
    }

    if (host === 'cdn.fuseplatform.net' && /^\/telemetry\//i.test(path)) return true;
    // GamePush / Eponesh 广告 SDK 的在线状态心跳：只在页面存活期间轮询，
    // 不提供任何游戏资源，页面关闭时的中断不该算作资源丢失。
    if (/(?:^|\.)(?:gamepush|eponesh)\.com$/i.test(host) && /^\/gs\/api\/status(?:\/|$)/i.test(path)) return true;
    // YYG's published bootstrap and Laya module assets load the game bundle.
    // Treating every yyggames.com URL as an ad blocks h5splash/YYGGames before
    // the original game can create its canvas. Keep this known SDK namespace;
    // telemetry and ad endpoints outside it retain the noise classification.
    if(host==='h5gamessdk.yyggames.com'&&/^\/sdk\/(?:yyggames\.js$|h5splash\.js$|yyggames_modules\/|css\/gui\/|s\/|res\/|adconfig\/ad_config\.json$)/i.test(path))return false;
    if (/(?:^|\.)(h5games4u\.com|bytebrew\.io|yyggames\.com)$/i.test(host)) {
      if (/\/gameSDK\//i.test(path)) return false;
      return true;
    }

    // 4. 第三方社交外挂挂件（Twitter, Facebook, TikTok 等）
    if (/(?:^|\.)(twitter\.com|x\.com|facebook\.(?:com|net)|fbcdn\.net|tiktok\.com|linkedin\.com|pinterest\.com|reddit\.com)$/i.test(host)) return true;

    return /(^|\.)(gvt1\.com|dotnxdomain\.net|gamemonkey\.org|gamedock\.io)$/i.test(host) ||
      /\/videoplayback(?:[/?#]|$)/i.test(path);
  } catch {
    return false;
  }
}
