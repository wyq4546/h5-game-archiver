import {readFile} from 'node:fs/promises';
import path from 'node:path';

export function serviceWorkerRegistrations(text) {
  return [...text.matchAll(/\bnavigator\.serviceWorker\.register\s*\(\s*["']([^"'\r\n]+)["']/g)].map(match=>match[1]);
}

export function constructOfflineCacheDeclaration(text) {
  const cache=text.match(/\bCACHE_NAME_PREFIX\s*=\s*["'](c[23]offline)["']/)?.[1];
  const manifest=text.match(/\bOFFLINE_DATA_FILE\s*=\s*["']([^"']+)["']/)?.[1];
  const lists = ['fileList', ...[...text.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*\.fileList\b/g)].map(m=>m[1])];
  const directoryPrecache = [...text.matchAll(/\b([A-Za-z_$][\w$]*)\.unshift\s*\(\s*["']\.\/["']\s*\)/g)].some(match => lists.includes(match[1]));
  if (!cache || !manifest || !directoryPrecache) return null;
  return {manifest,cache};
}

export function isOptionalOfflineCacheFailure(record, manifest) {
  const evidence=record.nonCriticalFailure;
  if (evidence?.category!=='construct-directory-precache' || record.status!==404 || record.type!=='fetch' ||
      (record.method || 'GET')!=='GET' || record.requestSource?.type!=='service-worker' ||
      record.requestSource.url!==evidence.workerUrl || manifest.runtimeInspection?.engine!=='Construct' || !manifest.runtimeInspection.coreReady) return false;
  try {
    const game=new URL(manifest.gameUrl), target=new URL(record.url), scope=new URL('.',game);
    if (target.href!==scope.href || new URL(evidence.workerUrl).origin!==game.origin || new URL('.',evidence.workerUrl).href!==scope.href) return false;
    return manifest.resources.some(entry=>entry.saved && entry.status>=200 && entry.status<300 && entry.type==='document' &&
      new URL(entry.url).origin===game.origin && new URL(entry.url).pathname===game.pathname);
  } catch {return false;}
}

// Only classify the proven optional directory prefetch in Construct's offline
// updater. Preserve its response and never exempt main-thread/API/asset 404s.
export async function classifyOfflineCacheRequests(root,manifest) {
  for (const record of manifest.resources) if (record.nonCriticalFailure?.category==='construct-directory-precache') delete record.nonCriticalFailure;
  let game;try{game=new URL(manifest.gameUrl);}catch{return [];}
  if (!manifest.resources.some(entry=>{
    try{return entry.saved && entry.status>=200 && entry.status<300 && entry.type==='document' && new URL(entry.url).origin===game.origin && new URL(entry.url).pathname===game.pathname;}catch{return false;}
  })) return [];
  const scope=new URL('.',game), scripts=manifest.resources.filter(r=>r.saved && r.path && r.status>=200 && r.status<300 && (r.type === 'document' || /\.(?:js|html?)(?:[?#]|$)/i.test(r.url)));
  const texts=new Map();
  for (const script of scripts) {
    const url=new URL(script.url);
    if (url.origin!==game.origin || !url.pathname.startsWith(scope.pathname) || script.bytes>2*1024*1024) continue;
    texts.set(script.url,await readFile(path.join(root,script.path),'utf8').catch(()=>''));
  }
  const warnings=[];
  for (const [registrationUrl,text] of texts) for (const reference of serviceWorkerRegistrations(text)) {
    let workerUrl;try{workerUrl=new URL(reference,game).href;}catch{continue;}
    const declaration=constructOfflineCacheDeclaration(texts.get(workerUrl)||'');
    if (!declaration) continue;
    const offlineUrl=new URL(declaration.manifest,workerUrl).href;
    const offline=manifest.resources.find(r=>r.url===offlineUrl && r.saved && r.path && r.status>=200 && r.status<300);
    if (!offline) continue;
    try {const data=JSON.parse((await readFile(path.join(root,offline.path),'utf8')).replace(/^\uFEFF/,''));if(!Array.isArray(data.fileList)||!data.fileList.every(x=>typeof x==='string'))continue;}catch{continue;}
    for (const record of manifest.resources) {
      if(record.url!==scope.href || record.status!==404 || record.type!=='fetch' || (record.method||'GET')!=='GET' || record.requestSource?.type!=='service-worker' || record.requestSource.url!==workerUrl)continue;
      record.nonCriticalFailure={category:'construct-directory-precache',workerUrl,manifestUrl:offlineUrl,
        reason:'Construct 离线缓存请求目录地址返回 404；实际 index 入口已保存，目录预缓存不属于游戏启动依赖'};
      warnings.push({url:record.url,...record.nonCriticalFailure});
    }
  }
  return warnings;
}
