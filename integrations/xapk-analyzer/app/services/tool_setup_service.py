from pathlib import Path
import subprocess
import shutil
import json
import os

from .config_service import get_config, save_config

BASE = Path(__file__).resolve().parents[2]
THIRD_PARTY = BASE / "third_party"
BUILT = BASE / "tools_built"

def command_exists(name):
    return shutil.which(name) is not None

def run_capture(args, cwd=None, timeout=900):
    p = subprocess.run(
        [str(x) for x in args],
        cwd=str(cwd) if cwd else None,
        capture_output=True,
        text=False,
        timeout=timeout,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )

    def decode(data: bytes) -> str:
        if not data:
            return ""
        # dotnet/git 在 Windows 中文环境下可能走系统代码页。
        for enc in ("utf-8", "gb18030", "cp936"):
            try:
                return data.decode(enc)
            except UnicodeDecodeError:
                pass
        return data.decode("utf-8", errors="replace")

    return {
        "code": p.returncode,
        "stdout": decode(p.stdout)[-20000:],
        "stderr": decode(p.stderr)[-20000:],
    }

def find_il2cppdumper_binary(root: Path):
    """
    优先选择 net8.0 构建产物，避免用户机器没有 .NET 6 Runtime 时，
    误选 net6.0 apphost exe 导致启动失败。

    排序优先级：
    1. net8.0
    2. net10.0
    3. 其他
    同一目标框架内优先 dll（用 dotnet xxx.dll 启动，更稳定），再 exe。
    """
    candidates = []

    for p in root.rglob("Il2CppDumper.dll"):
        if "ref" not in [x.lower() for x in p.parts]:
            candidates.append(p)

    for p in root.rglob("Il2CppDumper.exe"):
        candidates.append(p)

    if not candidates:
        return None

    def score(p: Path):
        s = str(p).lower()
        if "net8.0" in s:
            framework = 0
        elif "net10.0" in s:
            framework = 1
        elif "net9.0" in s:
            framework = 2
        elif "net7.0" in s:
            framework = 3
        elif "net6.0" in s:
            framework = 9
        else:
            framework = 5

        # dll 通过当前已安装 dotnet host 启动，通常比 apphost exe 更不容易卡运行时。
        kind = 0 if p.suffix.lower() == ".dll" else 1
        release = 0 if "release" in s else 1
        return (framework, kind, release, len(s))

    candidates.sort(key=score)
    return candidates[0]

def il2cppdumper_status():
    cfg = get_config()
    configured = cfg.get("il2cppdumper_path", "")
    p = Path(configured) if configured else None

    source_root = THIRD_PARTY / "Il2CppDumper"
    detected = find_il2cppdumper_binary(source_root) if source_root.exists() else None

    ready_path = p if p and p.exists() else detected
    return {
        "git": command_exists("git"),
        "dotnet": command_exists("dotnet"),
        "source_present": source_root.exists(),
        "ready": bool(ready_path and ready_path.exists()),
        "path": str(ready_path) if ready_path else "",
    }

