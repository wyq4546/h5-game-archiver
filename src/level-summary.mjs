import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

// This is analysis metadata, never a recording target or number of video files.
export function normalizeLevelSummary(value) {
  if (!value || !Array.isArray(value.evidence) || !value.evidence.length) return null;
  const evidence = value.evidence.filter(e => e && typeof e.file === 'string' && typeof e.detail === 'string');
  if (!evidence.length) return null;
  if (value.kind === 'infinite') return {kind:'infinite', total:null, evidence};
  if (value.kind === 'finite' && Number.isSafeInteger(value.total) && value.total > 0) return {kind:'finite', total:value.total, evidence};
  return null;
}

async function jsonWithin(root, relative) {
  const base = await realpath(root), file = await realpath(path.resolve(root, relative));
  const rel = path.relative(base, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw Error('分析文件超出归档目录');
  const text = await readFile(file, 'utf8');
  if (text.length > 16 * 1024 * 1024) throw Error('分析文件过大');
  return JSON.parse(text);
}

export function numberedLevelTable(value) {
  if (!Array.isArray(value) || !value.length) return null;
  const ids = value.map(row => row && typeof row === 'object' ? row.level ?? row.levelId ?? row.id : null);
  if (!ids.every(Number.isSafeInteger)) return null;
  const sorted = [...ids].sort((a,b)=>a-b);
  if (![0,1].includes(sorted[0]) || !sorted.every((id,i)=>id===sorted[0]+i)) return null;
  return value.length;
}

export function jsonLevelEvidence(data, file) {
  const results=[];
  const add=(rows,label)=>{const total=numberedLevelTable(rows);if(total)results.push({kind:'finite',total,evidence:[{file,detail:label}]});};
  // Only complete named level tables, not layout counts, save data or max unlocked.
  if (/native-levels\.json$/i.test(file)) add(Array.isArray(data)?data:data.levels,'提取的完整原生关卡表');
  if (data && !Array.isArray(data)) {
    for (const key of ['levels','levelConfigs','levelData']) if (Array.isArray(data[key])) add(data[key],`完整 ${key} 表，连续关卡编号`);
  }
  // Cocos packed JSON stores a named asset next to its serialized configuration.
  const visit=(v,depth=0)=>{
    if(depth>15||!Array.isArray(v))return;
    if(typeof v[1]==='string' && /^NormalModeLevel$/.test(v[1]) && typeof v[2]==='string') {
      try{add(JSON.parse(v[2]),'NormalModeLevel 普通模式原生关卡配置');}catch{}
    }
    for(const child of v)if(Array.isArray(child))visit(child,depth+1);
  };
  visit(data);
  return results;
}

export async function analyzeLevelSummary(root, textFiles=[]) {
  const found=[];
  try { const v=normalizeLevelSummary(await jsonWithin(root,'analysis/level-summary.json'));if(v)return v; } catch {}
  const files=[{file:'analysis/gameplay/native-levels.json'},...textFiles.filter(f=>f.scope==='game-core'||f.scope==='game').filter(f=>f.extension==='.json')];
  for(const {file} of files)try{found.push(...jsonLevelEvidence(await jsonWithin(root,file),file));}catch{}
  const totals=[...new Set(found.map(f=>f.total))];
  if(totals.length===1)return {kind:'finite',total:totals[0],evidence:found.flatMap(f=>f.evidence)};
  return {kind:'unknown',total:null,evidence:[],reason:totals.length?'多个关卡表结果不一致，待核实':'未提取到完整关卡表或无限生成逻辑'};
}

export async function readLevelSummary(root, report) {
  if(!report)return {kind:'unparsed',total:null};
  try {const saved=normalizeLevelSummary(await jsonWithin(root,'analysis/level-summary.json'));if(saved)return saved;}catch{}
  return normalizeLevelSummary(report.levelSummary) || {kind:'unknown',total:null};
}
