// 用真实场景坐标规划 Level 1 路线
// 输入: level1_tree.json（agy 从 Unity 场景树 dump 出来，子节点坐标即世界坐标）
// 输出: waypoints.json + 走廊可视化
import fs from 'node:fs';

const TREE = process.argv[2] || 'level1_tree.json';
const OUT = process.argv[3] || 'waypoints.json';

const tree = JSON.parse(fs.readFileSync(TREE, 'utf8'));

// ---------- 1. 扁平化 ----------
const nodes = [];
function walk(n) {
  nodes.push({ name: n.name.replace(/ \(\d+\)$/, ''), x: n.x, y: n.y, z: n.z });
  for (const c of (n.subChildren || [])) walk(c);
}
for (const tpl of tree) for (const c of (tpl.subChildren || [])) walk(c);

const TILE_OK = new Set(['Tile_Normal', 'Tile_Fall', 'Tile_Drop', 'DropTiles', 'MovingTiles']);
const TILE_HOLE = new Set([]);
// 会挡路/致死的实体障碍
const SOLID = new Set([
  'Pillar', 'Weights', 'Weights_WingBody', 'Hammer', 'Hammer2',
  'Cannon', 'Tire', 'Tree', 'Tree_Medium', 'Tree_Short', 'TreeBottom', 'Tree_Root',
  'Pusher', 'MovingTiles', 'DropTiles', 'Cube_005', 'Cube_006', 'Cube_007', 'PBottom',
  'Circle_002', 'Cylinder', 'Cylinder_002', 'Main', 'Collider', 'Empty_001',
]);

const Z_MAX = 1016;
const rows = nodes.filter(n => n.z >= -0.5 && n.z <= Z_MAX);

// ---------- 2. 每个 z 的几何 ----------
const TILE_HALF = 0.95;    // 瓦片半宽（间距 2）
const OBS_HALF = 0.95;     // 障碍半宽（保守）
const DZ = 0.5;
const Z0 = 0, Z1 = 1010;
const NZ = Math.round((Z1 - Z0) / DZ) + 1;

const steps = [];
for (let i = 0; i < NZ; i++) {
  const z = Z0 + i * DZ;
  const near = rows.filter(r => Math.abs(r.z - z) <= 1.0);
  const tiles = near.filter(r => TILE_OK.has(r.name)).map(r => r.x);
  const holes = near.filter(r => TILE_HOLE.has(r.name)).map(r => r.x);
  const solids = near.filter(r => SOLID.has(r.name)).map(r => r.x);
  steps.push({ z, tiles, holes, solids });
}

// ---------- 3. DP ----------
const X_MIN = -4.6, X_MAX = 4.6;
const NX = 47;                      // 0.2 一格
const xs = Array.from({ length: NX }, (_, i) => +(X_MIN + i * 0.2).toFixed(2));
const MAX_SLOPE = 0.70;             // 实测横向能力 ~11.3/14 ≈ 0.8，留余量
const maxStep = MAX_SLOPE * DZ;     // 每步允许的最大横向位移

function costAt(step, x) {
  // 障碍惩罚
  let c = 0;
  for (const ox of step.solids) {
    const d = Math.abs(x - ox);
    if (d < OBS_HALF) return Infinity;
    if (d < OBS_HALF + 0.6) c += (OBS_HALF + 0.6 - d) * 40;
  }
  // 地面
  let onTile = false, nearTile = 1e9;
  for (const tx of step.tiles) {
    const d = Math.abs(x - tx);
    if (d <= TILE_HALF) onTile = true;
    nearTile = Math.min(nearTile, d);
  }
  if (onTile) c += 0;
  else c += 6 + Math.min(30, nearTile * 4);   // 悬空：可跳，但代价高
  // 回中偏好（略），避免贴边
  c += Math.abs(x) * 0.15;
  return c;
}

let prev = new Float64Array(NX).fill(Infinity);
let back = [];
prev[xs.findIndex(v => Math.abs(v) < 0.11)] = 0;   // 起点 x≈0

for (let i = 0; i < NZ; i++) {
  const cur = new Float64Array(NX).fill(Infinity);
  const bk = new Int16Array(NX).fill(-1);
  const step = steps[i];
  for (let j = 0; j < NX; j++) {
    const cc = costAt(step, xs[j]);
    if (!isFinite(cc)) continue;
    let best = Infinity, bi = -1;
    const lo = Math.max(0, j - Math.ceil(maxStep / 0.2));
    const hi = Math.min(NX - 1, j + Math.ceil(maxStep / 0.2));
    for (let k = lo; k <= hi; k++) {
      if (!isFinite(prev[k])) continue;
      const dx = Math.abs(xs[j] - xs[k]);
      if (dx > maxStep + 1e-9) continue;
      const v = prev[k] + cc + dx * 3;   // 横移代价
      if (v < best) { best = v; bi = k; }
    }
    cur[j] = best; bk[j] = bi;
  }
  back.push(bk);
  prev = cur;
}

// 回溯
let endJ = 0;
for (let j = 1; j < NX; j++) if (prev[j] < prev[endJ]) endJ = j;
const path = new Array(NZ);
let j = endJ;
for (let i = NZ - 1; i >= 0; i--) {
  path[i] = { z: steps[i].z, x: xs[j] };
  j = back[i][j];
  if (j < 0 && i > 0) { console.error('回溯断裂于 i=' + i); break; }
}

// ---------- 4. 简化成 waypoint（RDP 抽稀） ----------
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  let maxD = -1, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const t = (b.z - a.z) === 0 ? 0 : (p.z - a.z) / (b.z - a.z);
    const projX = a.x + (b.x - a.x) * t;
    const d = Math.abs(p.x - projX);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const l = rdp(pts.slice(0, idx + 1), eps);
    const r = rdp(pts.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }
  return [a, b];
}
const wp = [];
for (let i = 0; i < NZ; i += 4) {   // 每 2 个 z 一个点，不做抽稀，避免切角
  wp.push({ z: +path[i].z.toFixed(1), x: +path[i].x.toFixed(2) });
}
if (wp[wp.length - 1].z < path[NZ - 1].z) wp.push({ z: +path[NZ - 1].z.toFixed(1), x: +path[NZ - 1].x.toFixed(2) });

fs.writeFileSync(OUT, JSON.stringify({ level: 1, levelLength: 1000, generatedFrom: 'scene-tree', waypoints: wp }, null, 2));

// ---------- 5. 报告 ----------
console.log('z 采样点:', NZ, ' x 网格:', NX, ' 最大横移/步:', maxStep.toFixed(2));
console.log('waypoint 数:', wp.length, ' 写入', OUT);
let maxSlope = 0, maxSlopeAt = 0;
for (let i = 1; i < wp.length; i++) {
  const dz = wp[i].z - wp[i - 1].z, dx = Math.abs(wp[i].x - wp[i - 1].x);
  if (dz > 0) { const s = dx / dz; if (s > maxSlope) { maxSlope = s; maxSlopeAt = wp[i].z; } }
}
console.log('最大 |dx/dz| =', maxSlope.toFixed(3), '@z=' + maxSlopeAt);
console.log('前 25 个 waypoint:');
console.log('  ' + wp.slice(0, 25).map(p => `${p.z}:${p.x}`).join('  '));
