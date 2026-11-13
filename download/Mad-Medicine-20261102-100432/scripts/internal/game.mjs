import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createReplayServer } from '../../../../src/replay.mjs';
import { recordingBrowserArgs, installGameAudioCapture } from '../../../../src/game-video-recorder.mjs';
import { attach } from '../../analysis/bot/runtime.mjs';

export class GameDriver {
  constructor({ root, visible = false, record = false }) {
    this.root = path.resolve(root);
    this.visible = visible;
    this.record = record;
    this.replay = null;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.cdp = null;
    this.touching = false;
    this.currentTouchX = 540;
    this.touchY = 1500;
  }

  async init() {
    process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve('tools/.runtime/ms-playwright');

    const contextJson = JSON.parse(await readFile(path.join(this.root, 'analysis/bot/context.json'), 'utf8'));
    const scriptJson = JSON.parse(await readFile(path.join(this.root, 'analysis/il2cpp/script.json'), 'utf8'));

    // Enrich methods for Engine & UI
    const targetRegex = /^(UnityEngine\.(Component|Transform|GameObject|Object|RectTransform|Camera|Collider|CanvasGroup|Behaviour|Renderer)|UnityEngine\.UI\.(Button|Selectable|Image)|TMPro\.TMP_Text|Modules\.MadMedicine\.UI\.UnityComponents\.(StateTransitionButton|TTSButton|SprintButton))\$\$/;
    for (const item of scriptJson.ScriptMethod.filter(m => targetRegex.test(m.Name))) {
      if (item.TypeSignature && !contextJson.methods.some(m => m.name === item.Name)) {
        contextJson.methods.push({
          name: item.Name,
          table: item.Address,
          dynCall: item.TypeSignature
        });
      }
    }
    this.contextJson = contextJson;

    this.replay = await createReplayServer(this.root);
    this.browser = await chromium.launch({
      headless: !this.visible,
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      args: [...recordingBrowserArgs],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      // 指南 §7.4：真机 UA 必须命中移动端分支，不能让 SDK 把页面当桌面壳。
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    });

    // Install audio capture
    await this.context.addInitScript(installGameAudioCapture);

    // Install Yandex SDK Mock & Unity Hooks
    await this.context.addInitScript(() => {
      const fakeAdv = {
        showFullscreenAdv(opts) {
          if (opts?.callbacks?.onOpen) try { opts.callbacks.onOpen(); } catch (e) {}
          setTimeout(() => { if (opts?.callbacks?.onClose) try { opts.callbacks.onClose(true); } catch (e) {} }, 50);
        },
        showRewardedVideo(opts) {
          if (opts?.callbacks?.onOpen) try { opts.callbacks.onOpen(); } catch (e) {}
          setTimeout(() => {
            if (opts?.callbacks?.onRewarded) try { opts.callbacks.onRewarded(); } catch (e) {}
            if (opts?.callbacks?.onClose) try { opts.callbacks.onClose(true); } catch (e) {}
          }, 50);
        }
      };
      const fakePlayer = {
        getMode: () => 'lite', getName: () => 'Player', getPhoto: () => '', getUniqueID: () => '123',
        _personalInfo: { scopePermissions: { public_name: 'allow' } },
        setData: async () => {}, getData: async () => ({})
      };
      const fakeLeaderboard = {
        getLeaderboardDescription: async () => ({}), getLeaderboardPlayerEntry: async () => ({}),
        getLeaderboardEntries: async () => ({ entries: [] }), setLeaderboardScore: async () => {}
      };
      const fakePayments = { getPurchases: async () => [], getCatalog: async () => [] };
      const fakeYsdk = {
        adv: fakeAdv,
        environment: { i18n: { lang: 'ru', tld: 'ru' }, app: { id: '262540' } },
        deviceInfo: { type: 'mobile', isMobile: () => true, isTablet: () => false, isDesktop: () => false, isTV: () => false },
        features: { LoadingAPI: { ready: () => {} }, GameplayAPI: { start: () => {}, stop: () => {} } },
        getStorage: async () => window.localStorage,
        getPlayer: async () => fakePlayer,
        getLeaderboards: async () => fakeLeaderboard,
        getPayments: async () => fakePayments,
        feedback: { canReview: async () => ({ value: false }) }
      };
      window.YaGames = { init: async () => fakeYsdk };
      window.ysdk = fakeYsdk;

      const origAppend = Node.prototype.appendChild;
      Node.prototype.appendChild = function(node) {
        if (node && node.tagName === 'SCRIPT') {
          const origOnload = node.onload;
          if (origOnload) {
            node.onload = function(...args) {
              if (typeof window.createUnityInstance === 'function' && !window.createUnityInstance.__hooked) {
                const origCUI = window.createUnityInstance;
                window.createUnityInstance = function(...cuiArgs) {
                  return origCUI.apply(this, cuiArgs).then(inst => {
                    window.unityInstance = inst;
                    return inst;
                  });
                };
                window.createUnityInstance.__hooked = true;
              }
              return origOnload.apply(this, args);
            };
          }
        }
        return origAppend.apply(this, arguments);
      };
      for (const key of ['instantiate', 'instantiateStreaming']) {
        const native = WebAssembly[key];
        WebAssembly[key] = async function(...args) {
          const result = await native.apply(this, args);
          for (const value of Object.values((result.instance || result).exports)) {
            if (value instanceof WebAssembly.Table) globalThis.__runnerTable = value;
          }
          return result;
        };
      }
    });

    this.page = await this.context.newPage();
    await this.page.goto(this.replay.url);
    await this.page.waitForFunction(() => window.unityInstance?.Module?.HEAPU8 && globalThis.__runnerTable, null, { timeout: 30000 });

    await this.page.evaluate(({ source, contextJson }) => {
      const m = window.unityInstance.Module;
      m.wasmTable = globalThis.__runnerTable;
      globalThis.__bridge = (0, eval)('(' + source + ')')(m, contextJson);
    }, { source: attach.toString(), contextJson: this.contextJson });

    // Wait for engine initial scene load
    await this.page.waitForTimeout(6000);
    this.cdp = await this.context.newCDPSession(this.page);
  }

