#!/usr/bin/env node
// 当 Unity WebGL 构建把 IL2CPP 注册结构常量折叠、Il2CppDumper 生成不出 script.json 时，
// 用这个方法从 Il2CppCodeGenModule + global-metadata.dat 重建方法名 → 函数表索引映射。
//
// 用法：node scripts/build-wasm-method-map.mjs download/<游戏归档目录>
import path from "node:path";
import { writeWasmMethodScript } from "../src/il2cpp-wasm-method-map.mjs";

const argument = process.argv[2];
if (!argument) {
  console.error("用法：node scripts/build-wasm-method-map.mjs download/<游戏归档目录>");
  process.exitCode = 1;
} else {
  const root = path.resolve(argument);
  const result = await writeWasmMethodScript(root, event => {
    if (event.status === "ok") {
      console.log(`已写出 ${event.output}`);
      console.log(`方法 ${event.methods} 个，覆盖 ${event.images} 个模块，方法表步长 ${event.methodStride}`);
      if (event.skipped.length) console.log(`跳过 ${event.skipped.length} 个模块：${event.skipped.map(item => item.image).join(", ")}`);
    } else {
      console.log(`${event.status}: ${event.reason}`);
    }
  });
  if (result.status !== "ok") process.exitCode = 2;
}
