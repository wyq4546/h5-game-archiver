#!/usr/bin/env node
// 还原 PlayCanvas 发布产物：切分 __game-scripts.js、建立 createScript 注册表、解压场景实体树。
// 用法：node scripts/analyze-playcanvas.mjs download/<游戏归档目录>
import path from "node:path";
import { readFile } from "node:fs/promises";
import { inspectCapturedRuntime } from "../src/source-analysis.mjs";
import { writePlayCanvasAnalysis } from "../src/playcanvas-analysis.mjs";

const argument = process.argv[2];
if (!argument) {
  console.error("用法：node scripts/analyze-playcanvas.mjs download/<游戏归档目录>");
  process.exitCode = 1;
} else {
  const root = path.resolve(argument);
  const manifest = JSON.parse(await readFile(path.join(root, "archive", "manifest.json"), "utf8"));
  const inspection = await inspectCapturedRuntime(root, manifest);
  if (inspection.engine !== "PlayCanvas") throw new Error(`该归档识别为 ${inspection.engine}，不是 PlayCanvas。`);
  const summary = await writePlayCanvasAnalysis(root, event => {
    if (event.type === "playcanvas") {
      console.log(`脚本块 ${event.scriptBlocks} 个，注册脚本 ${event.scripts} 个，辅助文件 ${event.helperFiles} 个`);
      console.log(`场景 ${event.scenes} 个，实体 ${event.entities} 个，未被场景引用的脚本 ${event.unusedScripts} 个`);
      console.log(`产物：${event.output}`);
    }
  });
  if (summary.status !== "ok") process.exitCode = 2;
}