  async getPlayerState() {
    return this.page.evaluate(() => {
      const b = globalThis.__bridge;
      const m = window.unityInstance.Module;
      const stack = m.stackSave();
      const vecPtr = m.stackAlloc(16);
      const colliders = b.findObjects('Modules.MadMedicine.UnityComponents.ViewComponents.PlayerColliderViewComponent', 'Assembly-CSharp');
      let pos = null;
      for (const col of colliders) {
        const go = b.gameObjectOf(col);
        if (b.activeInHierarchy(go)) {
          const trans = b.invoke('UnityEngine.Component$$get_transform', col);
          b.invoke('UnityEngine.Transform$$get_position_Injected', trans, vecPtr);
          const wx = Math.round(m.HEAPF32[vecPtr >> 2] * 100) / 100;
          const wy = Math.round(m.HEAPF32[(vecPtr + 4) >> 2] * 100) / 100;
          const wz = Math.round(m.HEAPF32[(vecPtr + 8) >> 2] * 100) / 100;
          b.invoke('UnityEngine.Transform$$get_localPosition_Injected', trans, vecPtr);
          const localX = Math.round(m.HEAPF32[vecPtr >> 2] * 100) / 100;
          pos = [wx, wy, wz, localX];
          break;
        }
      }
      m.stackRestore(stack);
      return pos;
    });
  }

  async getTrackEntities() {
    return this.page.evaluate(() => {
      const b = globalThis.__bridge;
      const m = window.unityInstance.Module;
      const stack = m.stackSave();
      const vecPtr = m.stackAlloc(16);

      function getPos(obj) {
        const tr = b.invoke('UnityEngine.Component$$get_transform', obj);
        b.invoke('UnityEngine.Transform$$get_position_Injected', tr, vecPtr);
        return [
          Math.round(m.HEAPF32[vecPtr >> 2] * 100) / 100,
          Math.round(m.HEAPF32[(vecPtr + 4) >> 2] * 100) / 100,
          Math.round(m.HEAPF32[(vecPtr + 8) >> 2] * 100) / 100
        ];
      }

      function getName(obj) {
        const go = b.gameObjectOf(obj);
        const strPtr = b.invoke('UnityEngine.Object$$get_name', go);
        return b.readString(strPtr);
      }

      const hazards = [];
      for (const cls of ['CarViewComponent', 'BarrierViewComponent', 'ObstacleViewComponent', 'BanditViewComponent']) {
        const objs = b.findObjects('Modules.MadMedicine.UnityComponents.ViewComponents.' + cls, 'Assembly-CSharp');
        for (const o of objs) hazards.push(getPos(o));
      }

      const items = [];
      for (const cls of ['NurseViewComponent', 'DiamondViewComponent']) {
        const objs = b.findObjects('Modules.MadMedicine.UnityComponents.ViewComponents.' + cls, 'Assembly-CSharp');
        for (const o of objs) items.push(getPos(o));
      }

      // MoneyViewComponent: split Adder vs Subtractor
      const moneyObjs = b.findObjects('Modules.MadMedicine.UnityComponents.ViewComponents.MoneyViewComponent', 'Assembly-CSharp');
      for (const o of moneyObjs) {
        const name = getName(o);
        const p = getPos(o);
        if (name && name.toLowerCase().includes('subtractor')) {
          hazards.push(p);
        } else {
          items.push(p);
        }
      }

      m.stackRestore(stack);
      return { hazards, items };
    });
  }

