#!/usr/bin/env node
import { captureGame, assessCompleteness } from "./capture.mjs";
import { inspectCapturedRuntime } from "./source-analysis.mjs";
import { replayArchive } from "./replay.mjs";
import { parseArgs } from "./utils.mjs";
import { verifyArchive } from "./verify.mjs";

import { completeArchiveAssets } from "./asset-completer.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const HELP = `
H5 Game Archiver (authorized content only)

Usage:
  h5-game-archiver capture --url <game-url> --acknowledge-rights [options]
  h5-game-archiver replay --archive <capture-directory> [--port 8080]
  h5-game-archiver verify --archive <capture-directory> [--duration 5]
  h5-game-archiver complete --archive <capture-directory>

Options:
  --output <directory>  Output root (default: ./output)
  --duration <seconds>  Capture time after initial load (default: 45)
  --headless            Run without a visible Chromium window
  --archive <directory> Existing capture directory for replay/verification
  --port <number>       Replay server port (default: automatically selected)
  --acknowledge-rights  Confirm you are authorized to archive the target
  -h, --help            Show help
`;

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (options.command === "capture") {
    if (!options.url) throw new Error("--url is required");
    if (!options.acknowledgeRights) {
      throw new Error("Pass --acknowledge-rights only after confirming you may archive this content.");
    }
    if (!Number.isFinite(options.duration) || options.duration < 5 || options.duration > 3600) {
      throw new Error("--duration must be between 5 and 3600 seconds");
    }
    const result = await captureGame(options);
    console.log(`Capture saved to: ${result.captureRoot}`);
    console.log(`Saved resources: ${result.manifest.resources.filter(item => item.saved).length}`);
    console.log(`Failed requests: ${result.manifest.failures.length}`);
  } else {
    if (!options.archive) throw new Error("--archive is required");
    if (options.command === "complete") {
      const manifestPath = path.join(options.archive, "archive", "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      const stats = await completeArchiveAssets(options.archive, manifest);
      manifest.runtimeInspection = await inspectCapturedRuntime(options.archive, manifest);
      manifest.completeness = assessCompleteness(manifest);
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      if (manifest.completeness.status !== "core-complete" || stats.failedAssets || stats.scanFailures.length || stats.pendingAssets || stats.limitReached || stats.cancelled || stats.timedOut) process.exitCode = 2;
      console.log(`Asset completion done: scanned ${stats.scannedFiles} files, ${stats.discoveredAssets} candidates evaluated, ${stats.fetchedAssets} fetched, ${stats.failedAssets} failed.`);
    } else if (options.command === "replay") {
      if (options.port !== undefined && (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535)) {
        throw new Error("--port must be between 0 and 65535");
      }
      await replayArchive(options);
    } else {
      if (!Number.isFinite(options.duration) || options.duration < 1 || options.duration > 300) {
        throw new Error("--duration must be between 1 and 300 seconds");
      }
      const report = await verifyArchive(options);
      console.log(report.ok ? "Offline verification passed." : "Offline verification failed.");
      console.log(`Failures: ${report.failures.length}; external requests: ${report.externalRequests.length}`);
      if (!report.ok) process.exitCode = 2;
    }
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  console.error(HELP);
  process.exitCode = 1;
}
