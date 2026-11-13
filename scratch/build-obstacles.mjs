// 从场景树生成紧凑障碍/瓦片表，供运行时反应式避障使用
import fs from 'node:fs';

const tree = JSON.parse(fs.readFileSync('level1_tree.json', 'utf8'));
const nodes = [];
function walk(n) {
  nodes.push({ name: n.name.replace(/ \(\d+\)$/, ''), x: +n.x.toFixed(2), y: +n.y.toFixed(2), z: +n.z.toFixed(1) });
  for (const c of (n.subChildren || [])) walk(c);
}
for (const tpl of tree) for (const c of (tpl.subChildren || [])) walk(c);

const rows = nodes.filter(n => n.z >= -1 && n.z <= 1020).sort((a, b) => a.z - b.z);

// 可通行地面（瓦片中心 + 半宽）
const GROUND = ['Tile_Normal', 'Tile_Fall', 'Tile_Drop', 'DropTiles', 'MovingTiles'];
// 静态实体障碍（挡路/致死）
const STATIC_OBS = ['Pillar', 'Weights', 'Weights_WingBody', 'Cannon', 'Tire',
  'Tree', 'Tree_Medium', 'Tree_Short', 'TreeBottom', 'Tree_Root',
  'Cube_005', 'Cube_006', 'Cube_007', 'PBottom',

];
// 旋转/摆动类（位置固定但有时序，宽度要大一些）
const SPIN = ['Hammer', 'Hammer2'];
// 推板类（会把球横向推走）
const PUSH = ['Pusher'];

const ground = [];
const obs = [];
const spin = [];
const push = [];

// 只保留“最外层”的实体：Collider/Cube_00x/PBottom 是 Pillar 的子件，重复计数
const seen = new Set();
for (const r of rows) {
  const key = r.name + '@' + r.x + ',' + r.z;
  if (GROUND.includes(r.name) && !seen.has('G' + key)) { seen.add('G' + key); ground.push({ x: r.x, z: r.z }); }
}

// 障碍按 (x,z) 去重，并合并同位置的多件套（Pillar + Cube_005..007 + PBottom + Collider）
const clusters = new Map();
for (const r of rows) {
  const isObs = STATIC_OBS.includes(r.name) || SPIN.includes(r.name) || PUSH.includes(r.name);
  if (!isObs) continue;
  let kind = 'static';
  if (SPIN.includes(r.name)) kind = 'spin';
  if (PUSH.includes(r.name)) kind = 'push';
  const key = Math.round(r.x * 10) + '|' + Math.round(r.z * 10);
  const prev = clusters.get(key);
  if (!prev) {
    clusters.set(key, { x: r.x, z: r.z, kind, names: new Set([r.name]) });
  } else {
    prev.names.add(r.name);
    // spin/push 优先级高于 static
    if (kind === 'spin' || (kind === 'push' && prev.kind === 'static')) prev.kind = kind;
  }
}
const clusterArr = [...clusters.values()].map(c => ({ x: c.x, z: c.z, kind: c.kind, w: c.names.has('Weights') ? 1.7 : 1.0 }));
for (const c of clusterArr) {
  if (c.kind === 'spin') spin.push(c);
  else if (c.kind === 'push') push.push(c);
  else obs.push(c);
}
const byZ = (a, b) => a.z - b.z;
ground.sort(byZ); obs.sort(byZ); spin.sort(byZ); push.sort(byZ);

const out = {
  level: 1,
  levelLength: 1000,
  laneXs: [-4, -2, 0, 2, 4],
  tileWidth: 2,
  notes: '坐标取自 Unity 场景树，子节点即世界坐标。ground=可踩瓦片中心；obs=静态实体；spin=旋转锤(时序)；push=推板。',
  counts: { ground: ground.length, obs: obs.length, spin: spin.length, push: push.length },
  ground, obs, spin, push,
};
fs.writeFileSync('level1-obstacles.json', JSON.stringify(out, null, 0));
console.log('ground', ground.length, 'obs', obs.length, 'spin', spin.length, 'push', push.length);
console.log('文件大小:', (fs.statSync('level1-obstacles.json').size / 1024).toFixed(1) + ' KB');

// 打印关键区间的障碍，供人眼核对
console.log('\n=== z=100~145 的障碍 ===');
for (const c of clusterArr.filter(c => c.z >= 100 && c.z <= 145).sort(byZ)) {
  console.log('  z=' + c.z + '  x=' + c.x + '  ' + c.kind + '  w=' + c.w);
}