  async getSprintButtonActive() {
    return this.page.evaluate(() => {
      const b = globalThis.__bridge;
      const sbs = b.findObjects('Modules.MadMedicine.UI.UnityComponents.SprintButton', 'Assembly-CSharp');
      for (const btn of sbs) {
        const go = b.gameObjectOf(btn);
        if (b.activeInHierarchy(go)) return true;
      }
      return false;
    });
  }

  // 只读结局探测：Gameplay(Clone) 内的 WIN / LOOSE / 名次文本 + SprintButton 激活状态。
  // 关卡会 90° 转弯（第 2 关世界 z 冻结在 65、世界 x 一路到 -136），所以不能只靠 z 判断进度。
  async getOutcome() {
    return this.page.evaluate(() => {
      const b = globalThis.__bridge;
      const out = { win: false, loose: false, failedText: false, place: null, sprint: false, texts: [] };
      for (const t of b.findObjects('TMPro.TMP_Text', 'Unity.TextMeshPro', 1)) {
        const go = b.gameObjectOf(t);
        if (!b.activeInHierarchy(go)) continue;
        let txt = '';
        try { txt = b.readString(b.invoke('TMPro.TMP_Text$$get_text', t)); } catch (e) { continue; }
        if (!txt) continue;
        out.texts.push(txt);
        if (/^WIN$/i.test(txt)) out.win = true;
        if (/^LOOSE$/i.test(txt) || /проиграл/i.test(txt) || /Повторить/i.test(txt)) out.failedText = true;
        if (/^(1st|1-й|1)$/i.test(txt)) out.place = txt;
      }
      for (const s of b.findObjects('Modules.MadMedicine.UI.UnityComponents.SprintButton', 'Assembly-CSharp', 1)) {
        if (b.activeInHierarchy(b.gameObjectOf(s))) { out.sprint = true; break; }
      }
      return out;
    });
  }

  async getUIState() {
    return this.page.evaluate(() => {
      const b = globalThis.__bridge;

      const tts = b.findObjects('Modules.MadMedicine.UI.UnityComponents.TTSButton', 'Assembly-CSharp');
      let ttsActive = false;
      for (const btn of tts) {
        const go = b.gameObjectOf(btn);
        if (b.activeInHierarchy(go)) { ttsActive = true; break; }
      }

      const tmps = b.findObjects('TMPro.TMP_Text', 'Unity.TextMeshPro');
      const texts = [];
      for (const t of tmps) {
        const go = b.gameObjectOf(t);
        if (b.activeInHierarchy(go)) {
          const strPtr = b.invoke('TMPro.TMP_Text$$get_text', t);
          const txt = b.readString(strPtr);
          if (txt) texts.push(txt);
        }
      }

      let currentLevel = 1;
      for (const txt of texts) {
        const m = txt.match(/Уровень\s*(\d+)/i) || txt.match(/Level\s*(\d+)/i);
        if (m) {
          currentLevel = parseInt(m[1], 10);
          break;
        }
      }

      const hasNextButton = texts.includes('Дальше') || texts.includes('Next');
      const isLoading = texts.some(t => t.toLowerCase().includes('загрузка') || t.toLowerCase().includes('loading'));

      return { ttsActive, currentLevel, texts, hasNextButton, isLoading };
    });
  }

