# Project compatibility patch

Base: upstream `nneonneo/ghidra-wasm-plugin` tag `v2.4.0`.
Target: Ghidra `12.1.4`, JDK `21`, Gradle `8.14.3`.

`src/main/java/wasm/format/StructureBuilder.java` uses
`DataTypeUtilities.checkAncestry(this, dataType)` instead of the inherited
`checkAncestry(dataType)` removed in Ghidra 12.1. It converts
`DataTypeDependencyException` to `IllegalArgumentException`, matching the
current `StructureDataType.add` implementation. Recursive dependency checking
and the builder's deferred repacking behavior are preserved.

Rebuild and install from the project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-ghidra-wasm.ps1
```
