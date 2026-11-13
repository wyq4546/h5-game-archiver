// 用 scene-dump.json 的真实 localScale 生成障碍表
// 基准：瓦片 scaleX=1 → 实体宽 2.0（车道间距 2，5 道 -4..4 正好铺满），故 半宽 = localScaleX
import fs from 'node:fs';

const j = JSON.parse(fs.readFileSync('scene-dump.json', 'utf8'));
const base = n => n.replace(/ \(\d+\)$/, '');

const GT = new Set(['Tile_Normal', 'Tile_Fall', 'Tile_Drop', 'DropTiles', 'MovingTiles']);
// 真正挡路的父级件（子件随父件同 (x,z)，忽略）
const OBS_PARENT = new Set(['Pillar', 'Weights', 'Cannon', 'Tire', 'Hammer', 'Hammer2', 'Pusher']);
// 树系列：装饰在两侧，但可能伸进道内，单独标记
const TREE = new Set(['Tree', 'Tree_Medium', 'Tree_Short', 'TreeBottom', 'Tree_Root']);

const TILE_HW = 1.0;

const ground = new Map();
const obsMap = new Map();

for (const r of j) {
  const n = base(r.name);
  if (GT.has(n)) {
    ground.set(r.worldX + '|' + r.worldZ, { x: +r.worldX.toFixed(2), z: +r.worldZ.toFixed(1) });
    continue;
  }
  if (!OBS_PARENT.has(n) && !TREE.has(n)) continue;
  if (TREE.has(n) && r.depth > 2) continue;   // 树的子件不重复计
  const key = r.worldX + '|' + r.worldZ;
  let hw = Math.abs(r.localScaleX) * (TILE_HW);   // 半宽
  let kind = 'static';
  if (n === 'Hammer' || n === 'Hammer2') { kind = 'spin'; hw = 1.6; }  // 旋转臂扫掠，取保守值
  if (n === 'Pusher') kind = 'push';
  if (n === 'Weights') hw = Math.max(hw, 0.85);
  if (TREE.has(n)) { kind = 'tree'; hw = Math.max(hw, 0.9); }
  const prev = obsMap.get(key);
  if (!prev) obsMap.set(key, { x: +r.worldX.toFixed(2), z: +r.worldZ.toFixed(1), kind, hw: +hw.toFixed(2), names: [n] });
  else {
    prev.hw = Math.max(prev.hw, +hw.toFixed(2));
    prev.names.push(n);
    if (kind === 'spin') prev.kind = 'spin';
  }
}

const groundArr = [...ground.values()].sort((a, b) => a.z - b.z);
const obsArr = [...obsMap.values()].sort((a, b) => a.z - b.z);

const out = {
  level: 1, levelLength: 1000,
  laneXs: [-4, -2, 0, 2, 4], tileWidth: 2, tileHalfWidth: 1.0,
  note: '坐标=世界坐标(直接取 worldX/worldZ，不加 Template). hw=障碍半宽, 由 localScaleX*1.0 推得(瓦片scaleX=1对应实体宽2). spin=旋转锤, hw取保守1.6. tree=装饰性树, 可能不挡路.',
  counts: {
    ground: groundArr.length,
    static: obsArr.filter(o => o.kind === 'static').length,
    spin: obsArr.filter(o => o.kind === 'spin').length,
    push: obsArr.filter(o => o.kind === 'push').length,
    tree: obsArr.filter(o => o.kind === 'tree').length,
  },
  ground: groundArr,
  obs: obsArr,
};
fs.writeFileSync('level1-obstacles-v2.json', JSON.stringify(out));
console.log('ground', groundArr.length, JSON.stringify(out.counts));
console.log('大小:', (fs.statSync('level1-obstacles-v2.json').size / 1024).toFixed(1), 'KB');

// 逐 z 可用宽度检查：找出"全关无路"的 z
const zLayers = new Map();
for (const g of groundArr) {
  if (!zLayers.has(g.z)) zLayers.set(g.z, []);
  zLayers.get(g.z).push(g.x);
}
const zs = [...zLayers.keys()].sort((a, b) => a - b);
let dead = [];
for (const z of zs) {
  const xs = zLayers.get(z);
  const free = xs.filter(x => {
    for (const o of obsArr) {
      if (Math.abs(o.z - z) > 1.0) continue;
      if (o.kind === 'tree') continue;
      if (Math.abs(o.x - x) < o.hw + TILE_HW * 0.6) return false;
    }
    return true;
  });
  if (!free.length) dead.push(z);
}
console.log('存在"踩不到安全点"的 z 数量:', dead.length);
if (dead.length) console.log('  前 20 个:', dead.slice(0, 20).join(', '));