def setup_il2cppdumper():
    cfg = get_config()
    repo = cfg.get("il2cppdumper_repo", "https://github.com/Perfare/Il2CppDumper.git")
    source_root = THIRD_PARTY / "Il2CppDumper"
    THIRD_PARTY.mkdir(exist_ok=True)
    BUILT.mkdir(exist_ok=True)

    if not command_exists("git"):
        raise RuntimeError("没有检测到 Git。请先安装 Git for Windows。")
    if not command_exists("dotnet"):
        raise RuntimeError("没有检测到 .NET SDK。请先安装 .NET SDK。")

    logs = []

    if not source_root.exists():
        r = run_capture(["git", "clone", "--depth", "1", repo, str(source_root)], cwd=THIRD_PARTY)
        logs.append("$ git clone\n" + r["stdout"] + "\n" + r["stderr"])
        if r["code"] != 0:
            raise RuntimeError("克隆 Il2CppDumper 失败：\n" + (r["stderr"] or r["stdout"]))
    else:
        r = run_capture(["git", "pull", "--ff-only"], cwd=source_root)
        logs.append("$ git pull\n" + r["stdout"] + "\n" + r["stderr"])

    csprojs = list(source_root.rglob("*.csproj"))
    if not csprojs:
        raise RuntimeError("Il2CppDumper 源码中没有找到 .csproj")

    # 优先项目名精确匹配
    csprojs.sort(key=lambda p: (
        p.stem.lower() != "il2cppdumper",
        "test" in p.stem.lower(),
        len(str(p))
    ))
    csproj = csprojs[0]

    r = run_capture(
        ["dotnet", "build", str(csproj), "-c", "Release"],
        cwd=csproj.parent,
        timeout=1200
    )
    logs.append("$ dotnet build\n" + r["stdout"] + "\n" + r["stderr"])
    if r["code"] != 0:
        raise RuntimeError("Il2CppDumper 编译失败：\n" + (r["stderr"] or r["stdout"]))

    binary = find_il2cppdumper_binary(source_root)
    if not binary:
        raise RuntimeError("编译成功，但没有找到 Il2CppDumper.exe / Il2CppDumper.dll")

    cfg["il2cppdumper_path"] = str(binary)
    save_config(cfg)

    return {
        "ok": True,
        "path": str(binary),
        "project": str(csproj),
        "log": "\n\n".join(logs)[-30000:],
    }


def find_cpp2il_binary(root: Path):
    candidates = []
    for p in root.rglob("Cpp2IL.dll"):
        if "ref" not in [x.lower() for x in p.parts]:
            candidates.append(p)
    for p in root.rglob("Cpp2IL.exe"):
        candidates.append(p)
    if not candidates:
        return None

    def score(p: Path):
        s = str(p).lower()
        # development 当前主要是 net9；也兼容未来 net10
        if "net10" in s:
            fw = 0
        elif "net9" in s:
            fw = 1
        elif "net8" in s:
            fw = 2
        else:
            fw = 5
        kind = 0 if p.suffix.lower() == ".dll" else 1
        release = 0 if "release" in s else 1
        return (fw, kind, release, len(s))

    candidates.sort(key=score)
    return candidates[0]

def cpp2il_status():
    cfg = get_config()
    configured = cfg.get("cpp2il_path", "")
    p = Path(configured) if configured else None
    source_root = THIRD_PARTY / "Cpp2IL"
    detected = find_cpp2il_binary(source_root) if source_root.exists() else None
    ready_path = p if p and p.exists() else detected

    return {
        "git": command_exists("git"),
        "dotnet": command_exists("dotnet"),
        "source_present": source_root.exists(),
        "ready": bool(ready_path and ready_path.exists()),
        "path": str(ready_path) if ready_path else "",
    }


