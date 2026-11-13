// 纯原生避障策略：按当前赛道朝向把世界坐标投影成「车道 x / 前方距离」，
// 对每个候选车道做危险硬约束 + 收集物软收益。
//
// 实测教训（第 3 关，用 stuck-L3.json 的 26 个危险物 / 48 个收集物离线复算）：
//   ① 原版危险系数 25000 被收集物累计收益压过，角色一路停在最左车道，
//      撞上 (-2, 0, 33.97) 的砖墙触发原生「ТЫ ПРОИГРАЛ!」；
//   ② 把半径放大到 2.4 同样失败：x=±2 的两排墙使中线（距两侧各 2.0）
//      也被判危险，所有车道都带罚分，策略只能在「最不坏」里选 -0.6，仍撞墙。
//   ③ z≈69.7 的捕熊夹：x=0 在 z=70.54 / 72.58 各有 1 只，x=±2 在
//      z=78.6~80.8 各有一排。正确走位是「中线过 z=61.9/64.0 左墙 → z=64
//      切左道躲中线夹子 → z=74 回中线过两侧夹子」的 S 形。旧实现把身后
//      危险物也套用 `dist = Math.max(0.8, ahead)`，分母被压到 0.8，身后左墙
//      对左车道产生 5~8 万罚分，反而压过前方 5.8 万的夹子，策略直到 z=69.7
//      才改道，撞夹子时 localX 只到 -0.36（死亡瞬间中间值，不是横移不足）。
//   ④ 已用 probe-steer2 标定输入：steerToLane(-1.8) 精确落到 localX=-1.84
//      并稳定，steerToLane(0) 可回中；PointerDisplacementSystem$$Run 反编译
//      确认写入的是 (mouseX / Screen.width) 的帧间差。所以横移幅度没有问题。
// 现在按「近场硬约束 / 远场软提示 / 身后降级」三层加权：14 单位内的危险物
// 用 400000，14~40 单位只给 24000（到时还能再变道），身后的降到 0.35 倍且
// 用 abs(ahead)+8 做距离垫，避免把刚擦过的墙误判成「贴脸危险」。
//
// 赛道会 90° 转弯（第 2 关世界 z 冻结在 65、世界 x 一路到 -136）；转弯后
// role.transform.localPosition.x 不再是横向坐标而是沿轨距离，此时投影出的
// dLat 全部超出候选车道，策略自然退化成「不额外转向」，由游戏自身沿样条前进。
export class TrackStrategy {
  constructor() {
    this.candidateLanes = [-2.2, -1.8, -1.4, -1.0, -0.6, 0.0, 0.6, 1.0, 1.4, 1.8, 2.2];
    this.lastTrackPos = null;
    this.heading = { x: 0, z: 1 };
    this.right = { x: 1, z: 0 };
  }

  reset() {
    this.lastTrackPos = null;
    this.heading = { x: 0, z: 1 };
    this.right = { x: 1, z: 0 };
  }

  evaluate(playerPos, hazards = [], items = []) {
    if (!playerPos) return { phase: 'WAIT' };

    const px = playerPos[0];
    const py = playerPos[1];
    const pz = playerPos[2];
    const playerRoadLat = playerPos[3] ?? 0;

    // 轨道中脊（世界坐标），与横向转向解耦。
    const trackX = px - playerRoadLat * this.right.x;
    const trackZ = pz - playerRoadLat * this.right.z;
    if (this.lastTrackPos) {
      const dx = trackX - this.lastTrackPos[0];
      const dz = trackZ - this.lastTrackPos[1];
      const len = Math.hypot(dx, dz);
      if (len > 0.08) {
        this.heading = { x: dx / len, z: dz / len };
        this.right = { x: this.heading.z, z: -this.heading.x };
      }
    }
    this.lastTrackPos = [trackX, trackZ];

    const fx = this.heading.x;
    const fz = this.heading.z;
    const rx = this.right.x;
    const rz = this.right.z;

    const HAZARD_RADIUS = 1.8;
    const HAZARD_NEAR = 14.0;      // 约 2 秒内会撞上，硬约束
    const HAZARD_LOOKAHEAD = 40.0; // 更远只作软提示，届时还能再变道
    const HAZARD_WEIGHT = 400000;
    const HAZARD_FAR_WEIGHT = 24000;
    const HAZARD_BEHIND_WEIGHT = 0.35;
    const HAZARD_BEHIND_PAD = 8.0;
    const ITEM_RADIUS = 1.1;
    const ITEM_WEIGHT = 220;

    let bestLateral = 0;
    let minCost = Infinity;
    let bestDanger = -Infinity;

    for (const candLat of this.candidateLanes) {
      // 轻微偏好中线，避免无危险时也贴边。
      let cost = Math.abs(candLat) * 0.6;
      let nearestDanger = Infinity;

      for (const h of hazards) {
        const vx = h[0] - px;
        const vz = h[2] - pz;
        const ahead = vx * fx + vz * fz;
        // 刚擦身而过（最多 6 个单位）的危险物仍计入：它们的碰撞体向后延伸，
        // 若此刻横移进该车道会立刻撞墙（第 3 关 z≈64.7 的实测失败）。但不能
        // 把身后距离压成 0.8，否则会压过前方真正会撞上的夹子。
        if (ahead <= -6.0 || ahead >= HAZARD_LOOKAHEAD) continue;
        const behind = ahead < 0;
        const weight = behind ? HAZARD_WEIGHT * HAZARD_BEHIND_WEIGHT
          : ahead < HAZARD_NEAR ? HAZARD_WEIGHT : HAZARD_FAR_WEIGHT;
        const dist = behind
          ? Math.abs(ahead) + HAZARD_BEHIND_PAD
          : Math.max(0.8, ahead);
        const relLat = vx * rx + vz * rz;
        const hRoadLat = playerRoadLat + relLat;
        const dLat = Math.abs(hRoadLat - candLat);
        if (dLat < HAZARD_RADIUS) {
          const severity = (HAZARD_RADIUS - dLat) / HAZARD_RADIUS;
          cost += weight * severity / (dist + 1.2);
          if (!behind) nearestDanger = Math.min(nearestDanger, dist);
        }
      }

      for (const it of items) {
        const vx = it[0] - px;
        const vz = it[2] - pz;
        const ahead = vx * fx + vz * fz;
        if (ahead <= 0.2 || ahead >= 22.0) continue;
        const relLat = vx * rx + vz * rz;
        const itRoadLat = playerRoadLat + relLat;
        const dLat = Math.abs(itRoadLat - candLat);
        if (dLat < ITEM_RADIUS) cost -= ITEM_WEIGHT / (ahead + 0.5);
      }

      // 同代价时优先「最晚才遇到危险」的车道，给横移留出更多时间。
      if (cost < minCost - 1e-6 || (Math.abs(cost - minCost) <= 1e-6 && nearestDanger > bestDanger)) {
        minCost = cost;
        bestLateral = candLat;
        bestDanger = nearestDanger;
      }
    }

    return { phase: 'RUN', targetLateral: bestLateral, px, py, pz, cost: minCost };
  }
}
