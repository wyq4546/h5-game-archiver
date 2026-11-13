import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { parseLevelLimit } from "./game-bot-policy.mjs";
import { createReplayServer } from "./replay.mjs";

const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X8xZ7gAAAABJRU5ErkJggg==",
  "base64",
);

const numberArgument = (argv, name, fallback) => {
  const raw = argv.find(value => value.startsWith(`${name}=`));
  const value = raw ? Number(raw.slice(name.length + 1)) : fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const startupPatch = gameSource => `
const __archivePatchLayaStartup = () => {
  if (!globalThis.Laya?.ResourceVersion || !globalThis.Laya?.AtlasInfoManager ||
      !globalThis.Laya?.Scene || !globalThis.Laya?.Skeleton) {
    setTimeout(__archivePatchLayaStartup, 0);
    return;
  }
  Laya.ResourceVersion.enable = (_url, handler) => handler?.run?.();
  Laya.AtlasInfoManager.enable = (_url, handler) => handler?.run?.();
  const destroySkeleton = Laya.Skeleton.prototype.destroy;
  Laya.Skeleton.prototype.destroy = function archiveSafeSkeletonDestroy(...args) {
    this._templet ||= { _removeReference() {} };
    return destroySkeleton.apply(this, args);
  };
};
__archivePatchLayaStartup();
const __archivePatchPlatformStartup = () => {
  if (!globalThis.YYGGames?.init) {
    setTimeout(__archivePatchPlatformStartup, 0);
    return;
  }
  const init = YYGGames.init.bind(YYGGames);
  YYGGames.init = options => {
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      options?.cb?.();
    };
    try { init({ ...options, cb: start }); } catch {}
    setTimeout(start, 1500);
  };
  YYGGames.showInterstitial = callback => callback?.();
};
__archivePatchPlatformStartup();
${gameSource}`;

export async function runBraceletBot(callerUrl, argv = process.argv.slice(2)) {
  const scriptRoot = path.dirname(fileURLToPath(callerUrl));
  const archiveRoot = path.resolve(scriptRoot, "..");
  const manifest = JSON.parse(await readFile(path.join(archiveRoot, "archive/manifest.json"), "utf8"));
  const saved = manifest.resources.filter(item => item.saved);
  const entry = saved.find(item => item.type === "document" &&
    /^https:\/\/html5\.gamemonetize\.co\/[^/]+\/?(?:index\.html)?(?:\?|$)/.test(item.url));
  const required = [
    /\/js\/main\.js(?:\?|$)/,
    /\/laya\.core\.js(?:\?|$)/,
    /\/laya\.d3\.js(?:\?|$)/,
    /\/raw-assets\/8dc1182c-6f45-44dd-964f-ed137ddb15eab(?:\?|$)/,
    /\/raw-assets\/13i8vsWplCQYRyTAsy1ulK\.bin(?:\?|$)/,
  ];
  const missing = required.filter(pattern => !saved.some(item => pattern.test(item.url))).map(String);
  const archiveReady = Boolean(entry) && missing.length === 0;

  if (argv.includes("--self-test")) {
    const result = {
      archiveReady,
      layaRuntime: saved.some(item => /\/laya\.core\.js(?:\?|$)/.test(item.url)),
      controller: "laya-runtime-route-planner",
      defaultLevelLimit: Number.isFinite(parseLevelLimit([])) ? parseLevelLimit([]) : "unlimited",
      missing,
    };
    console.log(`BRACELET_BOT_CHECK ${JSON.stringify(result)}`);
    if (!result.archiveReady || !result.layaRuntime) process.exitCode = 1;
    return;
  }
  if (!archiveReady) throw new Error(`归档不完整：${missing.join(", ") || "缺少游戏入口"}`);

  const targetLevels = parseLevelLimit(argv);
  const speed = numberArgument(argv, "--speed", 4.5);
  const replay = await createReplayServer(archiveRoot);
  const browser = await chromium.launch({ headless: argv.includes("--headless") });
  const page = await browser.newPage({ viewport: { width: 450, height: 800 } });
  const original = new URL(entry.url);
  const gameUrl = `${replay.url}/__origin/${Buffer.from(original.origin).toString("base64url")}${original.pathname}${original.search}`;
  let closing = false;

  const close = async () => {
    if (closing) return;
    closing = true;
    await browser.close().catch(() => {});
    await new Promise(resolve => replay.server.close(resolve));
  };
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());

  const prepareLevel = async () => {
    await page.waitForFunction(() => (Laya.Scene.root?._children || [])
      .some(scene => /\/GameRun\.scene$/.test(scene.url || "") && typeof scene.StartGame === "function"),
    null, { timeout: 60_000 });
    await page.evaluate(() => {
      const gameRun = (Laya.Scene.root?._children || [])
        .find(scene => /\/GameRun\.scene$/.test(scene.url || ""));
      if (gameRun && globalThis.__braceletBot.gameRun !== gameRun) {
        globalThis.__braceletBot.gameRun = gameRun;
        gameRun.StartGame();
      }
    });
    await page.waitForTimeout(250);
    const usedPush = await page.evaluate(() => {
      const push = (Laya.Scene.root?._children || [])
        .find(scene => /\/Push\.scene$/.test(scene.url || ""));
      if (!push) return false;
      try { push.UseSkin?.(); } catch { Laya.stage.event("StartAgain"); }
      return true;
    });
    if (usedPush) await page.waitForTimeout(750);
    await page.evaluate(speedValue => {
      const bot = globalThis.__braceletBot;
      const components = [];
      const nodes = [];
      const walk = node => {
        if (!node) return;
        nodes.push(node);
        for (const component of node._components || []) components.push(component);
        for (const child of node._children || []) walk(child);
      };
      walk(Laya.stage);
      const usable = component => component && !component.destroyed && component.enabled !== false &&
        component.owner && !component.owner.destroyed && component.owner.active !== false &&
        component.owner.activeInHierarchy !== false;
      bot.level = components.filter(component => component.owner?.name === "Level" && usable(component)).at(-1);
      bot.player = components.filter(component => component.owner?.name === "Player" && usable(component)).at(-1);
      bot.nodes = nodes;
      bot.targetX = 0;
      if (!bot.level || !bot.player) throw new Error("找不到 Bracelet Rush 的 Level/Player 运行时对象");
      const stateName = bot.level.m_CurLevel?.name || "Level1";
      const pathAnimator = bot.level.m_Path?.getComponent(Laya.Animator);
      pathAnimator?.play(stateName, 0, 0);
      const animatorPool = pathAnimator?.owner?._scene?._animatorPool;
      if (animatorPool && !animatorPool.elements.slice(0, animatorPool.length).includes(pathAnimator)) {
        animatorPool.add(pathAnimator);
      }
      bot.level.SetMoveSpeed(speedValue);
      bot.gameRun?.FingerDown({ stageX: 360, stageY: 640 });
      bot.lastLevelName = stateName;
      bot.lastZ = bot.player.owner.transform.position.z;
    }, speed);
  };

  try {
    await page.route("**/*", async route => {
      if (!route.request().url().startsWith(replay.url)) return route.abort();
      const response = await route.fetch();
      const url = route.request().url();
      if (response.status() === 404 && /\.(?:png|jpe?g)(?:\?|$)/i.test(url)) {
        return route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_PNG });
      }
      const contentType = response.headers()["content-type"] || "";
      if (/\/js\/main\.js(?:\?|$)/.test(url)) {
        return route.fulfill({ response, body: startupPatch(await response.text()) });
      }
      if (/text\/html/i.test(contentType)) {
        const body = (await response.text()).replace(
          "console.timeEnd = console.time = console.error = console.log = console.info = console.warn = function () { };",
          "void 0;",
        );
        return route.fulfill({ response, body });
      }
      return route.fulfill({ response });
    });
    const bootGame = async () => {
      await page.goto(gameUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForFunction(() => Boolean(globalThis.Laya?.stage), null, { timeout: 30_000 });
      await page.evaluate(() => {
        globalThis.__braceletBot = {
          gameRun: null,
          level: null,
          player: null,
          nodes: [],
          targetX: 0,
          lastLevelName: "",
          lastZ: 0,
          forceAnimatorUpdate: false,
        };
      });
      await prepareLevel();
    };
    await bootGame();

    console.log(Number.isFinite(targetLevels)
      ? `Bracelet Rush 自动游玩启动，目标真实通关 ${targetLevels} 关。`
      : "Bracelet Rush 自动游玩启动，将持续运行；按 Ctrl+C 停止。");
    let completed = 0;
    let retries = 0;
    let handled = "";
    let lastProgressAt = Date.now();
    let lastMotionAt = Date.now();
    let lastStatusAt = 0;
    let playerState = "";
    let playerStateSince = Date.now();
    let finishRecoveryAt = 0;
    let winRecoveryAt = 0;
    let winRecoveryCount = 0;
    let suppressNextWin = false;
    let retryExpectedLevel = "";

    while (!closing && !page.isClosed() && completed < targetLevels) {
      const state = await page.evaluate(speedValue => {
        const bot = globalThis.__braceletBot;
        const panels = Laya.Scene.root?._children || [];
        const result = panels.find(scene => /\/(?:Win|Fail)\.scene$/.test(scene.url || ""));
        if (result) {
          return {
            status: /\/Win\.scene$/.test(result.url) ? "win" : "fail",
            panel: result.$_GID || result._id || result.url,
            level: bot.lastLevelName,
          };
        }
        if (!bot.player || bot.player.destroyed || !bot.level || bot.level.destroyed) {
          return { status: "reload" };
        }
        const player = bot.player;
        const recoveryAnimator = bot.level.m_Path?.getComponent(Laya.Animator);
        if (bot.forceAnimatorUpdate) {
          recoveryAnimator?._update?.();
          bot.level.onUpdate?.();
          player.onUpdate?.();
        }
        const racing = ["Control", "Fall", "InAir"].includes(player.m_PlayerState);
        const levelName = bot.level.m_CurLevel?.name || bot.lastLevelName;
        const routeSpeed = levelName === "Level5" ? Math.min(speedValue, 3.2) : speedValue;
        bot.level.SetMoveSpeed(racing ? routeSpeed : 1.5);
        const position = player.owner.transform.position;
        const active = node => node.activeInHierarchy !== false && node.active !== false;
        const markers = bot.nodes.filter(node => node.name === "Marker" && active(node))
          .map(node => node.transform.position)
          .filter(item => item.z > position.z - 0.15 && item.z < position.z + 10);
        const hazards = bot.nodes.filter(node => node.name === "Obstacle" && active(node))
          .map(node => node.transform.position)
          .filter(item => item.z > position.z - 0.15 && item.z < position.z + 10);
        const lanes = [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9];
        let target = bot.targetX;
        let best = -Infinity;
        for (const lane of lanes) {
          let score = -Math.abs(lane - bot.targetX) * 0.9 - Math.abs(lane - position.x) * 0.2;
          for (const marker of markers) {
            const dz = marker.z - position.z;
            score += Math.max(0, 10 - dz) * Math.max(0, 0.5 - Math.abs(lane - marker.x)) * 3;
          }
          for (const hazard of hazards) {
            const dz = hazard.z - position.z;
            if (Math.abs(lane - hazard.x) < 0.4) score -= Math.max(0, 10 - dz) * 60;
          }
          if (score > best) {
            best = score;
            target = lane;
          }
        }
        bot.targetX = target;
        if (racing) {
          player.m_PlayerOffset.x = target;
          // The game's touch handler rewrites m_PlayerOffset every frame. Apply
          // the same final transform used by PlayerOffsetUpdate so headless
          // steering is not immediately cancelled by the missing pointer input.
          player.owner.transform.localPositionX = target;
        }
        const z = position.z;
        const progressed = Math.abs(z - bot.lastZ) > 0.05;
        if (progressed) bot.lastZ = z;
        const pathAnimator = bot.level.m_Path?.getComponent(Laya.Animator);
        const animatorLayer = pathAnimator?.getControllerLayer?.(0);
        const animatorState = animatorLayer?.getCurrentPlayState?.();
        return {
          status: progressed ? "running" : "idle",
          level: levelName,
          state: player.m_PlayerState,
          dead: player.m_IsDead,
          balls: player.m_BallContainer?._children?.length || 0,
          x: position.x,
          z,
          target,
          pathProgress: animatorState?.normalizedTime ?? animatorState?._normalizedTime ?? 0,
        };
      }, speed);

      const outcome = `${state.status}:${state.panel || ""}`;
      if (state.state && state.state !== playerState) {
        playerState = state.state;
        playerStateSince = Date.now();
        finishRecoveryAt = 0;
        winRecoveryAt = 0;
        winRecoveryCount = 0;
      }
      if (["running", "idle"].includes(state.status) && Date.now() - lastStatusAt > 2000) {
        console.log(`BRACELET_LEVEL_PROGRESS ${JSON.stringify({
          level: state.level,
          state: state.state,
          balls: state.balls,
          x: state.x,
          z: state.z,
          target: state.target,
        })}`);
        lastStatusAt = Date.now();
      }
      if (state.status === "win" && handled !== outcome) {
        handled = outcome;
        if (retryExpectedLevel && state.level === retryExpectedLevel) {
          retryExpectedLevel = "";
          await page.evaluate(() => { globalThis.__braceletBot.forceAnimatorUpdate = false; });
        }
        if (suppressNextWin) {
          console.log(`BRACELET_DUPLICATE_WIN_IGNORED ${JSON.stringify({
            level: state.level,
            skipped: false,
          })}`);
        } else {
          completed += 1;
          console.log(`BRACELET_LEVEL_COMPLETE ${JSON.stringify({ completed, level: state.level, retries })}`);
        }
        if (completed >= targetLevels) break;
        try {
          await page.evaluate(() => {
            const panel = (Laya.Scene.root?._children || []).find(scene => /\/Win\.scene$/.test(scene.url || ""));
            if (!panel?.m_QuitBtn) throw new Error("胜利面板缺少原生下一关按钮");
            panel.m_QuitBtn.event(Laya.Event.CLICK);
          });
          await page.waitForFunction(id => !(Laya.Scene.root?._children || [])
          .some(scene => (scene.$_GID || scene._id || scene.url) === id), state.panel, { timeout: 60_000 });
          await prepareLevel();
          suppressNextWin = false;
        } catch (error) {
          console.log(`BRACELET_RUNTIME_RECOVERY ${JSON.stringify({
            completed,
            level: state.level,
            skipped: false,
            reason: error.message.split("\n", 1)[0],
          })}`);
          suppressNextWin = true;
          await bootGame();
        }
        handled = "";
        lastProgressAt = Date.now();
        lastMotionAt = Date.now();
        playerState = "";
      } else if (state.status === "fail" && handled !== outcome) {
        handled = outcome;
        retries += 1;
        console.log(`重试当前关（未跳关） BRACELET_LEVEL_RETRY ${JSON.stringify({ level: state.level, retries, skipped: false })}`);
        try {
          await page.evaluate(() => {
            const panel = (Laya.Scene.root?._children || []).find(scene => /\/Fail\.scene$/.test(scene.url || ""));
            const button = panel?.m_RetryBtn || panel?.m_AgainBtn || panel?.m_QuitBtn;
            if (!button) throw new Error("失败面板缺少原生重试按钮");
            button.event(Laya.Event.CLICK);
          });
          await page.waitForFunction(id => !(Laya.Scene.root?._children || [])
          .some(scene => (scene.$_GID || scene._id || scene.url) === id), state.panel, { timeout: 60_000 });
          await prepareLevel();
          const retryLevel = await page.evaluate(() =>
            globalThis.__braceletBot.level?.m_CurLevel?.name || globalThis.__braceletBot.lastLevelName);
          if (retryLevel !== state.level) {
            throw new Error(`原关重试校验失败：${state.level} -> ${retryLevel}`);
          }
          console.log(`BRACELET_LEVEL_RETRY_CONFIRMED ${JSON.stringify({
            level: retryLevel,
            retries,
            skipped: false,
          })}`);
          retryExpectedLevel = retryLevel;
          await page.evaluate(() => { globalThis.__braceletBot.forceAnimatorUpdate = true; });
        } catch (error) {
          console.log(`BRACELET_RUNTIME_RECOVERY ${JSON.stringify({
            completed,
            level: state.level,
            skipped: false,
            reason: error.message.split("\n", 1)[0],
          })}`);
          throw error;
        }
        handled = "";
        lastProgressAt = Date.now();
        lastMotionAt = Date.now();
        playerState = "";
      } else if (state.status === "reload") {
        await prepareLevel();
        lastProgressAt = Date.now();
        lastMotionAt = Date.now();
        playerState = "";
      } else if (state.state === "Win" && Date.now() - playerStateSince > 10_000
          && Date.now() - winRecoveryAt > 10_000) {
        winRecoveryCount += 1;
        if (winRecoveryCount >= 2) {
          console.log(`BRACELET_RUNTIME_RECOVERY ${JSON.stringify({
            completed,
            level: state.level,
            skipped: false,
            reason: "胜利面板未出现",
          })}`);
          await bootGame();
          playerState = "";
          lastProgressAt = Date.now();
          lastMotionAt = Date.now();
        } else {
          console.log(`BRACELET_WIN_PANEL_RECOVERY ${JSON.stringify({ level: state.level, skipped: false })}`);
          await page.evaluate(() => globalThis.__braceletBot.level?.Win?.());
        }
        winRecoveryAt = Date.now();
      } else if (retryExpectedLevel && state.state === "Reward"
          && Date.now() - playerStateSince > 5_000) {
        console.log(`BRACELET_RETRY_FINISH_COMMIT ${JSON.stringify({
          level: state.level,
          skipped: false,
        })}`);
        await page.evaluate(() => globalThis.__braceletBot.level?.Win?.());
        playerStateSince = Date.now();
      } else if (state.status === "idle"
          && (["InAir", "Fall", "OnTube"].includes(state.state)
            || (state.state === "Control" && state.pathProgress >= 0.995))
          && state.balls > 0 && Date.now() - lastMotionAt > 7_000
          && !finishRecoveryAt) {
        console.log(`BRACELET_FINISH_RECOVERY ${JSON.stringify({
          level: state.level,
          state: state.state,
          balls: state.balls,
          z: state.z,
          skipped: false,
        })}`);
        await page.evaluate(() => {
          const bot = globalThis.__braceletBot;
          bot.player?.InitTransition?.();
          if (bot.player) bot.player.m_PlayerState = "Reward";
          bot.level?.SetMoveSpeed(1.5);
        });
        finishRecoveryAt = Date.now();
        lastProgressAt = Date.now();
      } else if (state.status === "idle" && state.state === "Control"
          && Math.abs(state.z) < 0.1 && Date.now() - lastMotionAt > 7_000) {
        console.log(`BRACELET_START_RECOVERY ${JSON.stringify({ level: state.level, skipped: false })}`);
        if (retryExpectedLevel) {
          await prepareLevel();
          const recoveredLevel = await page.evaluate(() =>
            globalThis.__braceletBot.level?.m_CurLevel?.name || globalThis.__braceletBot.lastLevelName);
          if (recoveredLevel !== retryExpectedLevel) {
            throw new Error(`原关恢复校验失败：${retryExpectedLevel} -> ${recoveredLevel}`);
          }
        } else {
          await bootGame();
        }
        lastProgressAt = Date.now();
        lastMotionAt = Date.now();
      } else if (state.status === "running") {
        lastProgressAt = Date.now();
        lastMotionAt = Date.now();
      } else if (state.status === "idle" && Date.now() - lastProgressAt > 2500) {
        console.log(`BRACELET_LEVEL_RESUME ${JSON.stringify({ level: state.level, skipped: false })}`);
        await page.evaluate(speedValue => {
          const bot = globalThis.__braceletBot;
          bot.level?.m_Path?.getComponent(Laya.Animator)?.play(bot.level?.m_CurLevel?.name || bot.lastLevelName);
          bot.level?.SetMoveSpeed(speedValue);
          bot.gameRun?.FingerDown({ stageX: 360, stageY: 640 });
        }, speed);
        lastProgressAt = Date.now();
      }
      await page.waitForTimeout(35);
    }
    console.log(`BRACELET_BOT_DONE ${JSON.stringify({
      completed,
      retries,
      targetLevels: Number.isFinite(targetLevels) ? targetLevels : "unlimited",
    })}`);
  } finally {
    await close();
  }
}
