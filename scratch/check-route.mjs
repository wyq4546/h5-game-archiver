// 校验 waypoint 折线：逐 0.5z 检查是否踩在瓦片上、是否撞障碍、斜率是否超限
import fs from 'node:fs';

const TREE = process.argv[2] || 'level1_tree.json';
const WP = process.argv[3] || 'waypoints.json';
const tree = JSON.parse(fs.readFileSync(TREE, 'utf8'));
const plan = JSON.parse(fs.readFileSync(WP, 'utf8'));
const wp = plan.waypoints;

const nodes = [];
function walk(n) {
  nodes.push({ name: n.name.replace(/ \(\d+\)$/, ''), x: n.x, z: n.z });
  for (const c of (n.subChildren || [])) walk(c);
}
for (const tpl of tree) for (const c of (tpl.subChildren || [])) walk(c);

const TILE_OK = new Set(['Tile_Normal', 'Tile_Fall', 'Tile_Drop', 'DropTiles', 'MovingTiles']);
const SOLID = new Set(['Pillar','Weights','Weights_WingBody','Hammer','Hammer2','Cannon','Tire',
  'Tree','Tree_Medium','Tree_Short','TreeBottom','Tree_Root','Pusher','MovingTiles','DropTiles',
  'Cube_005','Cube_006','Cube_007','PBottom','Circle_002','Cylinder','Cylinder_002','Main','Collider','Empty_001']);
const TILE_HALF = 1.0, OBS_HALF = 0.95;

function xAt(z) {
  if (z <= wp[0].z) return wp[0].x;
  for (let i = 1; i < wp.length; i++) {
    if (z <= wp[i].z) {
      const a = wp[i - 1], b = wp[i];
      const t = (b.z - a.z) === 0 ? 0 : (z - a.z) / (b.z - a.z);
      return a.x + (b.x - a.x) * t;
    }
  }
  return wp[wp.length - 1].x;
}

let air = [], hit = [], worstSlope = 0, slopeAt = 0;
const N = Math.round(1015 / 0.5);
for (let i = 0; i <= N; i++) {
  const z = i * 0.5, x = xAt(z);
  const near = nodes.filter(r => Math.abs(r.z - z) <= 1.05);
  const tiles = near.filter(r => TILE_OK.has(r.name));
  const solids = near.filter(r => SOLID.has(r.name));
  const onTile = tiles.some(t => Math.abs(t.x - x) <= TILE_HALF);
  const bad = solids.filter(s => Math.abs(s.x - x) < OBS_HALF);
  if (!onTile) air.push(+z.toFixed(1));
  if (bad.length) hit.push({ z: +z.toFixed(1), x: +x.toFixed(2), obs: bad.map(b => b.name + '@' + b.x).join('/') });
}
for (let i = 1; i < wp.length; i++) {
  const dz = wp[i].z - wp[i - 1].z;
  if (dz > 0) { const s = Math.abs(wp[i].x - wp[i - 1].x) / dz; if (s > worstSlope) { worstSlope = s; slopeAt = wp[i].z; } }
}

function ranges(arr) {
  if (!arr.length) return '(none)';
  const out = []; let s = arr[0], p = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] - p <= 0.51) { p = arr[i]; continue; }
    out.push(s === p ? String(s) : s + '~' + p); s = p = arr[i];
  }
  out.push(s === p ? String(s) : s + '~' + p);
  return out.join(', ');
}

console.log('waypoint 数:', wp.length, ' 覆盖 z:', wp[0].z, '~', wp[wp.length - 1].z);
console.log('最大 |dx/dz| =', worstSlope.toFixed(3), '@z=' + slopeAt, '(能力上限约 0.80)');
console.log('撞障碍的点数:', hit.length);
if (hit.length) { console.log('  前 10 个: ' + hit.slice(0, 10).map(h => 'z' + h.z + ' x' + h.x + ' [' + h.obs + ']').join(' | ')); }
const airZ = [...new Set(air)].sort((a, b) => a - b);
console.log('离开瓦片的 z 段数:', ranges(airZ) === '(none)' ? 0 : ranges(airZ).split(', ').length);
console.log('  悬空区间: ' + ranges(airZ));
