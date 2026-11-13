// 在真实瓦片节点上做图搜索，生成 Level 1 路线
// 节点 = (z, x) 的真实瓦片；边 = 相邻瓦片 z 层之间，满足横向斜率上限且中途不撞障碍
import fs from 'node:fs';

const tree = JSON.parse(fs.readFileSync('level1_tree.json', 'utf8'));
const nodes = [];
function walk(n) {
  nodes.push({ name: n.name.replace(/ \(\d+\)$/, ''), x: +n.x.toFixed(2), y: +n.y.toFixed(2), z: +n.z.toFixed(1) });
  for (const c of (n.subChildren || [])) walk(c);
}
for (const tpl of tree) for (const c of (tpl.subChildren || [])) walk(c);

const GT = new Set(['Tile_Normal', 'Tile_Fall', 'Tile_Drop', 'DropTiles', 'MovingTiles']);
const OBS = new Set(['Pillar', 'Weights', 'Weights_WingBody', 'Cannon', 'Tire',
  'Tree', 'Tree_Medium', 'Tree_Short', 'TreeBottom', 'Tree_Root',
  'Hammer', 'Hammer2', 'Pusher']);
const SPIN = new Set(['Hammer', 'Hammer2']);

const rows = nodes.filter(n => n.z >= -1 && n.z <= 1020);
// 地面：按 (x,z) 去重
const tileSet = new Map();
for (const r of rows) if (GT.has(r.name)) tileSet.set(r.x + '|' + r.z, { x: r.x, z: r.z });
const tiles = [...tileSet.values()];
// 障碍：合并同类簇，记录类型
const obsMap = new Map();
for (const r of rows) {
  if (!OBS.has(r.name)) continue;
  const key = r.x + '|' + r.z;
  const prev = obsMap.get(key);
  const kind = SPIN.has(r.name) ? 'spin' : (r.name === 'Pusher' ? 'push' : 'static');
  if (!prev) obsMap.set(key, { x: r.x, z: r.z, kind, names: [r.name] });
  else { prev.names.push(r.name); if (kind !== 'static') prev.kind = kind; }
}
const obsList = [...obsMap.values()].map(o => ({
  x: o.x, z: o.z, kind: o.kind,
  w: o.names.includes('Weights') ? 1.7 : (o.kind === 'spin' ? 1.6 : 1.0),
}));

// 按 z 分层
const zLayers = new Map();
for (const t of tiles) {
  if (!zLayers.has(t.z)) zLayers.set(t.z, []);
  zLayers.get(t.z).push(t.x);
}
const zs = [...zLayers.keys()].sort((a, b) => a - b);

const MAX_SLOPE = 1.0;
const CLEAR = 0.55;   // 额外安全余量

function segClear(z1, x1, z2, x2) {
  const n = Math.max(2, Math.ceil((z2 - z1) / 0.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n, z = z1 + (z2 - z1) * t, x = x1 + (x2 - x1) * t;
    for (const o of obsList) {
      if (o.z < Math.min(z1,z2) - 0.9 || o.z > Math.max(z1,z2) + 0.9) continue;
      // 旋转类给更大半径（摆臂扫过）
      const r = o.w + CLEAR + (o.kind === 'spin' ? 0.6 : 0);
      if (Math.abs(o.x - x) < r) return false;
    }
  }
  return true;
}

// DP over layers
// state: x value at this layer
let prevLayer = new Map();   // x -> {cost, fromX}
// 起点：z=0 附近的瓦片，x 取 0（没有就取最近的）
const startZ = zs[0];
const startXs = zLayers.get(startZ);
let bestStart = startXs.reduce((a, b) => Math.abs(b) < Math.abs(a) ? b : a, startXs[0]);
prevLayer.set(bestStart, { cost: 0, from: null });

const history = [];   // 每层: Map(x -> fromX)

for (let li = 1; li < zs.length; li++) {
  const z2 = zs[li], xs2 = zLayers.get(z2);
  const z1 = zs[li - 1];
  const cur = new Map();
  for (const x2 of xs2) {
    let best = null;
    for (const [x1, st] of prevLayer) {
      const dz = z2 - z1;
      if (dz <= 0) continue;
      if (Math.abs(x2 - x1) / dz > MAX_SLOPE + 1e-9) continue;
      if (!segClear(z1, x1, z2, x2)) continue;
      const cost = st.cost + Math.abs(x2 - x1) * 1.0 + Math.abs(x2) * 0.02;
      if (!best || cost < best.cost) best = { cost, from: x1 };
    }
    if (best) cur.set(x2, best);
  }
  history[li] = cur;
  prevLayer = cur;
  if (cur.size === 0) {
    console.log('!! 在 z=' + z2 + ' 处断链（上一层只有 ' + history[li - 1].size + ' 个可达点）');
    break;
  }
}

const lastLi = history.length - 1;
const lastZ = zs[lastLi];
let bestX = null, bestCost = Infinity;
for (const [x, st] of (history[lastLi] || new Map())) if (st.cost < bestCost) { bestCost = st.cost; bestX = x; }
console.log('可达的最后一个 z =', lastZ, ' x =', bestX, ' cost =', bestCost.toFixed(1));

// 回溯
const path = [];
let cx = bestX;
for (let li = lastLi; li >= 0; li--) {
  path.push({ z: zs[li], x: cx });
  const st = li === 0 ? null : (history[li] || new Map()).get(cx);
  if (!st) break;
  cx = st.from;
}
path.reverse();

// 抽稀：只保留拐点
const wp = [];
for (let i = 0; i < path.length; i++) {
  if (i === 0 || i === path.length - 1) { wp.push(path[i]); continue; }
  const a = path[i - 1], b = path[i], c = path[i + 1];
  const s1 = (b.z === a.z) ? 0 : (b.x - a.x) / (b.z - a.z);
  const s2 = (c.z === b.z) ? 0 : (c.x - b.x) / (c.z - b.z);
  if (Math.abs(s1 - s2) > 0.02) wp.push(b);
}
fs.writeFileSync('waypoints.json', JSON.stringify({ level: 1, levelLength: 1000, source: 'scene-tree-graph-search', waypoints: wp }, null, 2));
console.log('waypoint 数:', wp.length, '覆盖 z:', wp[0].z, '~', wp[wp.length - 1].z);
let ms = 0, msAt = 0;
for (let i = 1; i < wp.length; i++) {
  const dz = wp[i].z - wp[i - 1].z; if (dz <= 0) continue;
  const s = Math.abs(wp[i].x - wp[i - 1].x) / dz;
  if (s > ms) { ms = s; msAt = wp[i].z; }
}
console.log('最大 |dx/dz| =', ms.toFixed(3), '@z=' + msAt);
console.log('前 30 个:', wp.slice(0, 30).map(p => p.z + ':' + p.x).join('  '));
