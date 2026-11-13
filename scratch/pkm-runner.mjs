// 单关原生通关流程：扫描一次关卡静态布局 → 按住前进（逐帧局部横向伺服）→ 等结算面板。
// 全程只用真实触摸输入，不写任何玩法状态。
//
// 关键点：目标横向偏移是相对「玩家自身坐标系」的，不是世界 x。第 7 关起道路会 90° 折弯，
// 用世界坐标会在拐角把角色顶到护栏上（见 GAME_GUIDE.md「折弯关」一节）。
import { chooseLateral, escapeOffset, relative, worldAt } from './steer.mjs';

const TICK = 45;          // 决策间隔（毫秒）
const STEP_PX = 56;       // 单次触摸位移上限（≈0.117 世界单位，提升大幅度换道响应）
const SLOW_TICK = 200;    // 重读 UI / 力量的间隔

// 通关只有 CompleteScreenView；TryAgainView 是「死亡/失败重试」面板，
// 两者绝不能混为一谈（早期版本把死亡当通关，导致后续关卡其实是同一关反复重打）。
export const LEVEL_END_PANELS = ['CompleteScreenView'];
export const DEATH_PANELS = ['TryAgainView'];
export const RESULT_VIEWS = ['CompleteScreenView', 'TryAgainView', 'ChestsPopup', 'RouletteView'];

// 开局前的准备：扫一次整关静态布局（阻碍的世界 AABB + 奖励点）。
// 必须在正式录制 start 之前做完，这样重计算不会落进录制区间。
export async function prepareLevel(game, options = {}) {
  const log = options.log ?? (() => {});
  const scan = await game.scan();
  if (!scan) throw Error('场景里没有 Player，无法扫描关卡布局');
  scan.frame = await game.frame();
  const belts = scan.conveyors ?? [];
  const blockers = scan.obstacles.filter(item => Number.isFinite(item.x0));
  const positiveFoods = (scan.foods ?? []).filter(item => (item.value ?? 1) > 0);
  const negativeFoods = (scan.foods ?? []).filter(item => (item.value ?? 1) < 0);
  const rewards = positiveFoods.map(item => ({ x: item.x, z: item.z, value: item.value }));
  for (const neg of negativeFoods) {
    blockers.push({
      name: 'BadFood',
      x0: neg.x - 0.28,
      x1: neg.x + 0.28,
      z0: neg.z - 0.28,
      z1: neg.z + 0.28,
      x: neg.x,
      z: neg.z,
      value: neg.value,
    });
  }
  // 传送带不是奖励，但它是唯一能越过横跨整条路的 RoadHole 的手段（第 6 关实测）：
  // 混进转向锚点里，让角色在接近坑之前先对齐到传送带上。
  for (const belt of belts) rewards.push({ x: belt.x, z: belt.z, value: 50 });
  log(`关卡布局：起点 (${scan.x}, ${scan.z}) 终点 (${scan.finishX}, ${scan.finish})，奖励 ${rewards.length}，阻碍 ${blockers.length}`);
  const xs = [...rewards, ...blockers].map(item => (item.x0 !== undefined ? item.x0 : item.x)).filter(Number.isFinite);
  if (xs.length) log(`横向范围：玩家 x=${scan.x}，内容 x∈[${Math.min(...xs).toFixed(2)}, ${Math.max(...xs).toFixed(2)}]`);
  const histogram = new Map();
  for (const item of blockers) histogram.set(item.name, (histogram.get(item.name) || 0) + 1);
  log('阻碍分布 ' + ([...histogram].map(([key, count]) => key + '×' + count).join(' ') || '（无）'));
  if (scan.others?.length) log('未分类障碍（既非奖励也非阻挡）：' + scan.others.join(', '));
  if (belts.length) log('传送带（过坑渡桥）：' + JSON.stringify(belts));
  if (blockers.length) log('阻碍占位 ' + JSON.stringify(blockers.map(item => [item.name, item.x0, item.x1, item.z0, item.z1])));
  if (rewards.length) log('奖励占位 ' + JSON.stringify(rewards.map(item => [item.name, item.x, item.z, item.strength ?? item.value])));
  // 记录所有 RoadHole 位置，区分带传送带的和独木桥型的
  const allHoles = scan.obstacles.filter(item => item.name === 'RoadHole')
    .map(item => {
      const cx = (item.x0 + item.x1) / 2;
      const cz = (item.z0 + item.z1) / 2;
      const hasBelt = belts.some(belt => Math.hypot(belt.x - cx, belt.z - cz) < 4);
      return { x: cx, z: cz, hasBelt };
    });
  return { scan, blockers, rewards, allHoles, belts };
}

