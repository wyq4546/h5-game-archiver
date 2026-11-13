// 本游戏（Feed Pocket Monsters in Palworld!）的浏览器/桥接层。
//
// 已验证的原生契约（见 GAME_GUIDE.md）：
//  * 移动：按住屏幕前进（约 2.0 m/s），横向由「手指逐帧位移」驱动（LateralMovement.TryMove
//    (xPixelOffset)），约 0.00208 世界单位/像素，边界 x ∈ [4.72, 6.22]，三车道 4.87/5.47/6.07。
//    松开即停。注意：位移是打字机式的增量，因此绝不能只把手指「摆到目标位置」不动——
//    那样只有一帧 delta，玩家只会挪一点点。必须持续逐帧小步推进（本文件的 steerTo）。
//  * 只使用 CDP 真实触摸事件；桌面鼠标事件在本作移动端构建里不产生任何移动。
//  * 平台变量 TOKEN / KEY_COLLECTION 取自本归档 archive/session.har 的真实 FetchPlayerProjectConfig
//    响应，属离线平台适配（不改游戏资源、不改玩法状态）。
import path from 'node:path';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { recordingBrowserArgs, installGameAudioCapture } from './game-video-recorder.mjs';
import { prioritizeOwnedBrowser } from './browser-priority.mjs';
import { dumpSave } from './storage.mjs';

export const root = path.resolve(import.meta.dirname, '../..');

export const PLATFORM_VARIABLES = {
  KEY_COLLECTION: 'HITS3',
  TOKEN: 'd68f675fd765gfd65gf986gf9876fd',
};

export const LANES = [4.87, 5.47, 6.07];
export const CENTER_X = 5.47;
export const CENTER_PIXEL = 540;
// 实测：100 px 拖动 ≈ 0.208 世界单位。
export const UNITS_PER_PIXEL = 0.00208;
export const PIXELS_PER_UNIT = 1 / UNITS_PER_PIXEL;
// 下面这组是「直线关」的横向边界，只有第 1–6 关这类标准直道成立；
// 第 7 关起道路会 90° 折弯（实测 z 恒定、x 从 5.5 走到 -5.6 再继续），
// 因此运行期一律使用玩家自身坐标系（frame() 的 forward/right），不再依赖世界 x。
export const BORDER_MIN = 4.72;
export const BORDER_MAX = 6.22;
// 车道判定容差（世界单位）：玩家的横向半径约 0.2。
export const PLAYER_RADIUS = 0.22;

// 会挡住/加成的障碍类（Runner 程序集），名字取自 analysis/il2cpp/dump.cs 的真实类型。
export const OBSTACLE_TYPES = [
  'Wall', 'Gate', 'Saw', 'Spikes', 'Yula', 'Lava', 'SpikedPillar', 'Barrier',
  'SpikedPendulum', 'Pinwheel', 'RoadHole', 'Crystal', 'ButtonObstacle',
  'Transporter', 'Springboard', 'Boss',
  'EnemyActive', 'EnemyPassive', 'Hammer', 'SticksWithSpikes', 'PinwheelSpike',
];

// 真正会把玩家挡死的类型（其余都是「跑过去吃到」的奖励/门）。
// 注意 Transporter 是传送带：它不是障碍，而是**过坑的唯一手段**——第 6 关的 RoadHole
// 横跨整条路，必须踩上 z≈12.7 那段传送带被推过去。把它当阻挡物避让会直接掉进洞里。
export const BLOCKER_TYPES = new Set([
  'Wall', 'Saw', 'Spikes', 'Yula', 'Lava', 'SpikedPillar', 'Barrier',
  'SpikedPendulum', 'Pinwheel', 'RoadHole',
  'EnemyActive', 'EnemyPassive', 'Hammer', 'SticksWithSpikes', 'PinwheelSpike',
]);
// 奖励：食物加力量、水晶是收集物、门是左右各一个的加减力量。
export const REWARD_TYPES = new Set(['Food', 'Crystal', 'Gate']);

// 字段偏移来自 analysis/il2cpp/dump.cs（TypeDefIndex 见注释），运行时会先用上下文校验。
const OFFSETS = {
  Wall: { type: 0x10, strength: 0x14 },
  Gate: { type: 0x4C, strength: 0x50 },
  Saw: { strength: 0x4C },              // Saw : MovingObstacle，字段在基类之后
  Spikes: { strength: 0x10 },
  Yula: { strength: 0x10 },
  Lava: { strength: 0x10 },
  SpikedPillar: { strength: 0x10 },
  Barrier: { strength: 0x10 },
  SpikedPendulum: { strength: 0x10 },
  Pinwheel: { strength: 0x10 },
  Crystal: { number: 0x10 },
  ButtonObstacle: { type: 0x10, strength: 0x14 },
  Food: { strength: 0x10 },
  EnemyActive: { strength: 0x10 },
  EnemyPassive: {},
  Hammer: { strength: 0x10 },
  SticksWithSpikes: { strength: 0x10 },
  PinwheelSpike: { strength: 0x10 },
};

