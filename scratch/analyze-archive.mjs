/* 对已归档目录跑一遍完整源码解析（等同后台「开始解析」按钮）
 *
 *   node scratch/analyze-archive.mjs "download/GoGy-Rocking-Sky-Trip-20261104-162647"
 *
 * 产物全在 <归档目录>/analysis/：unity-data 解包、wasm/wat、il2cpp/dump.cs 等。
 */
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { analyzeCapturedGame, inspectCapturedRuntime } from "../src/source-analysis.mjs";
import { assessCompleteness } from "../src/capture.mjs";

const target = process.argv[2];
if (!target) {
  console.error("用法: node scratch/analyze-archive.mjs <归档目录>");
  process.exit(1);
}
const root = path.resolve(target);
const manifestPath = path.join(root, "archive", "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const t0 = Date.now();
const stamp = () => `[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s]`;
console.log(`${stamp()} 目标: ${root}`);
console.log(`${stamp()} 引擎: ${manifest.runtimeInspection?.engine || "(未知)"}`);

const report = await analyzeCapturedGame(root, manifest, (e) => {
  console.log(`${stamp()} ${e.message}`);
});

console.log(`${stamp()} 解析完成，回写 manifest 运行时信息…`);
try {
  manifest.runtimeInspection = await inspectCapturedRuntime(root, manifest);
  manifest.completeness = assessCompleteness(manifest);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
} catch (error) {
  console.log(`${stamp()} 回写失败（不影响解析产物）: ${error.message}`);
}

console.log(`\n===== 摘要 =====`);
console.log(`引擎          ${report.engine}（${report.engineConfidence}）`);
console.log(`文本源码      ${report.counts.textSources}（游戏相关 ${report.counts.gameTextSources}，噪声 ${report.counts.ignoredNoiseSources}）`);
console.log(`WASM          ${report.counts.wasmModules} 个，WAT ${report.counts.watGenerated}`);
console.log(`Unity 解包    ${report.counts.unityDataPackages} 个包 / ${report.counts.unityDataExtractedFiles} 个文件`);
console.log(`IL2CPP        ${report.il2cpp?.status}${report.il2cpp?.gameplayClasses ? `，业务类 ${report.il2cpp.gameplayClasses}` : ""}`);
if (report.il2cpp?.reason) console.log(`  reason      ${report.il2cpp.reason}`);
if (report.il2cpp?.dump) console.log(`  dump.cs     ${report.il2cpp.dump}`);
console.log(`BotKit        ${report.botKit?.status || "?"}`);
console.log(`耗时          ${((Date.now() - t0) / 1000).toFixed(1)}s`);