// 实际跑关：从第一次按住开始，一直跑到结算面板出现。
export async function playLevel(game, prepared, options = {}) {
  const log = options.log ?? (() => {});
  const { scan, blockers, rewards, allHoles = [], belts = [] } = prepared;
  const finishAt = { x: scan.finishX ?? scan.x, z: scan.finish ?? scan.z + 20 };
  const deadlineMs = options.deadlineMs ?? Math.max(90000, Math.round(30000 + Math.hypot(finishAt.x - scan.x, finishAt.z - scan.z) * 3000));
  const isLevel1 = options.level === 1 || (options.level === undefined && scan.finish > 22 && scan.finish < 25 && blockers.filter(b => b.name === 'Wall').length === 3);
  const isLevel2 = options.level === 2 || (options.level === undefined && blockers.some(b => b.name === 'Saw') && rewards.some(r => r.value === 20));
  const isEnemyLevel = options.level === 7 || (options.level === undefined && scan.finish > 24 && scan.finish < 27 && blockers.filter(b => b.name === 'EnemyActive').length >= 3);
  const hasDynamicEnemies = isEnemyLevel || blockers.some(item => item.name === 'EnemyActive');

  const started = await game.startRun();
  if (!started) throw Error('按住后玩家没有前进');
  log('开始跑动');

  const began = Date.now();
  let lastTrace = 0;
  let lastSlow = 0;
  // 进度按「离起点的平面距离」判定：折弯关的 z 会中途停滞甚至倒退，
  // 而 z 来回抖动的卡墙也会让「位移 > 0.3 就算前进」永远成立，因此必须用最远距离。
  let bestDist = 0;
  let lastProgress = Date.now();
  let stallCount = 0;
  let finished = false;
  let forceOffset = null;
  let forceUntil = 0;
  let state = null;
  let ui = null;
  let smoothTargetLat = null;
  // 朝向基：优先使用 Transform 沿路展开的真实方向（由 game.frame 提供），
  // 不受横向摇摆的位移瞬时量污染。
  let heading = { fx: scan.frame?.fx ?? 0, fz: scan.frame?.fz ?? 1 };
  let lastPos = { x: scan.x, z: scan.z };
  if (!Number.isFinite(heading.fx) || Math.hypot(heading.fx, heading.fz) < 0.5) heading = { fx: 0, fz: 1 };

  while (Date.now() - began < deadlineMs) {
    const frame = await game.frame();
    if (!frame) { await game.page.waitForTimeout(60); continue; }

    if (Number.isFinite(frame.fx) && Number.isFinite(frame.fz) && Math.hypot(frame.fx, frame.fz) > 0.5) {
      heading.fx = frame.fx;
      heading.fz = frame.fz;
    } else {
      const dx = frame.x - lastPos.x;
      const dz = frame.z - lastPos.z;
      const moved = Math.hypot(dx, dz);
      if (moved > 0.08) {
        const hx = heading.fx * 0.85 + (dx / moved) * 0.15;
        const hz = heading.fz * 0.85 + (dz / moved) * 0.15;
        const len = Math.hypot(hx, hz) || 1;
        heading = { fx: hx / len, fz: hz / len };
      }
    }
    lastPos = { x: frame.x, z: frame.z };
    // 感知用「朝向基 + 路内横向坐标」，两者都随路走。
    const view = {
      x: frame.x, z: frame.z, lat: frame.lat,
      fx: heading.fx, fz: heading.fz,
      rx: heading.fz, rz: -heading.fx,
    };

    let liveEnemies = [];
    if (hasDynamicEnemies) {
      liveEnemies = await game.dynamicEnemies().catch(() => []);
      for (const em of liveEnemies) {
        const b = blockers.find(item => item.name === 'EnemyActive' && Math.abs(item.z - em.z) < 2.0);
        if (b) {
          b.x = em.x;
          b.x0 = em.x - 0.28;
          b.x1 = em.x + 0.28;
          b.z = em.z;
          b.z0 = em.z - 0.35;
          b.z1 = em.z + 0.35;
        }
      }
    }

    if (Date.now() - lastSlow > SLOW_TICK) {
      lastSlow = Date.now();
      state = await game.state();
      ui = await game.ui();
      if (LEVEL_END_PANELS.some(name => ui.panels[name])) {
        log(`到达结算面板 x=${frame.x.toFixed(2)} z=${frame.z.toFixed(2)} 力量=${state?.strength}`);
        await game.release();
        return { ok: true, ended: 'panel', state, ui };
      }
      if (DEATH_PANELS.some(name => ui.panels[name])) {
        log(`角色死亡 x=${frame.x.toFixed(2)} z=${frame.z.toFixed(2)} 力量=${state?.strength}`);
        await game.release();
        return { ok: false, ended: 'died', state, ui };
      }
      if (Date.now() - lastTrace > 1000) {
        lastTrace = Date.now();
        log(`  轨迹 t=${((lastTrace - began) / 1000).toFixed(1)}s x=${frame.x.toFixed(2)} z=${frame.z.toFixed(2)} lat=${(frame.lat ?? NaN).toFixed(2)} f=(${heading.fx.toFixed(2)},${heading.fz.toFixed(2)}) 力量=${state?.strength}${finished ? ' 奖励区' : ''}`);
      }
    }

    const dist = Math.hypot(frame.x - scan.x, frame.z - scan.z);
    // 只把「离起点更远」当作推进：早先这里还写了一条 dist < bestDist - 1.0 也刷新计时器，
    // 结果角色被墙角顶住在原地来回弹（z 抖 ±2）时会被当成在动，卡住检测永远不触发。
    if (dist > bestDist + 0.25) {
      bestDist = dist;
      lastProgress = Date.now();
    }
    if (!finished && Math.hypot(frame.x - finishAt.x, frame.z - finishAt.z) < 2.4) {
      finished = true;
      log(`抵达终点附近 x=${frame.x.toFixed(2)} z=${frame.z.toFixed(2)} 力量=${state?.strength}，进入奖励区`);
    }

    // 卡住 = 被障碍或路边顶住（z 可能还在来回抖）。左右交替、在路宽内找空位脱身。
    if (!finished && Date.now() - lastProgress > 2500) {
      stallCount += 1;
      lastProgress = Date.now();
      // 贴墙卡死时最忌讳左右来回改主意：同一侧要连续坚持（第 7 关那条贴在路中心的
      // 长墙要 1.6 s 才能跑过去），因此每两次卡住才换一次方向，并且强制窗口放到 1.8 s。
      forceOffset = escapeOffset(view, blockers, Math.floor(stallCount / 2));
      forceUntil = Date.now() + 2500;
      log(`卡住 x=${frame.x.toFixed(2)} z=${frame.z.toFixed(2)} lat=${(frame.lat ?? NaN).toFixed(2)} 力量=${state?.strength} → 侧移 ${forceOffset.toFixed(2)}`);
      if (stallCount === 2) {
        const rows = await game.nearby(9).catch(() => []);
        log(`  现场碰撞体 ${rows.length} 个：`);
        for (const row of rows.slice(0, 24)) log('    ' + JSON.stringify(row));
      }
      if (stallCount > 4) {
        await game.release();
        return { ok: false, ended: 'stuck', state, ui: await game.ui() };
      }
    }

    // 坑区与独木桥检测：
    const nearbyBeamHole = allHoles.find(h => {
      if (h.hasBelt) return false;
      const rel = relative(view, h.x, h.z);
      return rel.f > -1.5 && rel.f < 5.0;
    });

    const onBeam = allHoles.some(h => {
      if (h.hasBelt) return false;
      const rel = relative(view, h.x, h.z);
      return rel.f >= -1.0 && rel.f <= 1.5;
    });

    const overBeltHole = allHoles.some(h => {
      if (!h.hasBelt) return false;
      const rel = relative(view, h.x, h.z);
      return rel.f >= -0.5 && rel.f <= 1.5;
    });

    // 如果前方有传送带/跳板，提前将目标锁定到传送带所在车道（避开绕路或避让墙体后误入死路）：
    const targetBelt = belts
      .map(b => ({ belt: b, rel: relative(view, b.x, b.z) }))
      .filter(item => item.rel.f > 0.1 && item.rel.f < 16.0)
      .sort((a, b) => a.rel.f - b.rel.f)[0]?.belt;

    const currentLat = Number.isFinite(view.lat) ? view.lat : 0;
    let targetLat = currentLat;
    let stepPx = 22;

    if (overBeltHole) {
      targetLat = currentLat;
      smoothTargetLat = currentLat;
      stepPx = 0; // 坑上飞跃时锁死触控，防止空中拐弯掉落
    } else if (onBeam) {
      targetLat = 0.0;
      smoothTargetLat = 0.0;
      stepPx = 10; // 独木桥上保持严格居中
    } else if (nearbyBeamHole) {
      // 即将进入独木桥：提前对准中道 0.0，平稳穿越两侧障碍/矮墙
      targetLat = 0.0;
      smoothTargetLat = 0.0;
      stepPx = 20;
    } else if (finished) {
      // 抵达终点奖励区：平滑居中滑向终点倍率门
      targetLat = 0.0;
      smoothTargetLat = 0.0;
      stepPx = 16;
    } else if (Date.now() < forceUntil) {
      if (onBeam || nearbyBeamHole) {
        targetLat = 0.0;
        smoothTargetLat = 0.0;
        stepPx = 10;
      } else {
        targetLat = Math.max(-0.68, Math.min(0.68, currentLat + forceOffset));
        smoothTargetLat = targetLat;
        stepPx = 24;
      }
    } else if (targetBelt) {
      const beltRel = relative(view, targetBelt.x, targetBelt.z);
      if (beltRel.f <= 2.8) {
        // 近距离：直接对准传送带
        targetLat = Math.max(-0.68, Math.min(0.68, currentLat + beltRel.r));
        stepPx = 22;
      } else {
        // 远距离：在前方 2.5 米处设立引导锚点，走传送带对应车道，同时避让途中障碍
        const pseudoPoint = worldAt(view, 2.5, beltRel.r);
        const beltReward = [{ x: pseudoPoint.x, z: pseudoPoint.z, value: 200 }];
        targetLat = chooseLateral(view, blockers, beltReward, { currentTarget: smoothTargetLat }).lateral;
        stepPx = 18;
      }
      smoothTargetLat = targetLat;
    } else if (isEnemyLevel) {
      // 第 7 关（画面 HUD 显示 Level 9）无伤避怪全吃倍率门黄金路线：
      if (view.z < 7.8) {
        // 1. 开局全程走左道：穿过 +95 蓝门 (z≈4.01) 与 +80 蓝门 (z≈7.61) (力量 245)
        targetLat = -0.55;
      } else if (view.z < 10.5) {
        // 2. 7.8m 切右道：避开左侧 1 号矮墙 (z=9.96~10.06)，吃右路肉腿
        targetLat = 0.55;
      } else if (view.z < 12.8) {
        // 3. 顺滑回中偏左：避开右侧 2 号矮墙 (z=12.36~12.46)，吃左路肉腿
        targetLat = -0.20;
      } else if (view.z < 17.3) {
        // 4. 2号墙过切右道并保持右道：穿过右侧 +100 蓝门 (z=14.81) 并无伤避开位于左侧的 3 号妖怪 (z=17.21, x≈4.98~5.15) (力量 357+)
        targetLat = 0.58;
      } else if (view.z < 24.5) {
        // 5. 17.3m 立即切左道：无伤避开位于右侧的 4 号妖怪 (z=19.01, x≈5.75) 与 5 号妖怪 (z=20.81, x≈5.75)，吃下左侧 +100 蓝门 (z=23.21)，避开右侧红门 (力量 457+)
        targetLat = -0.58;
      } else {
        // 6. 冲线倍率区：居中滑向终点倍率盘
        targetLat = 0.0;
      }

      // 动态避障防护：如果前方 1.5 米内有妖怪且与当前车道重叠，动态微调避让
      if (view.z < 22.0) {
        const aheadEnemy = liveEnemies.find(em => em.z > view.z && em.z < view.z + 1.5);
        if (aheadEnemy) {
          if (targetLat > 0.2 && aheadEnemy.x > 5.55) {
            targetLat = -0.55;
          } else if (targetLat < -0.2 && aheadEnemy.x < 5.40) {
            targetLat = 0.55;
          }
        }
      }

      smoothTargetLat = targetLat;
      stepPx = 24;
    } else if (isLevel1) {
      // 第 1 关全局极速吃肉高分顺滑路线（大回环连吃 20 根肉腿达 80 力量极限，零撞墙零误食毒物）：
      if (view.z < 7.0) {
        // 1. 中路直行：吃满开局 4 根肉腿 (z=4.0~5.8) -> 16 分
        targetLat = 0.0;
      } else if (view.z < 9.35) {
        // 2. 提前右漂：吃满右路 2 根肉腿 (z=8.81 & 9.41) -> 24 分
        targetLat = 0.48;
      } else if (view.z < 10.05) {
        // 3. 回中：吃中路肉腿 (z=10.01)，避让右侧 2 号矮墙 -> 28 分
        targetLat = 0.0;
      } else if (view.z < 11.25) {
        // 4. 左侧滑行：吃左路肉腿 (z=11.21) -> 32 分
        targetLat = -0.42;
      } else if (view.z < 12.42) {
        // 5. 回中：吃中路 2 根肉腿 (z=11.81 & 12.41) -> 40 分
        targetLat = 0.0;
      } else if (view.z < 16.5) {
        // 6. 12.42 提前切右道：避让 3 号长墙 (z=13.76~16.26) 与左侧毒物，连吃 4 根肉腿 (z=14.21~16.01) -> 56 分
        targetLat = 0.52;
      } else if (view.z < 18.80) {
        // 7. 3 号墙已过，微向中路靠拢至 lat=0.22（连吃 z=18.41 & 19.01 两根中路肉腿） -> 64 分
        targetLat = 0.22;
      } else if (view.z < 20.02) {
        // 8. 提前右拉到 lat=0.52：避开中路毒物 (z=19.61 & 20.21)，吃下右侧 2 根肉腿 -> 72 分
        targetLat = 0.52;
      } else {
        // 9. 20.02 提前顺滑回中：连吃中路 2 根肉腿 (z=20.81 & 21.41) 直冲终点 -> 80 力量极限高分通关！
        targetLat = 0.0;
      }
      smoothTargetLat = targetLat;
    } else if (isLevel2) {
      // 第 2 关双门全收极限高分顺滑路线（避开电锯 -> 穿 +20 门 -> 避让 -20 门 -> 穿 +10 门 -> 弯道连吃 5 根鸡腿 -> 尾段连吃 4 根鸡腿，斩获 136 力量极限！）：
      if (view.z < 5.2) {
        targetLat = 0.0;
      } else if (view.z < 7.2) {
        targetLat = 0.0;
      } else if (view.z < 8.8) {
        targetLat = 0.45;
      } else if (view.z < 11.2) {
        targetLat = -0.55;
      } else if (view.z < 15.5) {
        targetLat = 0.55;
      } else if (view.z < 21.0) {
        targetLat = -0.45;
      } else {
        targetLat = 0.0;
      }
      smoothTargetLat = targetLat;
      stepPx = 24;
    } else {
      const chosen = chooseLateral(view, blockers, rewards, { currentTarget: smoothTargetLat });
      smoothTargetLat = chosen.lateral;
      targetLat = smoothTargetLat;
      stepPx = 22;
    }

    await game.steerTarget(targetLat, stepPx);
    await game.page.waitForTimeout(TICK);
  }
  await game.release();
  return { ok: false, ended: 'timeout', state, ui: await game.ui() };
}

// 一关的完整原生流程（不录像时使用）。
export async function runLevel(game, options = {}) {
  const prepared = await prepareLevel(game, options);
  return { ...(await playLevel(game, prepared, options)), prepared };
}
