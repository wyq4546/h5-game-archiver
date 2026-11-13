// 玩家坐标系 + 路内横向坐标的局部转向。
//
// 两个必须一起用的坐标系：
//   1. 纵向/横向的「朝向基」用玩家自身 forward/right —— 第 7 关起道路会 90° 折弯，
//      世界 +z 不再是前进方向；
//   2. 横向的「绝对位置」用 Player 节点的 localPosition.x（LateralMovement 把它夹在
//      ±0.75）—— 世界 x 在折弯关会跑到 -18，只有这个是始终以路中心为 0 的。
// 只靠相对偏移会积累漂移：角色被顶到路边后仍会继续朝同一侧推，力量被扣穿。
import { PLAYER_RADIUS } from './game.mjs';

const NEAR_HORIZON = 3.4;   // 前瞻距离（世界单位）
const ANCHOR_HALF_WIDTH = 1.45;

export function relative(frame, x, z) {
  const dx = x - frame.x;
  const dz = z - frame.z;
  return {
    f: dx * frame.fx + dz * frame.fz,
    r: dx * frame.rx + dz * frame.rz,
  };
}

export function worldAt(frame, forward, lateral) {
  return {
    x: frame.x + frame.fx * forward + frame.rx * lateral,
    z: frame.z + frame.fz * forward + frame.rz * lateral,
  };
}

export function hits(blockers, x, z, radius = 0.20) {
  for (const block of blockers) {
    if (x > block.x0 - radius && x < block.x1 + radius && z > block.z0 - radius && z < block.z1 + radius) return block;
  }
  return null;
}

// 沿 (forward, lateralOffset) 这条直线扫一遍，返回最近一次碰撞的 forward 距离。
export function clearance(frame, blockers, lateralOffset, horizon = NEAR_HORIZON) {
  for (let s = 0.3; s <= horizon; s += 0.15) {
    const t = Math.min(1.0, s / 1.0);
    const interpLat = lateralOffset * t;
    const point1 = worldAt(frame, s, interpLat);
    if (hits(blockers, point1.x, point1.z)) return s;
    const point2 = worldAt(frame, s, lateralOffset);
    if (hits(blockers, point2.x, point2.z)) return s;
  }
  return horizon + 1;
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

const LAT_MAX = 0.72;

function axisState(frame) {
  const lat = Number.isFinite(frame.lat) ? frame.lat : 0;
  return { s0: lat, limit: LAT_MAX };
}

// 离散化标准车道：使用左、中、右 3 条标准车道，杜绝中途微操晃动。
const CANDIDATE_LANES = [-0.55, 0.0, 0.55];

export function laneClearDistance(frame, lane, blockers, maxDist = 7.5) {
  const currentLat = Number.isFinite(frame.lat) ? frame.lat : 0;
  for (let s = 0.3; s <= maxDist; s += 0.15) {
    const t = Math.min(1.0, s / 1.2);
    const lat = currentLat + (lane - currentLat) * t;
    const pt = worldAt(frame, s, lat - currentLat);
    if (hits(blockers, pt.x, pt.z, 0.20)) return s;
  }
  return maxDist;
}

export function laneReward(frame, lane, rewards, horizon = 5.0) {
  let score = 0;
  const currentLat = Number.isFinite(frame.lat) ? frame.lat : 0;
  for (const r of rewards) {
    if ((r.value ?? 1) <= 0) continue;
    const rel = relative(frame, r.x, r.z);
    if (rel.f < 0.4 || rel.f > horizon) continue;
    if (Math.abs(rel.r - (lane - currentLat)) < 0.26) {
      score += (r.value ?? 1);
    }
  }
  return score;
}

// 主决策：优先安全避障，在安全车道间积极追逐高分门与食物奖励，同时维持迟滞滤波杜绝无意义抖动。
export function chooseLateral(frame, blockers, rewards, options = {}) {
  const { s0, limit } = axisState(frame);
  const currentTarget = options.currentTarget != null && Number.isFinite(options.currentTarget) ? options.currentTarget : s0;

  // 1. 评估所有候选车道的安全净空与奖励分
  const candidates = CANDIDATE_LANES.map(lane => ({
    lane,
    clear: laneClearDistance(frame, lane, blockers, 7.5),
    reward: laneReward(frame, lane, rewards, 4.5),
  }));

  // 2. 筛选出安全净空充足（>= 1.4m）的候选车道
  const safe = candidates.filter(c => c.clear >= 1.4);

  if (safe.length > 0) {
    safe.sort((a, b) => {
      const rewDiff = b.reward - a.reward;
      if (Math.abs(rewDiff) > 6) return rewDiff;
      const aDist = Math.abs(a.lane - currentTarget);
      const bDist = Math.abs(b.lane - currentTarget);
      if (Math.abs(aDist - bDist) > 0.1) return aDist - bDist;
      return b.clear - a.clear;
    });

    const best = safe[0];
    return { lateral: best.lane, offset: best.lane - s0, clear: best.clear, lat: frame.lat };
  }

  // 3. 兜底：若均不足 1.4m，取净空距离最大的候选车道脱险
  candidates.sort((a, b) => b.clear - a.clear);
  const bestFallback = candidates[0];
  return { lateral: bestFallback.lane, offset: bestFallback.lane - s0, clear: bestFallback.clear, lat: frame.lat };
}

// 被卡住时的脱身方向：左右交替找一个近处确实空着、且不越过路宽的位置。
export function escapeOffset(frame, blockers, attempt = 0) {
  const { s0, limit } = axisState(frame);
  // 直接给「目标横向位置」而不是偏移：卡住往往是因为角色正贴在某条车道边缘，
  // 必须真的换到另一条车道（±0.7）才能绕开，±0.1 的微调没有意义。
  const order = [-0.7, 0.7, -0.4, 0.4, -0.2, 0.2, 0];
  const sides = attempt % 2 === 1 ? order.map(value => -value) : order;
  for (const candidate of sides) {
    const target = clamp(s0 + candidate, -limit + 0.03, limit - 0.03);
    const offset = target - s0;
    if (clearance(frame, blockers, offset, 1.4) > 1.4) return offset;
  }
  return clamp(s0 + sides[0], -limit + 0.03, limit - 0.03) - s0;
}
