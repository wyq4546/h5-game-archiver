import { readFile, writeFile, mkdir, rename, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { normalizeGameTitle } from './game-name.mjs';

export function imageInfo(b) {
  let width=0,height=0,mime='';
  if (b.length>24 && b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) {
    width=b.readUInt32BE(16);height=b.readUInt32BE(20);mime='image/png';
  } else if (b.length>30 && b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP') {
    const kind=b.toString('ascii',12,16);mime='image/webp';
    if(kind==='VP8X'){width=1+b.readUIntLE(24,3);height=1+b.readUIntLE(27,3);}
    if(kind==='VP8 '){width=b.readUInt16LE(26)&16383;height=b.readUInt16LE(28)&16383;}
    if(kind==='VP8L'){const bits=b.readUInt32LE(21);width=1+(bits&16383);height=1+((bits>>>14)&16383);}
  } else if(b.length>4 && b[0]===255 && b[1]===216) {
    mime='image/jpeg';let i=2;
    while(i+8<b.length){if(b[i]!==255)break;const marker=b[i+1];if(marker===218||marker===217)break;const size=b.readUInt16BE(i+2);if(size<2)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){height=b.readUInt16BE(i+5);width=b.readUInt16BE(i+7);break;}i+=2+size;}
  } else if(b.length>32 && b.toString('ascii',4,8)==='ftyp' && b.toString('ascii',8,12)==='avif') {
    // Static AVIF covers store dimensions in meta/iprp/ipco/ispe. Validate
    // container boundaries rather than searching arbitrary compressed bytes.
    mime='image/avif';
    const boxes=(start,end)=>{
      for(let p=start;p<end;){
        if(p+8>end)throw new Error('AVIF 图片已截断');
        const size=b.readUInt32BE(p),kind=b.toString('ascii',p+4,p+8);
        if(size<8||p+size>end)throw new Error('AVIF 图片容器无效');
        if(kind==='ispe'){
          if(size!==20)throw new Error('AVIF 图片尺寸无效');
          const w=b.readUInt32BE(p+12),h=b.readUInt32BE(p+16);
          if(width&&(width!==w||height!==h))throw new Error('AVIF 图片包含不同尺寸，无法确定主图');
          width=w;height=h;
        }
        if(['meta','iprp','ipco'].includes(kind))boxes(p+8+(kind==='meta'?4:0),p+size);
        p+=size;
      }
    };
    boxes(0,b.length);
  }
  if(!mime||width<96||height<96||width>8192||height>8192||b.length>5*1024*1024) throw new Error('请选择 96～8192 像素、5 MB 以内的 PNG、JPEG、WebP 或静态 AVIF 图片');
  return {mime,width,height};
}
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const tokens=s=>normalizeGameTitle(String(s||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2')).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
const pokiArtworkPath=url=>url.hostname==='img.poki-cdn.com' ? url.pathname.match(/^\/cdn-cgi\/image\/[^/]+(\/[a-f0-9]{32}\/[^/]+)$/i)?.[1] : null;
export function coverCandidates(html,pageUrl,gameTitle,{allowTitleMismatch=false}={}) {
  const cards=[];
  try {
    const page=new URL(pageUrl);
    if (/(^|\.)playhop\.com$/i.test(page.hostname)) {
      const script=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].find(m=>/\bid=["']__playPageData__["']/.test(m[1]));
      const data=script?JSON.parse(script[2]):null;
      const appId=page.pathname.match(/(?:-|\/)(\d+)\/?$/)?.[1];
      if(data && appId && String(data.gameInfo?.appId)===appId) {
        const title=data.gameInfo.title||data.gameData?.title||data.gameTitle;
        const prefix=data.gameData?.media?.cover?.['prefix-url'];
        const observed=html.match(/https?:\/\/[^\s"'<>\\]+/g)||[];
        const cover=prefix&&observed.find(url=>url.startsWith(prefix)&&url.endsWith('/orig'));
        for(const url of [cover,data.gameInfo.iconUrl].filter(Boolean)) {
          if(new URL(url).hostname==='static.playhop.com')cards.push({url,pageUrl,title,kind:'game-card',appId,titleMismatch:!tokens(gameTitle).every(t=>tokens(title).includes(t))});
        }
      }
    }
  } catch { /* Fall back to standard metadata when structured data is unavailable. */ }
  const meta={};
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);meta[attrs.property||attrs.name]=attrs.content;}
  const title=meta['og:title']||decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]||'');
  const expected=tokens(gameTitle),actual=tokens(title);
  let slugTokens=[];
  try {
    const parts=new URL(pageUrl).pathname.split('/').filter(Boolean);
    const last=decodeURIComponent(parts.at(-1)||'').replace(/\.html?$/i,'').replace(/[_-]+/g,' ');
    slugTokens=tokens(last);
  } catch {}
  const slugMatch=slugTokens.length>0 && expected.length>0 && (
    expected.every(t=>slugTokens.includes(t)) ||
    (slugTokens.length>=2 && slugTokens.every(t=>expected.includes(t)))
  );
  const y8CatalogMatch=slugTokens.length>0 && actual.length===slugTokens.length &&
    slugTokens.every((token,index)=>token===actual[index] && token===expected[index]);
  const titleMatches=expected.every(t=>actual.includes(t))&&expected.length>0;
  // 落地页给游戏改名时（构建自报名 geometry-arrow / 页面 slug neon-challenge-legends），
  // 页面自己的游戏卡片图仍是唯一可用的来源封面。只放行「文件名与当前页 slug 逐词相同」
  // 的官方卡片图，且必须由调用方确认过标题与构建名互不相交，避免给抓错的页面配封面。
  const pageOwnArtwork=value=>{
    const artwork=pokiArtworkPath(new URL(value,pageUrl));
    const logoName=artwork?.match(/\/([^/]+)-logo\.(?:png|jpe?g|jfif|webp|avif)$/i)?.[1];
    const logo=tokens(logoName);
    return logo.length>0 && logo.length===slugTokens.length && slugTokens.every((token,index)=>token===logo[index]);
  };
  const sourceTitleMismatch=allowTitleMismatch && expected.length>0 && !titleMatches && !slugMatch &&
    [meta['og:image'],meta['twitter:image']].filter(Boolean).some(value=>{try{return pageOwnArtwork(value);}catch{return false;}});
  if(!expected.length || (!titleMatches && !slugMatch && !y8CatalogMatch && !sourceTitleMismatch))return cards;
  return [...cards,...[...new Set([meta['og:image'],meta['twitter:image']].filter(Boolean))].flatMap(value=>{
    try {
      const url=new URL(value,pageUrl),artwork=pokiArtworkPath(url);
      // Poki calls the actual game card artwork "<game>-logo". Keep the
      // platform-logo filter, accepting only the card for this source slug.
      const logoName=artwork?.match(/\/([^/]+)-logo\.(?:png|jpe?g|jfif|webp|avif)$/i)?.[1];
      const logoTokens=tokens(logoName);
      const gameLogo=/(^|\.)poki\.com$/i.test(new URL(pageUrl).hostname) && !!logoName &&
        slugTokens.length>0 && logoTokens.length===slugTokens.length && slugTokens.every((token,index)=>token===logoTokens[index]);
      if(!['https:','http:'].includes(url.protocol)||/favicon|\/template\/|_kiz10\./i.test(url.pathname)||(/logo/i.test(url.pathname)&&!gameLogo))return [];
      return [{url:url.href,pageUrl,title,titleMismatch:!titleMatches}];
    }catch{return [];}
  })];
}
export async function readCover(root) {
  try{const file=await realpath(path.join(root,'preview','cover.json')),relative=path.relative(await realpath(root),file);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('封面路径超出归档目录');return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
}
export async function saveCover(root,bytes,details) {
  const previous=await readCover(root);
  if(previous?.source==='manual'&&details.source!=='manual')return previous;
  const info=imageInfo(bytes),dir=path.join(root,'preview');await mkdir(dir,{recursive:true});
  // Refuse an external preview junction before writing.
  const relative=path.relative(await realpath(root),await realpath(dir));
  if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('封面路径超出归档目录');
  const record={...details,...info,updatedAt:new Date().toISOString(),image:bytes.toString('base64')};
  const temp=path.join(dir,`cover-${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify(record));await rename(temp,path.join(dir,'cover.json'));return record;
}
async function downloadImage(value) {
  for(let hops=0;hops<4;hops++){
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('无效封面地址');
    const addresses=await lookup(url.hostname,{all:true,family:4});
    // Only public IPv4 destinations; no local service requests from archived metadata.
    if(!addresses.length||addresses.some(({address:a,family})=>family!==4||/^(0|10|127|169\.254|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(a)||Number(a.split('.')[0])>=224))throw new Error('非公开图片地址');
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000)});
    if([301,302,303,307,308].includes(response.status)){value=new URL(response.headers.get('location'),url).href;await response.body?.cancel();continue;}
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const parts=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>5*1024*1024)throw new Error('封面超过5 MB');parts.push(chunk);}return Buffer.concat(parts);
  }
  throw new Error('封面跳转过多');
}
export function sameCoverImage(resourceUrl, coverUrl) {
  try {
    const resource=new URL(resourceUrl), cover=new URL(coverUrl);
    if(resource.href===cover.href)return true;
    if(resource.origin!==cover.origin)return false;
    if(resource.hostname==='img.poki-cdn.com') {
      const artwork=pokiArtworkPath(cover);
      return !!artwork && artwork===pokiArtworkPath(resource);
    }
    if(resource.hostname==='imgs.crazygames.com') {
      // This CDN varies dimensions/quality in the query; the artwork and its
      // version are both in the path. Never reuse another game or revision.
      return /^\/[^/]+\/[^/]+\/[^/]+-cover$/.test(cover.pathname) && resource.pathname===cover.pathname;
    }
    if(resource.hostname==='cdn2.y8.com') {
      const imageId=url=>url.pathname.match(/^\/cloudimage\/(\d+)\/file\/[^/]+$/)?.[1];
      return !!imageId(resource) && imageId(resource)===imageId(cover);
    }
    if(/(^|\.)yad\.com$/i.test(resource.hostname)) {
      const thumb=url=>url.pathname.match(/^\/cdn-cgi\/image\/[^/]+(\/thumb\/[^/]+)$/i)?.[1];
      return !!thumb(resource) && thumb(resource)===thumb(cover);
    }
    return resource.pathname.startsWith('/cdn-cgi/image/') && resource.pathname.endsWith(cover.pathname) && cover.pathname.startsWith('/upload/');
  } catch { return false; }
}
export async function extractArchiveCover(root,manifest,{allowNetwork=false,refresh=false}={}) {
  const existing=await readCover(root);
  if(existing && (!refresh||existing.source==='manual'))return {status:'existing'};
  const name=manifest.resolvedGameName||manifest.gameTitle;
  // 页面标题与构建名互不相交（落地页改名）时，允许回落到页面自身的卡片图并标记来源不符。
  const renamedByLandingPage=manifest.identityCheck?.match===false;
  const candidates=[];
  for(const resource of manifest.resources||[]){
    if(!resource.saved||resource.type!=='document'||!resource.path)continue;
    const file=path.resolve(root,resource.path),rel=path.relative(path.resolve(root),file);
    if(rel.startsWith('..')||path.isAbsolute(rel))continue;
    try{candidates.push(...coverCandidates(await readFile(file,'utf8'),resource.url,name,{allowTitleMismatch:renamedByLandingPage}));}catch{}
  }
  candidates.sort((a,b)=>Number(!!a.titleMismatch)-Number(!!b.titleMismatch) || Number(b.kind==='game-card')-Number(a.kind==='game-card'));
  for(const candidate of candidates){
    try{
      const matches=manifest.resources.filter(r=>r.saved&&r.path&&sameCoverImage(r.url,candidate.url));
      const local=matches.sort((a,b)=>(b.bytes||0)-(a.bytes||0))[0];
      let bytes;
      if(local){
        try {const file=await realpath(path.resolve(root,local.path)),rel=path.relative(await realpath(root),file);if(rel.startsWith('..')||path.isAbsolute(rel))continue;bytes=await readFile(file);imageInfo(bytes);}
        catch { if(!allowNetwork)continue;bytes=await downloadImage(candidate.url); }
      } else if(allowNetwork)bytes=await downloadImage(candidate.url);
      else continue;
      const info=imageInfo(bytes);if(info.width/info.height>2.5||info.height/info.width>2.5)continue;
      await saveCover(root,bytes,{source:'website',...candidate});return {status:'saved',url:candidate.url};
    }catch{/* Try the next identity-matched candidate, never fall back to a random screenshot. */}
  }
  return {status:'missing',reason:candidates.length?'封面图片未取得':'未找到名称匹配的封面'};
}
