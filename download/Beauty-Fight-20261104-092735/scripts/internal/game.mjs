import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createReplayServer } from './lib/replay.mjs';
import { recordingBrowserArgs, installGameAudioCapture } from './lib/game-video-recorder.mjs';

if (process.platform === 'linux') {
  process.env.VK_ICD_FILENAMES = process.env.VK_ICD_FILENAMES || '/home/ubuntu/.config/vulkan/icd.d/nvidia_icd.json';
}

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
    this.currentTouchX = 320;
    this.touchY = 600;
  }

  async init() {
    this.replay = await createReplayServer(this.root);

    const linuxGpuArgs = process.platform === 'linux' ? [
      '--use-gl=angle',
      '--use-angle=vulkan',
      '--enable-features=Vulkan'
    ] : [];

    const launchOptions = {
      headless: !this.visible,
      handleSIGINT: false,
      args: [
        ...recordingBrowserArgs,
        ...linuxGpuArgs,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    };
    if (process.platform === 'win32') {
      const winChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
      if (fs.existsSync(winChrome)) launchOptions.executablePath = winChrome;
    }

    this.browser = await chromium.launch(launchOptions);

    this.context = await this.browser.newContext({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });

    if (this.record) {
      await this.context.addInitScript(installGameAudioCapture);
    }

    // Install Yandex SDK Mock & Game Hooks
    await this.context.addInitScript(() => {
      const fakeAdv = {
        showFullscreenAdv(opts) {
          if (opts?.callbacks?.onOpen) try { opts.callbacks.onOpen(); } catch (e) {}
          setTimeout(() => { if (opts?.callbacks?.onClose) try { opts.callbacks.onClose(true); } catch (e) {} }, 10);
        },
        showRewardedVideo(opts) {
          if (opts?.callbacks?.onOpen) try { opts.callbacks.onOpen(); } catch (e) {}
          setTimeout(() => {
            if (opts?.callbacks?.onRewarded) try { opts.callbacks.onRewarded(); } catch (e) {}
            if (opts?.callbacks?.onClose) try { opts.callbacks.onClose(true); } catch (e) {}
          }, 10);
        }
      };
      const fakePlayer = {
        getMode: () => 'lite', getName: () => 'Player', getPhoto: () => '', getUniqueID: () => '123',
        _personalInfo: { scopePermissions: { public_name: 'allow' } },
        setData: async () => {}, getData: async () => ({})
      };
      const fakeYsdk = {
        adv: fakeAdv,
        environment: { i18n: { lang: 'en', tld: 'com' }, app: { id: '239345' } },
        deviceInfo: { type: 'mobile', isMobile: () => true, isTablet: () => false, isDesktop: () => false, isTV: () => false },
        features: { LoadingAPI: { ready: () => {} }, GameplayAPI: { start: () => {}, stop: () => {} } },
        getStorage: async () => window.localStorage,
        getPlayer: async () => fakePlayer,
        feedback: { canReview: async () => ({ value: false }) }
      };
      window.YaGames = { init: async () => fakeYsdk };
      window.ysdk = fakeYsdk;

      window.__victoryState = { won: false, level: 0, time: 0 };
      window.__defeatState = { failed: false, time: 0 };
    });

    // Intercept external requests to ensure 100% offline fulfillment
    await this.context.route('**/*', async (route) => {
      const u = route.request().url();
      if (u.startsWith('http://127.0.0.1:')) return route.continue();
      try {
        const parsed = new URL(u);
        const target = new URL(parsed.pathname + parsed.search, this.replay.url).toString();
        const res = await fetch(target);
        const body = Buffer.from(await res.arrayBuffer());
        return route.fulfill({
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body
        });
      } catch (e) {
        return route.abort();
      }
    });

    this.page = await this.context.newPage();
    this.cdp = await this.context.newCDPSession(this.page);

    const gameUrl = this.replay.url + '?sdk=%2Fsdk%2F_%2Fv2.2f14a50521d68e9766e1.js#origin=https%3A%2F%2Fplayhop.com&app-id=239345&device-type=mobile';
    await this.page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
  }

  async waitForReady(timeoutMs = 30000) {
    await this.page.waitForFunction(() => {
      try {
        const cls = window.Laya?.ClassUtils?.getClass?.('sceneui/GameUI.ts');
        const inst = cls?.instance;
        const player = inst?.mArmy?.getRole?.(0, 0);
        return !!inst?.map_main && !!player && !inst.loading?.visible;
      } catch (e) {
        return false;
      }
    }, null, { timeout: timeoutMs });

    // Allow 600ms for initial LayaAir timer to settle into Wt (Ready) state
    await this.page.waitForTimeout(600);

    // Install Victory/Defeat hooks, suppress VictoryScene popup dialog & install 60 FPS smooth lateral steering loop
    await this.page.evaluate(() => {
      window.__victoryState = { won: false, level: 0, time: 0 };
      window.__defeatState = { failed: false, time: 0 };
      window.__targetX = 0;
      window.__curSmoothX = 0;
      window.__lateralSpeed = 6.8;

      if (!window.__gameHooksInstalled) {
        window.__gameHooksInstalled = true;

        const GameUI = Laya.ClassUtils.getClass('sceneui/GameUI.ts');
        if (GameUI?.prototype) {
          const origWin = GameUI.prototype.roleWinEvent;
          GameUI.prototype.roleWinEvent = function(e) {
            console.log('[HOOK] roleWinEvent triggered!', e);
            window.__victoryState = { won: true, level: window.f ? window.f.getGrade() : 1, time: Date.now() };
            if (origWin) origWin.apply(this, arguments);
          };

          const origFail = GameUI.prototype.roleFailtEvent;
          GameUI.prototype.roleFailtEvent = function() {
            console.log('[HOOK] roleFailtEvent triggered!');
            window.__defeatState = { failed: true, time: Date.now() };
            if (origFail) origFail.apply(this, arguments);
          };
        }

        // Suppress VictoryScene dialog popup to preserve clean victory dance
        const origLoad = Laya.Scene.load;
        Laya.Scene.load = function(url, complete, progress) {
          if (url && url.includes('VictoryScene')) {
            console.log('[HOOK] VictoryScene popup load suppressed!');
            return;
          }
          return origLoad.apply(this, arguments);
        };

        // Install 60 FPS smooth lateral movement loop to eliminate all flicker/teleporting
        Laya.timer.frameLoop(1, null, () => {
          if (!window.gameStart || window.gameOver) return;
          if (window.__victoryState?.won || window.__defeatState?.failed) return;

          const inst = Laya.ClassUtils.getClass('sceneui/GameUI.ts')?.instance;
          const player = inst?.mArmy?.getRole?.(0, 0);
          const ctrl = player?._components?.find(c => c.move_ctrl);
          if (!inst?.jsUI || !ctrl?.move_ctrl) return;

          const dt = Math.min(0.04, (Laya.timer.delta || 16.6) * 0.001);
          const diff = window.__targetX - window.__curSmoothX;
          const maxStep = window.__lateralSpeed * dt;
          if (Math.abs(diff) <= maxStep) {
            window.__curSmoothX = window.__targetX;
          } else {
            window.__curSmoothX += Math.sign(diff) * maxStep;
          }

          const anchorX = ctrl.move_ctrl.x ?? 0;
          const dx = (anchorX - window.__curSmoothX) * 640 / 6;
          inst.jsUI.event(Laya.Event.MOUSE_MOVE, { stageX: 320 + dx, stageY: 600 });
        });
      }
    });
  }

  async startRun() {
    this.currentTouchX = 320;
    this.touching = true;
    await this.page.evaluate(() => {
      window.gameStart = false;
      window.gameOver = false;
      window.showFree = false;

      const GameUI = Laya.ClassUtils.getClass('sceneui/GameUI.ts');
      const inst = GameUI?.instance;
      const player = inst?.mArmy?.getRole?.(0, 0);
      const curX = player?.transform?.position?.x ?? 0;
      window.__curSmoothX = curX;
      window.__targetX = curX;

      if (inst) {
        if (typeof inst.changeStart === 'function') {
          inst.changeStart();
        }
        if (inst.jsUI) {
          inst.jsUI.event(Laya.Event.MOUSE_DOWN, { stageX: 320, stageY: 600 });
        }
        if (typeof inst.roleGo === 'function') {
          inst.roleGo();
        }
      }
    });
  }

  async steerTo(targetX) {
    if (!this.touching) {
      await this.startRun();
    }
    await this.page.evaluate((tgt) => {
      window.__targetX = tgt;
    }, targetX);
  }

  async releaseTouch() {
    if (this.touching) {
      await this.page.evaluate(() => {
        window.__targetX = window.__curSmoothX;
        const GameUI = Laya.ClassUtils.getClass('sceneui/GameUI.ts');
        if (GameUI?.instance?.jsUI) {
          GameUI.instance.jsUI.event(Laya.Event.MOUSE_UP, { stageX: 320, stageY: 600 });
        }
      });
      this.touching = false;
    }
  }

  async getState() {
    return this.page.evaluate(() => {
      const GameUI = Laya.ClassUtils.getClass('sceneui/GameUI.ts');
      const inst = GameUI?.instance;
      const player = inst?.mArmy?.getRole?.(0, 0);
      if (!player) return null;

      const ctrl = player._components?.find(c => c.move_ctrl);
      const p = player.transform?.position;
      const heels = ctrl ? ctrl.heel_num : 0;
      const grade = window.f ? window.f.getGrade() : 1;
      const fsmState = ctrl?.mFSMLeg?.m_pCurrentState?.constructor?.name;

      // Scan obstacles within range
      const obsNode = inst.map_main?.getChildByName('Obstacles');
      const obstacles = [];
      if (obsNode) {
        for (let i = 0; i < obsNode.numChildren; i++) {
          const o = obsNode.getChildAt(i);
          const op = o.transform?.position;
          if (op && Math.abs(op.z - p.z) < 28) {
            obstacles.push({
              name: o.name,
              x: Number(op.x.toFixed(2)),
              y: Number(op.y.toFixed(2)),
              z: Number(op.z.toFixed(2))
            });
          }
        }
      }

      // Scan collectibles within range
      const collNode = inst.map_main?.getChildByName('Collectables');
      const collectibles = [];
      if (collNode) {
        for (let i = 0; i < collNode.numChildren; i++) {
          const c = collNode.getChildAt(i);
          const cp = c.transform?.position;
          if (cp && Math.abs(cp.z - p.z) < 30) {
            collectibles.push({
              name: c.name,
              x: Number(cp.x.toFixed(2)),
              y: Number(cp.y.toFixed(2)),
              z: Number(cp.z.toFixed(2))
            });
          }
        }
      }

      // Finish line Z
      let finishZ = 110;
      const segs = inst.map_main?.getChildByName('Segments');
      if (segs) {
        for (let i = 0; i < segs.numChildren; i++) {
          const s = segs.getChildAt(i);
          if (s.name && s.name.includes('Finish')) {
            finishZ = s.transform.position.z;
            break;
          }
        }
      }

      const isWin = window.__victoryState?.won ||
                    ['se', 'ae', 'ie'].includes(fsmState) ||
                    (p.z >= finishZ + 4 && Math.abs(ctrl?.move_ctrl?.speed_cur || 0) < 0.1);
      const isDead = window.__defeatState?.failed || fsmState === 'ne';

      return {
        pos: { x: p.x, y: p.y, z: p.z },
        heels,
        grade,
        fsmState,
        isWin,
        isDead,
        finishZ,
        obstacles,
        collectibles
      };
    });
  }

  async setLevel(level) {
    this.touching = false;
    await this.page.evaluate((lv) => {
      window.gameStart = false;
      window.gameOver = false;
      window.showFree = false;
      window.__targetX = 0;
      window.__curSmoothX = 0;
      window.__victoryState = { won: false, level: 0, time: 0 };
      window.__defeatState = { failed: false, time: 0 };
      if (window.f) window.f.setGrade(lv);
      const GameUI = Laya.ClassUtils.getClass('sceneui/GameUI.ts');
      if (GameUI?.instance) {
        GameUI.instance.isPlaying = false;
        GameUI.instance.reloadMapAuto();
      }
    }, level);
  }

  async advanceLevel() {
    this.touching = false;
    await this.page.evaluate(() => {
      window.gameStart = false;
      window.gameOver = false;
      window.showFree = false;
      window.__targetX = 0;
      window.__curSmoothX = 0;
      window.__victoryState = { won: false, level: 0, time: 0 };
      window.__defeatState = { failed: false, time: 0 };
      if (window.f) window.f.addGrade();
      const GameUI = Laya.ClassUtils.getClass('sceneui/GameUI.ts');
      if (GameUI?.instance) {
        GameUI.instance.isPlaying = false;
        GameUI.instance.reloadMapAuto();
      }
    });
  }

  async restartLevel() {
    this.touching = false;
    await this.page.evaluate(() => {
      window.gameStart = false;
      window.gameOver = false;
      window.showFree = false;
      window.__targetX = 0;
      window.__curSmoothX = 0;
      window.__victoryState = { won: false, level: 0, time: 0 };
      window.__defeatState = { failed: false, time: 0 };
      const GameUI = Laya.ClassUtils.getClass('sceneui/GameUI.ts');
      if (GameUI?.instance) {
        GameUI.instance.isPlaying = false;
        GameUI.instance.reloadMapAuto();
      }
    });
  }

  async close() {
    try { if (this.cdp) await this.cdp.detach(); } catch {}
    try { if (this.browser) await this.browser.close(); } catch {}
    try { if (this.replay) await this.replay.close(); } catch {}
  }
}
