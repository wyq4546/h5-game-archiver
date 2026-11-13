#!/usr/bin/env node
// 从 scene-dump.json 生成"地面表"，含 Tile_Drop 连续层数标记
// 输出 ground-map.json: { lanes: [...], tiles: { "x": [ {z, type, consecutive, walkable} ] } }
import fs from 'fs';

const dump = JSON.parse(fs.readFileSync(process.argv[2] || 'scene-dump.json', 'utf8'));
const base = n => n.replace(/ \(\d+\)$/, '');
const Z = r => r.worldZ !== undefined ? r.worldZ : r.z;
const X = r => r.worldX !== undefined ? r.worldX : r.x;

const NORMAL = ['Tile_Normal', 'Tile_Fall'];
const DROP = ['Tile_Drop'];
const ALL_GROUND = [...NORMAL, ...DROP, 'DropTiles', 'MovingTiles'];

// 收集所有瓦片
const tiles = [];
for (const r of dump) {
  const b = base(r.name);
  if (!ALL_GROUND.includes(b)) continue;
  tiles.push({ x: +X(r).toFixed(2), z: +Z(r).toFixed(2), type: b });
}

// 按 x 分组，按 z 排序
const byLane = new Map();
for (const t of tiles) {
  const k = t.x;
  if (!byLane.has(k)) byLane.set(k, []);
  byLane.get(k).push(t);
}

// 计算每个 Tile_Drop 的连续层数
// 规则：同一 x 上，z 相邻（差值 <= 2.05）且类型为 Tile_Drop 的连续块
const result = { lanes: [], tiles: {} };
for (const [x, arr] of [...byLane.entries()].sort((a, b) => a[0] - b[0])) {
  // 去重同 x 同 z
  const seen = new Set();
  const uniq = [];
  for (const t of arr.sort((a, b) => a.z - b.z)) {
    const k = t.z;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(t);
  }
  // 找连续 D 块
  let i = 0;
  while (i < uniq.length) {
    if (uniq[i].type !== 'Tile_Drop') { i++; continue; }
    let j = i;
    while (j + 1 < uniq.length && uniq[j + 1].type === 'Tile_Drop' && Math.abs(uniq[j + 1].z - uniq[j].z) <= 2.05) j++;
    const runLen = j - i + 1;
    for (let k = i; k <= j; k++) uniq[k].consecutive = runLen;
    i = j + 1;
  }
  // 标记可踩
  for (const t of uniq) {
    if (t.type === 'Tile_Drop') {
      // 连续 >= 2 层 => 不可踩；单层 => 可踩
      t.walkable = t.consecutive < 2;
    } else {
      t.walkable = true;
    }
  }
  result.lanes.push(x);
  result.tiles[x] = uniq;
}

// 汇总
console.log('=== 地面表生成完毕 ===');
console.log('车道数:', result.lanes.length, ' x =', result.lanes.join(', '));
let nNormal = 0, nDropOk = 0, nDropTrap = 0;
for (const x of result.lanes) {
  for (const t of result.tiles[x]) {
    if (t.type === 'Tile_Drop') {
      if (t.walkable) nDropOk++; else nDropTrap++;
    } else nNormal++;
  }
}
console.log('普通瓦片:', nNormal, ' Tile_Drop 单层可踩:', nDropOk, ' Tile_Drop 连续致命:', nDropTrap);

console.log('\n=== 所有 Tile_Drop 块 ===');
const runs = new Map();
for (const x of result.lanes) {
  for (const t of result.tiles[x]) {
    if (t.type !== 'Tile_Drop') continue;
    const k = `${t.z}~${t.consecutive}`;
    if (!runs.has(k)) runs.set(k, { z: t.z, len: t.consecutive, lanes: [] });
    runs.get(k).lanes.push(x);
  }
}
for (const [, r] of [...runs.entries()].sort((a, b) => a[1].z - b[1].z)) {
  console.log(`  z=${r.z}  连续 ${r.len} 层  x: ${r.lanes.join(',')}  => ${r.len >= 2 ? '致命' : '可踩'}`);
}

fs.writeFileSync('ground-map.json', JSON.stringify(result));
console.log('\n写入 ground-map.json', (fs.statSync('ground-map.json').size / 1024).toFixed(1) + 'KB');