  async tapStart() {
    await this.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 540, y: 960, id: 0 }]
    });
    await this.page.waitForTimeout(100);
    await this.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
  }

  // 目标车道 → 绝对触点 X；但每帧最多移动 maxStepPx 像素，逐帧小步逼近。
  // 实测教训：一次 touchMove 直接跳到目标 X 会让角色在一个渲染帧内横移 1.8 个
  // 世界单位（第 3 关 z=64.7 从车道 0 瞬移到 -1.8，撞进刚擦过的墙触发失败）。
  // PointerDisplacementSystem 读的是帧间指针位移，分步发送才是平滑的原生滑动。
  async steerToLane(lateralOrX, maxStepPx = 20) {
    const desiredX = Math.abs(lateralOrX) <= 10
      ? Math.round(540 + lateralOrX * 115)
      : Math.round(lateralOrX);
    const clampedX = Math.max(120, Math.min(960, desiredX));

    if (!this.touching) {
      this.currentTouchX = 540;
      await this.cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 540, y: this.touchY, id: 0 }]
      });
      this.touching = true;
      await this.page.waitForTimeout(10);
    }

    const diff = clampedX - this.currentTouchX;
    if (Math.abs(diff) < 1) return;
    const step = Math.max(-maxStepPx, Math.min(maxStepPx, diff));
    this.currentTouchX = Math.round(this.currentTouchX + step);
    await this.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: this.currentTouchX, y: this.touchY, id: 0 }]
    });
  }

  async steerTo(targetX, playerX) {
    if (!this.touching) {
      this.currentTouchX = 540 + playerX * 100;
      await this.cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: this.currentTouchX, y: this.touchY, id: 0 }]
      });
      this.touching = true;
    }

    const err = targetX - playerX;
    const delta = Math.max(-45, Math.min(45, err * 70));
    this.currentTouchX = Math.max(100, Math.min(980, this.currentTouchX + delta));

    await this.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: this.currentTouchX, y: this.touchY, id: 0 }]
    });
  }

  async releaseTouch() {
    if (this.touching) {
      await this.cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
      this.touching = false;
    }
  }

  async tapSprint() {
    await this.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 540, y: 1095, id: 0 }]
    });
    await this.page.waitForTimeout(20);
    await this.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
    await this.page.waitForTimeout(20);
  }

  async tapNextLevel() {
    await this.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 541, y: 1247, id: 0 }]
    });
    await this.page.waitForTimeout(100);
    await this.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
  }

  // 起跑前等待主画面稳定两帧（全局指南 §6.1 第 3 步）。
  async waitFrames(count = 2) {
    return this.page.evaluate(n => new Promise(resolve => {
      const step = () => (--n <= 0 ? resolve(true) : requestAnimationFrame(step));
      requestAnimationFrame(step);
    }), count);
  }

  // ── 画面纯净度：逐帧隐藏「只影响渲染」的 UI（全局指南 §3 / §7.3） ──────────────
  //
  // 实测对象（只读探针枚举 CanvasGroup / Image / TMP_Text 得到）：
  //   TTS(Clone)                      起跑层，含 FingerPanel（手指 + 「проведите…」）
  //   CrossPromoSidePanelScreen(Clone) 左侧「Все игры」圆钮 + 右侧激励视频广告钮
  //   RoundCompleted(Clone)           通关后 200ms 由 DOTween 淡入的紫色结算窗
  //   FinishSprintPanel               冲刺段 Fade / Finger / TapToRunText（巨大「Жми」手指）
  //   RankUpButton                    右侧「улучшение здоровья」常驻广告按钮
  //
  // 关键：`RoundCompleted(Clone)` 的 alpha 会被 DOTween 每帧改回 1，一次性 set_alpha(0)
  // 无效，必须逐帧压制；新对象/切关后指针会变，每 20 帧重解析一次。
  // 只改 CanvasGroup.alpha 与 Graphic.enabled，不改 activeInHierarchy / Button / 业务回调，
  // 因此「ДАЛЬШЕ」「Sprint」「TTS」等原生点击照常生效。
  async installVisualSuppression() {
    return this.page.evaluate(() => {
      if (globalThis.__visualSuppress) return { started: false, already: true };
      const b = globalThis.__bridge;

      const HIDE_GROUPS = new Set([
        'RoundCompleted(Clone)',   // 胜利结算「Ты выйграл!」
        'RoundFailed(Clone)',      // 失败结算「Ты проиграл!」
        'CrossPromoSidePanelScreen(Clone)',
        'LoadingCanvas',
      ]);
      const hideGraphic = (name, parent) =>
        parent === 'FingerPanel' ||
        (parent === 'FinishSprintPanel' && ['Finger', 'TapToRunText', 'Fade'].includes(name)) ||
        parent === 'RankUpButton' || name === 'RankUpButton';

      const nameOf = obj => {
        try { return b.readString(b.invoke('UnityEngine.Object$$get_name', b.gameObjectOf(obj))); }
        catch (e) { return ''; }
      };
      const parentOf = obj => {
        try {
          const tr = b.invoke('UnityEngine.Component$$get_transform', obj);
          const par = b.invoke('UnityEngine.Transform$$get_parent', tr);
          if (!par) return '';
          const pgo = b.invoke('UnityEngine.Component$$get_gameObject', par);
          return b.readString(b.invoke('UnityEngine.Object$$get_name', pgo));
        } catch (e) { return ''; }
      };

      let groups = [], graphics = [];
      let frames = 0, lastScan = -99, presses = 0, disables = 0, stopped = false;

      const apply = () => {
        for (const cg of groups) {
          try {
            if (b.invoke('UnityEngine.CanvasGroup$$get_alpha', cg) > 0.001) {
              b.invoke('UnityEngine.CanvasGroup$$set_alpha', cg, 0.0);
              presses += 1;
            }
          } catch (e) {}
        }
        for (const g of graphics) {
          try { b.invoke('UnityEngine.Behaviour$$set_enabled', g, 0); disables += 1; }
          catch (e) {}
        }
      };
      const scan = () => {
        groups = [];
        for (const cg of b.findObjects('UnityEngine.CanvasGroup', 'UnityEngine.UIModule', 1)) {
          if (HIDE_GROUPS.has(nameOf(cg))) groups.push(cg);
        }
        graphics = [];
        for (const [cls, asm] of [['UnityEngine.UI.Image', 'UnityEngine.UI'], ['TMPro.TMP_Text', 'Unity.TextMeshPro']]) {
          for (const o of b.findObjects(cls, asm, 1)) {
            if (hideGraphic(nameOf(o), parentOf(o))) graphics.push(o);
          }
        }
        apply();
      };
      const tick = () => {
        if (stopped) return;
        frames += 1;
        try { if (frames - lastScan >= 20) { lastScan = frames; scan(); } else apply(); }
        catch (e) { groups = []; graphics = []; }
        requestAnimationFrame(tick);
      };
      scan();
      requestAnimationFrame(tick);
      globalThis.__visualSuppress = {
        stop: () => { stopped = true; },
        stats: () => ({ frames, presses, disables, groups: groups.length, graphics: graphics.length }),
      };
      return { started: true, groups: groups.length, graphics: graphics.length };
    });
  }

  async visualSuppressionStats() {
    return this.page.evaluate(() => globalThis.__visualSuppress?.stats?.() ?? null);
  }

  async stopVisualSuppression() {
    return this.page.evaluate(() => {
      const stats = globalThis.__visualSuppress?.stats?.() ?? null;
      globalThis.__visualSuppress?.stop?.();
      delete globalThis.__visualSuppress;
      return stats;
    });
  }

  // 兼容旧探针命名
  async suppressSettlementUI() { return this.installVisualSuppression(); }
  async restoreSettlementUI() { return this.stopVisualSuppression(); }

  // ── 铁律 5：Unity WebGL Shader / 动态材质全量预渲染 ────────────────────────────
  // Unity 在 Mesh 首次进入相机视锥时才 compileShader/linkProgram，首次出现的道具会造成
  // 单帧长停顿。这里在 recorder.prepare() 之后、recorder.start() 之前，把主相机
  // fieldOfView / farClipPlane 临时放宽若干帧，强制整条赛道一次性提交 GPU；
  // 游戏相机脚本每帧会 lerp 回目标值，所以预热期间每帧重设，结束后原位恢复。
  // 只改渲染视锥，不碰玩家坐标、体型、速度、健康值或关卡进度；预热帧落在 trimHead 内。
  async warmupRendering(frames = 24) {
    return this.page.evaluate(async n => {
      const b = globalThis.__bridge;
      const raf = () => new Promise(resolve => requestAnimationFrame(resolve));
      let cams = [];
      for (const asm of ['UnityEngine.CoreModule', 'UnityEngine']) {
        cams = b.findObjects('UnityEngine.Camera', asm, 1);
        if (cams.length) break;
      }
      const saved = [];
      for (const c of cams) {
        try {
          saved.push({
            c,
            far: b.invoke('UnityEngine.Camera$$get_farClipPlane', c),
            fov: b.invoke('UnityEngine.Camera$$get_fieldOfView', c),
          });
        } catch (e) {}
      }
      for (let i = 0; i < n; i++) {
        for (const s of saved) {
          try {
            b.invoke('UnityEngine.Camera$$set_farClipPlane', s.c, 3000.0);
            b.invoke('UnityEngine.Camera$$set_fieldOfView', s.c, 175.0);
          } catch (e) {}
        }
        await raf();
      }
      for (const s of saved) {
        try {
          b.invoke('UnityEngine.Camera$$set_farClipPlane', s.c, s.far);
          b.invoke('UnityEngine.Camera$$set_fieldOfView', s.c, s.fov);
        } catch (e) {}
      }
      for (let i = 0; i < 4; i++) await raf();
      return { cameras: saved.length, frames: n, restored: true, before: saved.map(s => ({ far: s.far, fov: s.fov })) };
    }, frames);
  }

  async close() {
    if (this.browser) await this.browser.close();
    if (this.replay?.server) {
      this.replay.server.closeAllConnections?.();
      await new Promise(r => this.replay.server.close(r));
    }
  }
}
