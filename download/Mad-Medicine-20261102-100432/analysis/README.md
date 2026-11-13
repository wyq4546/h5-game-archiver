# 游戏发布源码分析

原始发布文件保留在 ../game/，本目录保存分析产物。

- 引擎：Unity WebGL（high）
- 游戏相关文本文件：7；全部文本：117；噪声：5
- WASM 模块：1；已生成 WAT：0

## 分析范围

这是对发布产物的静态整理和反编译，不等同于开发者原始 Unity 工程。IL2CPP 可以恢复类、字段、方法签名及 WASM 方法映射，但不能恢复原始变量名、注释和完整 C# 方法体。

## 产物

- report.json：总报告与解析范围
- source-index.json：文件、作用域和符号索引
- automation-context.json：后续分析入口与文件索引
- wasm/：WASM 副本、结构摘要与 WAT（存在 WASM 时）
- Unity data 包：1；解包文件：7
- IL2CPP：completed
- unity-data/：Unity 数据包与 metadata
- il2cpp/：类、字段、方法签名和 WASM 方法映射
- bot/：IL2CPP 方法索引与桥接运行时