def patch_cpp2il_source(source_root: Path):
    changes = []

    binary_searcher = source_root / "LibCpp2IL" / "BinarySearcher.cs"
    if binary_searcher.exists():
        text = binary_searcher.read_text(encoding="utf-8-sig")
        old = (
            '            if (pCodegenModules.Count() > 1)\n'
            '                throw new Exception("Found more than 1 pointer as pCodegenModules");\n'
        )
        replacement = (
            '            // XAPK Analyzer compatibility patch:\n'
            '            // Keep multiple candidates and let the validation loop below test each one.\n'
        )
        if old in text:
            text = text.replace(old, replacement)
            binary_searcher.write_text(text, encoding="utf-8")
            changes.append("BinarySearcher: enabled multi-candidate validation")
        elif "XAPK Analyzer compatibility patch" in text:
            changes.append("BinarySearcher: patch already applied")
        else:
            changes.append("BinarySearcher: target code not found; upstream may have changed")

    program = source_root / "Cpp2IL" / "Program.cs"
    if program.exists():
        text = program.read_text(encoding="utf-8-sig")
        original = text

        old1 = (
            '                Logger.ErrorNewline("Waiting for you to press enter - feel free to copy the error...");\n'
            '                Console.ReadLine();\n\n'
            '                return -1;'
        )
        new1 = (
            '                Logger.ErrorNewline("Cpp2IL failed. Error has been written to the log.");\n'
            '                return -1;'
        )
        text = text.replace(old1, new1)

        old2 = (
            '                Logger.ErrorNewline($"\\n\\n{e}\\n\\nWaiting for you to press enter - feel free to copy the error...");\n'
            '                Console.ReadLine();\n'
            '                return -1;'
        )
        new2 = (
            '                Logger.ErrorNewline($"\\n\\n{e}\\n\\nCpp2IL failed. Error has been written to the log.");\n'
            '                return -1;'
        )
        text = text.replace(old2, new2)

        if text != original:
            program.write_text(text, encoding="utf-8")
            changes.append("Program: removed Console.ReadLine error blocking")
        elif "Cpp2IL failed. Error has been written to the log." in text:
            changes.append("Program: patch already applied")
        else:
            changes.append("Program: target code not found; upstream may have changed")

    return changes


def setup_cpp2il():
    cfg = get_config()
    repo = cfg.get("cpp2il_repo", "https://github.com/SamboyCoding/Cpp2IL.git")
    branch = cfg.get("cpp2il_branch", "development")
    source_root = THIRD_PARTY / "Cpp2IL"
    THIRD_PARTY.mkdir(exist_ok=True)

    if not command_exists("git"):
        raise RuntimeError("没有检测到 Git。请先安装 Git for Windows。")
    if not command_exists("dotnet"):
        raise RuntimeError("没有检测到 .NET SDK。Cpp2IL development 当前需要较新的 .NET SDK。")

    logs = []

    if not source_root.exists():
        r = run_capture(
            ["git", "clone", "--depth", "1", "--branch", branch, repo, str(source_root)],
            cwd=THIRD_PARTY,
            timeout=1200
        )
        logs.append("$ git clone Cpp2IL\n" + r["stdout"] + "\n" + r["stderr"])
        if r["code"] != 0:
            raise RuntimeError("克隆 Cpp2IL 失败：\n" + (r["stderr"] or r["stdout"]))
    else:
        r = run_capture(["git", "pull", "--ff-only"], cwd=source_root, timeout=600)
        logs.append("$ git pull Cpp2IL\n" + r["stdout"] + "\n" + r["stderr"])

    patch_notes = patch_cpp2il_source(source_root)
    logs.append("$ apply compatibility patches\n" + "\n".join(patch_notes))

    csproj = source_root / "Cpp2IL" / "Cpp2IL.csproj"
    if not csproj.exists():
        matches = [p for p in source_root.rglob("Cpp2IL.csproj") if p.is_file()]
        if not matches:
            raise RuntimeError("Cpp2IL 源码中没有找到 Cpp2IL.csproj")
        csproj = matches[0]

    r = run_capture(
        ["dotnet", "build", str(csproj), "-c", "Release"],
        cwd=source_root,
        timeout=2400
    )
    logs.append("$ dotnet build Cpp2IL\n" + r["stdout"] + "\n" + r["stderr"])
    if r["code"] != 0:
        raise RuntimeError("Cpp2IL 编译失败：\n" + (r["stderr"] or r["stdout"]))

    binary = find_cpp2il_binary(source_root)
    if not binary:
        raise RuntimeError("Cpp2IL 编译完成，但没有找到 Cpp2IL.dll / Cpp2IL.exe")

    cfg["cpp2il_path"] = str(binary)
    save_config(cfg)
    return {
        "ok": True,
        "path": str(binary),
        "project": str(csproj),
        "log": "\n\n".join(logs)[-50000:],
    }