export async function gameUrl(replay) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'archive/manifest.json'), 'utf8'));
  const document = manifest.resources
    .filter(item => item.saved && item.type === 'document' && /app-296409\.games\.s3\.yandex\.net\/.*index\.html/.test(item.url))
    .sort((a, b) => b.url.length - a.url.length)[0];
  if (!document) throw Error('归档里没有游戏文档入口');
  const original = new URL(document.url);
  const direct = `${new URL(replay.url).origin}/__origin/${Buffer.from(original.origin).toString('base64url')}${original.pathname}${original.search}`;
  // 回放服务在根路径上带 SDK 查询串与 #origin 片段挂载真入口；该入口已验证可启动。
  return { entry: replay.url, direct, document: document.url };
}

async function sdkBundle() {
  const directory = path.join(root, 'game/gs.eponesh.com/sdk');
  const entries = await fs.readdir(directory).catch(() => []);
  const file = entries.find(name => /^gamepush.*\.js$/.test(name));
  if (!file) throw Error('归档里没有 GamePush SDK：' + directory);
  return fs.readFile(path.join(directory, file), 'utf8');
}

export async function openGame(replay, storageState, options = {}) {
  const defaultChromium = process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/home/ubuntu/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome';
  const headless = options.headless !== undefined
    ? Boolean(options.headless)
    : (process.env.GAME_HEADLESS !== undefined
        ? (process.env.GAME_HEADLESS === '1' || process.env.GAME_HEADLESS === 'true')
        : !process.env.DISPLAY);
  const browser = await chromium.launch({
    headless,
    executablePath: process.env.GAME_CHROMIUM_EXECUTABLE || defaultChromium,
    args: [...recordingBrowserArgs, ...(headless ? [] : ['--window-size=1080,1920'])],
  });
  // 录制时渲染器一旦抢不到 CPU，成片就会在运动段掉帧（成片验收会直接拒收）。
  // 只提升本浏览器自己的 renderer/GPU 进程，浏览器关闭即失效，不影响系统其余进程。
  const priority = await prioritizeOwnedBrowser(browser).catch(error => ({ applied: false, reason: error.message }));
  if (!priority.applied) console.warn(`[优先级] 未能提升渲染进程优先级：${priority.reason}`);
  try {
    return await attachGame(browser, replay, storageState, options);
  } catch (error) {
    await browser.close();
    throw error;
  }
}

