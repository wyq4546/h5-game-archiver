import test from "node:test";
import assert from "node:assert/strict";
import { parseAxml, parseArsc } from "../src/apk-importer.mjs";
import { assessCompleteness } from "../src/capture.mjs";

test("assessCompleteness marks apk with coreReady as core-complete", () => {
  const manifest = {
    packageType: "apk",
    runtimeInspection: {
      coreReady: true,
      engine: "Unity (Android / IL2CPP)"
    },
    resources: [
      { saved: true, path: "archive/game.apk" }
    ]
  };
  const result = assessCompleteness(manifest);
  assert.equal(result.status, "core-complete");
  assert.equal(result.failedResources, 0);
  assert.equal(result.criticalFailures.length, 0);
});

test("parseAxml handles empty or invalid buffer safely", () => {
  assert.equal(parseAxml(Buffer.alloc(4)), null);
  assert.equal(parseAxml(Buffer.from([0, 1, 2, 3])), null);
});

test("parseArsc handles empty or invalid buffer safely", () => {
  const map = parseArsc(Buffer.alloc(4), new Set([0x7f010001]));
  assert.equal(map.size, 0);
});
