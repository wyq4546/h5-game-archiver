# Reverse-engineering tools

These tools are for analyzing game archives that you own or are authorized to inspect.

## Included

- `reverse-tools.json`: pinned versions, source URLs, checksums, and portable runtime paths.
- `ghidra-12.1.4/` and `ghidra-wasm-plugin/`: Ghidra with a matching WebAssembly extension; launch with `npm run ghidra`.
- `webcrack` (npm): JavaScript analysis via `npm run deobfuscate -- <input.js> -o <analysis-directory>`.
- `chrome-devtools-mcp` (npm): runtime debugging, configured in the project's `.codex/config.toml`.
- `wabt/`: WebAssembly Toolkit. Use `wasm2wat` or `wasm-decompile` for `.wasm` files.
- `Il2CppDumper/`: restores Unity IL2CPP metadata and generated method/field stubs when a matching binary and `global-metadata.dat` are available.
- `Il2CppDumper-bin/Il2CppDumper.exe`: self-contained build, useful when no .NET SDK/runtime is installed.
- Project-level Fallback for Unity 6 builds that constant-fold their IL2CPP registration structs:
  `npm run method-map -- download/<游戏归档目录>` (`src/il2cpp-wasm-method-map.mjs`) rebuilds `analysis/il2cpp/script.json`
  from `Il2CppCodeGenModule` + `global-metadata.dat`, so `node src/wasm-function.mjs ... --decompile` keeps working.
  See the "`script.json` 缺失时的重建" section of the engineering guide.

## Typical workflow

1. Locate the Unity `.wasm` and `global-metadata.dat` in the archive.
2. Run WABT against the `.wasm` to inspect exports, strings, and control flow.
3. Run Il2CppDumper against the IL2CPP binary and metadata.
4. If `script.json` is missing and `dump.cs` has only `object` types (Unity 6 / metadata v31), run `npm run method-map -- <archive>` instead of retrying Cpp2IL.
5. Compare recovered fields with the runtime controller in the game's `scripts` directory.

The source repositories are kept here rather than copied into `src/` so archive capture and replay remain independent from analysis tooling.

## Build notes

WABT needs a C++ toolchain/CMake to build on Windows. Il2CppDumper needs the .NET SDK or a published release binary
(`Il2CppDumper-bin/` is a self-contained publish). The repositories are intentionally kept at shallow depth and can be updated independently.

Runtime requirements for the bundled builds (verified 2026-10-22):

- `integrations/xapk-analyzer/third_party/Cpp2IL/.../net10.0/Cpp2IL.exe` (launched by `npm run cpp2il`) needs the **.NET 10 runtime**.
- `integrations/xapk-analyzer/third_party/Il2CppDumper/.../net8.0/Il2CppDumper.dll` needs the **.NET 8 runtime** (or a newer major with roll-forward).
- With no `dotnet` on PATH, either install a runtime or use `Il2CppDumper-bin/Il2CppDumper.exe`, which runs standalone.

Note: Cpp2IL fails on Unity 6 builds that fold `Il2CppCodeRegistration` / `Il2CppMetadataRegistration`
(`Failed to find code registration or metadata registration!`). That is a build property, not a tool misconfiguration —
use `npm run method-map` for the method table and record the limitation in the game's `GAME_GUIDE.md`.