export async function attachGame(browser, replay, storageState, options = {}) {
  const [bundle, yandexJs, configJson, playerJson] = await Promise.all([
    sdkBundle(),
    fs.readFile(path.join(root, 'game/gs.eponesh.com/sdk/platforms/platform.yandex.9eaa9272ddabec9af8fb.js'), 'utf8'),
    fs.readFile(path.join(root, 'game/api.eponesh.com/gs/api/graphql/12143-POST-94c286b41405.json'), 'utf8'),
    fs.readFile(path.join(root, 'game/api.eponesh.com/gs/api/graphql/12143-POST-111804d679e7.json'), 'utf8'),
  ]);
  const origin = new URL(replay.url).origin;
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    ...(storageState ? { storageState } : {}),
  });
  // 离线平台适配：SDK 从归档原样返回；平台读接口给空成功响应；其余外网一律阻断。
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin)) return route.continue();
    if (/gs\.eponesh\.com\/sdk\/gamepush.*\.js/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: bundle });
    }
    if (/gs\.eponesh\.com\/sdk\/platforms\/platform\.yandex.*\.js/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: yandexJs });
    }
    if (/graphql/.test(url)) {
      const postData = route.request().postData() || '';
      if (postData.includes('PlayerProjectConfig') || postData.includes('ProjectConfig') || postData.includes('fetchConfig')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: configJson });
      }
      if (postData.includes('connectPlayer') || postData.includes('Player') || postData.includes('sync')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: playerJson });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: configJson });
    }
    if (/eponesh\.com\//.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    }
    return route.abort();
  });
  await context.addInitScript(installGameAudioCapture);
  await context.addInitScript(() => {
    window.__GS_BOOT_CFG__ = { platformType: 'YANDEX' };
    window.YaGames = {
      init: () => Promise.resolve({
        adv: {
          showFullscreenAdv: ({ callbacks } = {}) => callbacks?.onClose?.(true),
          showRewardedVideo: ({ callbacks } = {}) => callbacks?.onClose?.(true)
        },
        auth: {
          openAuthDialog: () => Promise.resolve()
        },
        bonuses: {},
        environment: {
          app: { id: "296409" },
          i18n: { lang: "en", tld: "com" },
          payload: ""
        },
        features: {
          LoadingAPI: { ready: () => {} },
          GameplayAPI: { start: () => {}, stop: () => {} }
        },
        feedback: {
          canReview: () => Promise.resolve({ value: false, reason: "" }),
          requestReview: () => Promise.resolve({ value: false })
        },
        getFlags: () => Promise.resolve({}),
        getPayments: () => Promise.resolve({
          getCatalog: () => Promise.resolve([]),
          getPurchases: () => Promise.resolve([])
        }),
        getPlayer: () => Promise.resolve({
          getID: () => "0",
          getName: () => "",
          getPhoto: () => "",
          getData: () => Promise.resolve({}),
          setData: () => Promise.resolve(),
          getStats: () => Promise.resolve({}),
          setStats: () => Promise.resolve()
        }),
        getStorage: () => Promise.resolve({
          setItem: () => {},
          getItem: () => null,
          removeItem: () => {},
          clear: () => {}
        }),
        leaderboards: {
          getLeaderboardDescription: () => Promise.resolve({}),
          getLeaderboardPlayerEntry: () => Promise.resolve({}),
          getLeaderboardEntries: () => Promise.resolve({ entries: [] }),
          setLeaderboardScore: () => Promise.resolve()
        },
        on: () => {},
        shortcut: {
          canShowPrompt: () => Promise.resolve({ canShow: false }),
          showPrompt: () => Promise.resolve({ outcome: "rejected" })
        }
      })
    };
  });
  await context.addInitScript(variables => {
    // GamePush 的远端变量在离线时为空；本作 EccentricInit 会用 TOKEN 校验构建，
    // 这里补回本归档真实会话里平台下发的同名变量（不改游戏资源）。
    const install = () => {
      if (!window.onGPInit || window.onGPInit.__fpmWrapped) return;
      const original = window.onGPInit;
      window.onGPInit = async gp => {
        try {
          const api = gp.variables;
          const get = api.get.bind(api);
          const has = api.has.bind(api);
          api.get = name => {
            const real = get(name);
            return real === undefined || real === null || real === '' ? (variables[name] ?? real) : real;
          };
          api.has = name => has(name) || (name in variables);
        } catch (error) { console.warn('gamepush variables patch: ' + error.message); }
        return original(gp);
      };
      window.onGPInit.__fpmWrapped = true;
    };
    const timer = setInterval(() => { install(); if (window.onGPInit?.__fpmWrapped) clearInterval(timer); }, 1);
  }, PLATFORM_VARIABLES);

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => {
    const message = String(error?.message || '');
    // GamePush 在离线环境里拿不到远端 player 配置，这条 SDK 内部异常不影响原生玩法。
    if (/__typename/.test(message) || /canShowPrompt/.test(message) || /setItem/.test(message) || /status/.test(message)) return;
    errors.push(message);
  });
  const entry = await gameUrl(replay);
  await page.goto(entry.entry, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.unityInstance?.Module, null, { timeout: 180000 });

  const [base, supplemental] = await Promise.all([
    fs.readFile(path.join(root, 'analysis/bot/context.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(root, 'scripts/internal/bot-context.json'), 'utf8').then(JSON.parse),
  ]);
  const contextData = { types: [...base.types, ...supplemental.types], methods: [...base.methods, ...supplemental.methods] };
  const runtime = (await fs.readFile(path.join(root, 'analysis/bot/runtime.mjs'), 'utf8')).replace('export function attach', 'window.__attach = function attach');
  await page.addScriptTag({ content: runtime });
  await page.evaluate(([merged, obstacleTypes, offsets, blockerTypes, rewardTypes]) => {
    const bridge = window.__attach(window.unityInstance.Module, merged);
    const typeOf = name => bridge.invoke('System.Type$$GetType', bridge.managedString(name));
    // 注意：System.Type$$GetType 只认「不带命名空间的短名, 程序集名」，且引擎类型的短名本身
    // 就带 UnityEngine. 前缀（'UnityEngine.BoxCollider, UnityEngine.PhysicsModule'）。
    const findQualified = qualified => {
      let type = null;
      try { type = typeOf(qualified); } catch { return []; }
      return type ? bridge.arrayItems(bridge.invoke('UnityEngine.Object$$FindObjectsOfType', type, 1)) : [];
    };
    const find = (name, assembly = 'Runner') => findQualified(name + ', ' + assembly);
    const position = object => bridge.worldPosition(bridge.transformOf(object));
    const isActive = object => {
      try {
        const gameObject = bridge.invoke('UnityEngine.Component$$get_gameObject', object);
        return Boolean(bridge.invoke('UnityEngine.GameObject$$get_activeInHierarchy', gameObject));
      } catch { return false; }
    };
    let cachedPlayer = null;
    let cachedLatNode = null;
    const getActivePlayer = () => {
      if (cachedPlayer && isActive(cachedPlayer)) return cachedPlayer;
      cachedPlayer = find('Player').find(p => isActive(p)) || find('Player')[0] || null;
      cachedLatNode = null;
      return cachedPlayer;
    };
    const activePlayer = getActivePlayer;
    const round = (value, scale = 1000) => Math.round(value * scale) / scale;

    // 录制时用来做「原生运动证据」的廉价位姿读取：缓存 Player 指针，避免每帧重建类型查询。
    let poseCache = null;
    let poseMisses = 0;
    let cachedFinish = null;
    let cachedHandler = null;
    // 结算面板的 CanvasGroup 句柄，隐藏/恢复成对使用。
    let hiddenViews = [];
    const parentOfTransform = transform => {
      try { return bridge.invoke('UnityEngine.Transform$$get_parent', transform); } catch { return 0; }
    };

    const handlerOf = () => {
      if (cachedHandler && isActive(cachedHandler.trigger)) return cachedHandler;
      const trigger = find('PlayerTrigger')[0];
      if (!trigger) return null;
      const handler = bridge.readPointer(trigger + 16);
      cachedHandler = handler ? { trigger, handler, manager: bridge.readPointer(handler + 16) } : null;
      return cachedHandler;
    };

    window.__g = {
      bridge, find, position, isActive,
      ready: () => find('Player').length > 0 && find('Finish').length > 0,

      // 实时活跃巡逻怪位置探测（读取真实巡逻位移节点 _targetTransform）
      dynamicEnemies() {
        const list = [];
        for (const obj of find('EnemyActive')) {
          if (!isActive(obj)) continue;
          let transform = bridge.transformOf(obj);
          try {
            const mo = bridge.readPointer(obj + 0x18);
            if (mo) {
              const target = bridge.readPointer(mo + 0x20);
              if (target) transform = target;
            }
          } catch {}
          const pos = bridge.worldPosition(transform);
          list.push({ x: round(pos[0], 100), z: round(pos[2], 100) });
        }
        return list;
      },

      // 每帧都要读的轻量状态。
      state() {
        const player = getActivePlayer();
        if (!player) return null;
        const point = position(player);
        const manager = handlerOf()?.manager ?? 0;
        if (!cachedFinish || !isActive(cachedFinish)) cachedFinish = find('Finish')[0] || null;
        return {
          x: round(point[0]), y: round(point[1]), z: round(point[2]),
          strength: manager ? bridge.readInt(manager + 20) : null,
          level: manager ? bridge.readInt(manager + 16) : null,
          speed: manager ? round(bridge.readFloat(manager + 24), 100) : null,
          finish: cachedFinish ? round(position(cachedFinish)[2], 100) : null,
          time: round(bridge.invoke('UnityEngine.Time$$get_time'), 100),
        };
      },

      // 较重的整关扫描：食物 + 障碍（含碰撞体真实占位）。
      scan() {
        const player = activePlayer();
        if (!player) return null;
        const point = position(player);
        const foods = [];
        for (const food of find('Food')) {
          if (!isActive(food)) continue;
          const at = position(food);
          foods.push({ x: round(at[0], 100), z: round(at[2], 100), value: bridge.readInt(food + offsets.Food.strength) });
        }
        const obstacles = [];
        const byTransform = new Map();
        for (const name of obstacleTypes) {
          const spec = offsets[name] || {};
          for (const item of find(name)) {
            if (!isActive(item)) continue;
            const at = position(item);
            const entry = {
              name,
              x: round(at[0], 100),
              z: round(at[2], 100),
              type: spec.type === undefined ? null : bridge.readInt(item + spec.type),
              strength: spec.strength === undefined ? null : bridge.readInt(item + spec.strength),
              number: spec.number === undefined ? null : bridge.readInt(item + spec.number),
              z0: null, z1: null, halfX: null,
            };
            byTransform.set(bridge.transformOf(item), entry);
            obstacles.push(entry);
          }
        }
        // 本作的墙/锯等「触发器」是子物体上的碰撞体：轴心位置并不等于实际危险区
        // （例如 L1 的墙轴心 z=15.01，BoxCollider 覆盖 z 13.76–16.26）。这里沿父级链
        // 把碰撞体的 bounds 归到它的障碍根节点上。
        if (byTransform.size) {
          const parentOf = transform => {
            try { return bridge.invoke('UnityEngine.Transform$$get_parent', transform); } catch { return 0; }
          };
          for (const colliderType of ['UnityEngine.BoxCollider, UnityEngine.PhysicsModule', 'UnityEngine.CapsuleCollider, UnityEngine.PhysicsModule', 'UnityEngine.SphereCollider, UnityEngine.PhysicsModule']) {
          for (const collider of findQualified(colliderType)) {
            if (!isActive(collider)) continue;
            let transform = bridge.transformOf(collider);
            let owner = null;
            for (let depth = 0; depth < 6 && transform; depth += 1) {
              owner = byTransform.get(transform);
              if (owner) break;
              transform = parentOf(transform);
            }
            if (!owner) continue;
            let bounds;
            try { bounds = bridge.colliderBounds(collider); } catch { continue; }
            const [cx, , cz] = bounds.center;
            const [ex, , ez] = bounds.extents;
            owner.z0 = owner.z0 === null ? round(cz - ez, 100) : Math.min(owner.z0, round(cz - ez, 100));
            owner.z1 = owner.z1 === null ? round(cz + ez, 100) : Math.max(owner.z1, round(cz + ez, 100));
            owner.halfX = owner.halfX === null ? round(ex, 100) : Math.max(owner.halfX, round(ex, 100));
            owner.cx = round(cx, 100);
          }
          }
        }
        const finish = find('Finish')[0];
        // 奖励与真实阻碍分开：食物/水晶/正向门是「吃到就加」；负向门与墙/锯/刺等统统作为阻挡必须避让。
        const blockers = obstacles.filter(item => blockerTypes.includes(item.name) || (item.name === 'Gate' && (item.strength ?? 0) < 0))
          .map(item => {
            // 统一成世界 AABB：折弯关的道路是 90° 拐角，轴对齐包围盒在这里是精确的。
            const cx = item.cx ?? item.x;
            const halfX = item.halfX ?? 0.35;
            const cz = item.z0 != null && item.z1 != null ? (item.z0 + item.z1) / 2 : item.z;
            const halfZ = item.z1 != null && item.z0 != null ? (item.z1 - item.z0) / 2 : 0.35;
            const z0 = cz - halfZ;
            const z1 = cz + halfZ;
            return { name: item.name, x0: round(cx - halfX, 100), x1: round(cx + halfX, 100), z0: round(z0, 100), z1: round(z1, 100), x: item.x, z: item.z, strength: item.strength };
          });
        const rewards = obstacles.filter(item => rewardTypes.includes(item.name) && !(item.name === 'Gate' && (item.strength ?? 0) < 0))
          .map(item => ({
            kind: item.name,
            x: item.x,
            z: item.z,
            // 门按左右各自的实际宽度判定，其余用固定容差（在 planner 里处理）。
            halfX: item.halfX,
            value: item.name === 'Crystal' ? item.number : item.strength,
          }));
        for (const food of foods) rewards.push({ kind: 'Food', x: food.x, z: food.z, halfX: null, value: food.value });
        return {
          x: round(point[0], 100), z: round(point[2], 100),
          finish: finish ? round(position(finish)[2], 100) : null,
          finishX: finish ? round(position(finish)[0], 100) : null,
          foods: rewards.filter(item => Number.isFinite(item.value)).sort((a, b) => a.z - b.z),
          obstacles: blockers.sort((a, b) => a.z - b.z),
          // 传送带单独拿出来：它是「过坑的渡桥」，转向时要主动对齐它，而不是躲开。
          conveyors: obstacles.filter(item => item.name === 'Transporter' || item.name === 'Springboard')
            .map(item => ({
              name: item.name,
              x: round((item.cx ?? item.x), 100),
              z: round(item.z0 != null && item.z1 != null ? (item.z0 + item.z1) / 2 : item.z, 100)
            })),
          // 既不算奖励也不算阻挡的障碍类：用于发现「被静默丢掉」的机制（例如早期漏掉的传送带）。
          others: [...new Set(obstacles.filter(item => !blockerTypes.includes(item.name) && !rewardTypes.includes(item.name)).map(item => item.name))],
        };
      },

      ui() {
        const panels = {};
        for (const name of ['CompleteScreenView', 'TryAgainView', 'RouletteView', 'ChestsPopup']) {
          panels[name] = find(name).some(isActive);
        }
        return { panels, progress: 0 };
      },

      // 开场教学层：本作在「电影式入场」之后才挂出 HoldAndDrag 覆盖层，
      // 它吃掉按住事件，因此正式录制前必须先按原生手势把它关掉。
      tutorialUp() {
        try {
          const gameObject = bridge.invoke('UnityEngine.GameObject$$Find', bridge.managedString('HoldAndDrag'));
          if (gameObject && bridge.invoke('UnityEngine.GameObject$$get_activeInHierarchy', gameObject)) return true;
          const ui = find('UiInstaller');
          if (ui.length) {
            const upgradeScreen = bridge.readPointer(ui[0] + 0x34);
            if (upgradeScreen && bridge.invoke('UnityEngine.GameObject$$get_activeInHierarchy', upgradeScreen)) return true;
          }
          return Boolean(gameObject);
        } catch { return false; }
      },

      // 每帧必读的「玩家自身坐标系」：位置 + 水平前向 + 水平右向。
      // 第 7 关起道路会 90° 折弯，按住前进等于沿路走，因此感知/转向都必须用这个
      // 随路旋转的基，而不是世界 +z / 世界 x。
      frame() {
        const player = getActivePlayer();
        if (!player) return null;
        const transform = bridge.transformOf(player);
        const point = bridge.worldPosition(transform);
        let roadTransform = transform;
        let lat = null;
        try {
          if (cachedLatNode) {
            const local = bridge.structOut('UnityEngine.Transform$$get_localPosition_Injected', cachedLatNode, 3);
            lat = local[0];
            try { roadTransform = bridge.invoke('UnityEngine.Transform$$get_parent', cachedLatNode) || transform; } catch { roadTransform = transform; }
          } else {
            let node = transform;
            for (let depth = 0; depth < 5 && node; depth += 1) {
              const local = bridge.structOut('UnityEngine.Transform$$get_localPosition_Injected', node, 3);
              if (Math.abs(local[0]) > 0.76) break;
              lat = local[0];
              cachedLatNode = node;
              try { node = bridge.invoke('UnityEngine.Transform$$get_parent', node); } catch { node = 0; }
            }
            if (cachedLatNode) {
              try { roadTransform = bridge.invoke('UnityEngine.Transform$$get_parent', cachedLatNode) || transform; } catch { roadTransform = transform; }
            }
          }
        } catch { lat = null; cachedLatNode = null; }

        let q = [0, 0, 0, 1];
        try { q = bridge.structOut('UnityEngine.Transform$$get_rotation_Injected', roadTransform, 4); } catch {}
        const [qx, qy, qz, qw] = q;
        // 四元数旋转 (0,0,1) / (1,0,0)，只取水平分量。
        const fx = 2 * (qx * qz + qw * qy);
        const fz = 1 - 2 * (qx * qx + qy * qy);
        const rx = 1 - 2 * (qy * qy + qz * qz);
        const rz = 2 * (qx * qz - qw * qy);
        const flen = Math.hypot(fx, fz) || 1;
        const rlen = Math.hypot(rx, rz) || 1;
        return {
          x: point[0], z: point[2], lat,
          fx: fx / flen, fz: fz / flen,
          rx: rx / rlen, rz: rz / rlen,
        };
      },

      // 卡死现场诊断：dump 玩家附近所有活跃碰撞体（含父级链名字），
      // 用来找出没被 OBSTACLE_TYPES 覆盖的阻挡物（例如关卡里的传送带/障碍子物体）。
      nearby(range = 8) {
        const player = activePlayer();
        if (!player) return [];
        const at = bridge.worldPosition(bridge.transformOf(player));
        const rows = [];
        for (const type of ['UnityEngine.BoxCollider, UnityEngine.PhysicsModule', 'UnityEngine.CapsuleCollider, UnityEngine.PhysicsModule', 'UnityEngine.SphereCollider, UnityEngine.PhysicsModule', 'UnityEngine.MeshCollider, UnityEngine.PhysicsModule']) {
          const colliders = findQualified(type);
          for (const collider of colliders) {
            let bounds;
            try { bounds = bridge.colliderBounds(collider); } catch { continue; }
            const [cx, cy, cz] = bounds.center;
            const [ex, ey, ez] = bounds.extents;
            if (Math.abs(cz - at[2]) > range || Math.abs(cx - at[0]) > range + 2) continue;
            const chain = [];
            let transform = bridge.transformOf(collider);
            for (let depth = 0; depth < 5 && transform; depth += 1) {
              try {
                const go = bridge.invoke('UnityEngine.Component$$get_gameObject', transform);
                chain.push(bridge.readString(bridge.invoke('UnityEngine.Object$$get_name', go)) || '?');
              } catch { chain.push('!'); }
              try { transform = bridge.invoke('UnityEngine.Transform$$get_parent', transform); } catch { transform = 0; }
            }
            rows.push({
              chain: chain.join('<'),
              c: [round(cx, 100), round(cy, 100), round(cz, 100)],
              e: [round(ex, 100), round(ey, 100), round(ez, 100)],
            });
          }
        }
        return rows;
      },

      // 原生运动证据用的位姿：只在录制区间被逐帧调用，必须便宜。
      pose() {
        try {
          if (!poseCache || poseMisses > 2) { poseCache = activePlayer() || null; poseMisses = 0; }
          if (!poseCache) { poseMisses += 1; return null; }
          const point = position(poseCache);
          return [point[0], point[1], point[2]];
        } catch {
          poseCache = null;
          poseMisses += 1;
          return null;
        }
      },

      // 成片结尾要求屏蔽结算窗的绘制，但保留它的业务回调（点击仍要能推进到下一关）。
      // 本作没有用 CanvasGroup，因此按「CanvasRenderer.cull」停掉这些视图下所有网格的渲染：
      // cull 只跳过绘制，不改变组件、事件与 UI 射线命中，点选仍然有效。
      hideResults(names) {
        const roots = new Set();
        for (const name of names) {
          for (const view of find(name)) roots.add(bridge.transformOf(view));
        }
        if (!roots.size) return 0;
        hiddenViews = [];
        for (const canvasRenderer of findQualified('UnityEngine.CanvasRenderer, UnityEngine.UIModule')) {
          let transform = bridge.transformOf(canvasRenderer);
          let under = false;
          for (let depth = 0; depth < 8 && transform; depth += 1) {
            if (roots.has(transform)) { under = true; break; }
            transform = parentOfTransform(transform);
          }
          if (!under) continue;
          try {
            bridge.invoke('UnityEngine.CanvasRenderer$$set_cull', canvasRenderer, 1);
            hiddenViews.push(canvasRenderer);
          } catch {}
        }
        return hiddenViews.length;
      },

      showResults() {
        let restored = 0;
        for (const canvasRenderer of hiddenViews) {
          try { bridge.invoke('UnityEngine.CanvasRenderer$$set_cull', canvasRenderer, 0); restored += 1; } catch {}
        }
        hiddenViews = [];
        return restored;
      },
    };
  }, [contextData, OBSTACLE_TYPES, OFFSETS, [...BLOCKER_TYPES], [...REWARD_TYPES]]);

  await page.waitForFunction(() => window.__g?.ready(), null, { timeout: 120000 });

  let holding = false;
  let fingerPx = CENTER_PIXEL;
  const cdp = await context.newCDPSession(page);
  const clampPixel = value => Math.max(40, Math.min(1040, Math.round(value)));
  const send = async (type, pixelX) => {
    const x = clampPixel(pixelX);
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: 900, id: 1 }] });
  };
  const pixelFor = worldX => CENTER_PIXEL + (Math.max(BORDER_MIN, Math.min(BORDER_MAX, worldX)) - CENTER_X) * PIXELS_PER_UNIT;

  return {
    browser, context, page, cdp, errors,
    state: () => page.evaluate(() => window.__g.state()),
    scan: () => page.evaluate(() => window.__g.scan()),
    ui: () => page.evaluate(() => window.__g.ui()),
    pose: () => page.evaluate(() => window.__g.pose()),
    frame: () => page.evaluate(() => window.__g.frame()),
    dynamicEnemies: () => page.evaluate(() => window.__g.dynamicEnemies()),
    nearby: range => page.evaluate(value => window.__g.nearby(value), range),
    // 关卡进度快照（Unity IDBFS），用于断点续录与失败重开。
    save: () => dumpSave(page),
    tutorialUp: () => page.evaluate(() => window.__g.tutorialUp()),
    hideResults: names => page.evaluate(list => window.__g.hideResults(list), names),
    showResults: () => page.evaluate(() => window.__g.showResults()),
    tap: async (x, y) => page.touchscreen.tap(Math.round(x), Math.round(y)),
    // 手指始终从屏幕中线按下：横向只靠相对位移，绝对像素位置没有物理含义
    // （折弯关的玩家 x 会跑到 -5.6，绝对映射会直接把手指顶到边界）。
    holdStart: async () => {
      fingerPx = clampPixel(CENTER_PIXEL);
      await send('touchStart', fingerPx);
      holding = true;
      // 启动页面内 60 FPS requestAnimationFrame 高频顺滑触控插值驱动器：
      // 在 Unity 渲染同一线程内逐帧（16.6ms）平滑更新 touchmove，
      // 彻底消除由于 Node.js/CDP 慢速循环（15 Hz）带来的横向抽搐、停顿与台阶感。
      await page.evaluate((center) => {
        const canvas = document.querySelector('canvas');
        if (window.__touchSteer?.running) window.__touchSteer.running = false;
        window.__touchSteer = {
          currentPx: center,
          targetPx: center,
          running: true,
          lastTime: performance.now(),
          maxSpeed: 800, // 屏幕像素/秒（约 1.66 世界单位/秒，切道顺滑敏捷，兼顾拟人顺滑与极限避障）
        };

        function updateTouch(now) {
          if (!window.__touchSteer?.running) return;
          const dt = Math.min(0.05, Math.max(0.001, (now - window.__touchSteer.lastTime) / 1000));
          window.__touchSteer.lastTime = now;

          const ts = window.__touchSteer;
          const diff = ts.targetPx - ts.currentPx;
          if (Math.abs(diff) > 0.3) {
            // 平滑缓动加速与减速（Ease-in-Ease-out）
            const speed = Math.min(ts.maxSpeed, Math.max(50, Math.abs(diff) * 5.0));
            const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
            ts.currentPx += step;

            const px = Math.round(ts.currentPx);
            const touch = new Touch({
              identifier: 1,
              target: canvas,
              clientX: px,
              clientY: 900,
              pageX: px,
              pageY: 900,
            });
            canvas.dispatchEvent(new TouchEvent('touchmove', {
              cancelable: true,
              bubbles: true,
              touches: [touch],
              targetTouches: [touch],
              changedTouches: [touch],
            }));
          }
          requestAnimationFrame(updateTouch);
        }
        requestAnimationFrame(updateTouch);
      }, fingerPx);
    },
    // 逐帧增量推进手指：TryMove 消费的是「像素位移」
    async steerTo(worldX, stepPx = 85) {
      if (!holding) return 0;
      const target = pixelFor(worldX);
      fingerPx = clampPixel(target);
      await page.evaluate(px => {
        if (window.__touchSteer) window.__touchSteer.targetPx = px;
      }, fingerPx);
      return 0;
    },
    // 目标横向位置闭环伺服：把 targetLat（localPosition.x，[-0.75, +0.75]）映射到屏幕像素位置。
    // 在页面内部由 requestAnimationFrame 以原生 60 FPS 顺滑插值派发 touchmove，彻底消除蛇形抽搐与台阶感。
    async steerTarget(targetLat, stepPx = 18) {
      if (!holding) return 0;
      const targetPx = clampPixel(CENTER_PIXEL + targetLat * 480);
      fingerPx = targetPx;
      await page.evaluate(px => {
        if (window.__touchSteer) window.__touchSteer.targetPx = px;
      }, targetPx);
      return 0;
    },
    // 相对转向：把「往前向右侧还差多少世界单位」换算成一次手指位移。
    async steerOffset(worldOffset, stepPx = 46) {
      if (!holding) return 0;
      const deltaPx = worldOffset / UNITS_PER_PIXEL;
      fingerPx = clampPixel(fingerPx + deltaPx);
      await page.evaluate(px => {
        if (window.__touchSteer) window.__touchSteer.targetPx = px;
      }, fingerPx);
      return 0;
    },
    async nudge(deltaPx) {
      if (!holding) return;
      fingerPx = clampPixel(fingerPx + deltaPx);
      await page.evaluate(px => {
        if (window.__touchSteer) window.__touchSteer.targetPx = px;
      }, fingerPx);
    },
    release: async () => {
      if (holding) {
        await page.evaluate(() => {
          if (window.__touchSteer) window.__touchSteer.running = false;
        });
        await send('touchEnd', fingerPx);
        holding = false;
      }
    },
    // 入场镜头期间教学层还没挂出来；它出现后会吃掉按住事件。用真实点击按原生流程关掉它，
    // 这样「第一次按住」就是真正开始跑动的那一次，录像开头不会留下教学手势。
    async dismissIntro({ timeoutMs = 16000 } = {}) {
      const began = Date.now();
      while (Date.now() - began < timeoutMs) {
        if (await this.tutorialUp()) break;
        await page.waitForTimeout(180);
      }
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (!(await this.tutorialUp())) return true;
        await this.tap(CENTER_PIXEL, 960);
        await page.waitForTimeout(200);
        if (!(await this.tutorialUp())) return true;
        await page.evaluate(() => {
          const g = window.__g;
          const ui = g.find('UiInstaller');
          if (ui.length) {
            const startBtn = g.bridge.readPointer(ui[0] + 0x28);
            if (startBtn) {
              try { g.bridge.invoke('UnityEngine.UI.Button$$Press', startBtn); } catch {}
            }
          }
        });
        await page.waitForTimeout(300);
      }
      return !(await this.tutorialUp());
    },
    async startRun() {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const before = await this.state();
        await this.holdStart();
        if (await this.tutorialUp()) {
          await page.evaluate(() => {
            const g = window.__g;
            const ui = g.find('UiInstaller');
            if (ui.length) {
              const startBtn = g.bridge.readPointer(ui[0] + 0x28);
              if (startBtn) {
                try { g.bridge.invoke('UnityEngine.UI.Button$$Press', startBtn); } catch {}
              }
            }
          });
        }
        const deadline = Date.now() + 2500;
        while (Date.now() < deadline) {
          await page.waitForTimeout(150);
          const now = await this.state();
          if (now && before && Math.hypot(now.x - before.x, now.z - before.z) > 0.25) return true;
        }
        await this.release();
        await page.waitForTimeout(350);
      }
      return false;
    },
    get holding() { return holding; },
    get finger() { return fingerPx; },
  };
}