def find_ilspycmd_binary():
    cfg = get_config()
    configured = cfg.get("ilspycmd_path", "")
    if configured and Path(configured).exists():
        return Path(configured)

    tool_dir = BUILT / "ilspycmd"
    candidates = [
        tool_dir / "ilspycmd.exe",
        tool_dir / "ilspycmd",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None

def ilspycmd_status():
    tool = find_ilspycmd_binary()
    return {
        "dotnet": command_exists("dotnet"),
        "ready": bool(tool and tool.exists()),
        "path": str(tool) if tool else "",
    }

def setup_ilspycmd():
    if not command_exists("dotnet"):
        raise RuntimeError("没有检测到 .NET SDK，无法安装 ILSpyCmd。")

    BUILT.mkdir(exist_ok=True)
    tool_dir = BUILT / "ilspycmd"
    tool_dir.mkdir(parents=True, exist_ok=True)

    logs = []

    existing = find_ilspycmd_binary()
    if existing:
        r = run_capture(
            ["dotnet", "tool", "update", "ilspycmd", "--tool-path", str(tool_dir)],
            cwd=BASE,
            timeout=1200
        )
        logs.append("$ dotnet tool update ilspycmd\n" + r["stdout"] + "\n" + r["stderr"])
        # 某些环境 update 会因为版本状态失败；再尝试 install 不会覆盖已有工具，所以保留原工具。
    else:
        r = run_capture(
            ["dotnet", "tool", "install", "ilspycmd", "--tool-path", str(tool_dir)],
            cwd=BASE,
            timeout=1200
        )
        logs.append("$ dotnet tool install ilspycmd\n" + r["stdout"] + "\n" + r["stderr"])
        if r["code"] != 0:
            raise RuntimeError("ILSpyCmd 安装失败：\n" + (r["stderr"] or r["stdout"]))

    tool = find_ilspycmd_binary()
    if not tool:
        raise RuntimeError("安装命令已结束，但没有找到 ilspycmd 可执行文件。")

    cfg = get_config()
    cfg["ilspycmd_path"] = str(tool)
    save_config(cfg)

    return {
        "ok": True,
        "path": str(tool),
        "log": "\n\n".join(logs)[-30000:],
    }


def setup_all_tools():
    """
    一键准备全部解析/反编译工具。
    仅安装缺失项；已就绪的工具不会重复重装。
    """
    result = {
        "ok": True,
        "steps": [],
    }

    # Il2CppDumper
    try:
        st = il2cppdumper_status()
        if st.get("ready"):
            result["steps"].append({"tool": "Il2CppDumper", "status": "ready", "message": "已就绪"})
        else:
            r = setup_il2cppdumper()
            result["steps"].append({"tool": "Il2CppDumper", "status": "installed", "message": r.get("path", "")})
    except Exception as e:
        result["ok"] = False
        result["steps"].append({"tool": "Il2CppDumper", "status": "failed", "message": str(e)})

    # Cpp2IL
    try:
        st = cpp2il_status()
        if st.get("ready"):
            result["steps"].append({"tool": "Cpp2IL", "status": "ready", "message": "已就绪"})
        else:
            r = setup_cpp2il()
            result["steps"].append({"tool": "Cpp2IL", "status": "installed", "message": r.get("path", "")})
    except Exception as e:
        result["ok"] = False
        result["steps"].append({"tool": "Cpp2IL", "status": "failed", "message": str(e)})

    # ILSpyCmd
    try:
        st = ilspycmd_status()
        if st.get("ready"):
            result["steps"].append({"tool": "ILSpyCmd", "status": "ready", "message": "已就绪"})
        else:
            r = setup_ilspycmd()
            result["steps"].append({"tool": "ILSpyCmd", "status": "installed", "message": r.get("path", "")})
    except Exception as e:
        result["ok"] = False
        result["steps"].append({"tool": "ILSpyCmd", "status": "failed", "message": str(e)})

    return result
