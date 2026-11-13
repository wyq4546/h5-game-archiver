from pathlib import Path
import json
import shutil
import zipfile

from .project_service import get_project_root
from .tool_service import resolve_il2cppdumper, resolve_cpp2il, resolve_ilspycmd
from .tool_setup_service import setup_ilspycmd
from .task_service import start_process, get_task, task_payload
from app.analyzers.engine import find_key_files, read_metadata_version
from app.analyzers.dump_parser import build_index
from app.services.source_service import source_status

NATIVE_CORE_TYPES = [
    "InputController", "PathFollower", "GameManager", "BallController",
    "StackingController", "StackTriggerBall", "HitObstacle",
    "RopeCollisionHandler", "LevelManager",
]

def _pick(paths, arch_hint="armeabi-v7a"):
    if not paths:
        return None
    for p in paths:
        if arch_hint.lower() in p.lower():
            return Path(p)
    # 其次 arm64
    for p in paths:
        if "arm64-v8a" in p.lower():
            return Path(p)
    return Path(paths[0])



def _merge_embedded_apks(project_root: Path) -> Path:
    """
    Cpp2IL 官方 CLI 支持单 APK。
    XAPK 常把 metadata / libil2cpp 分散在 base + split APK，
    因此生成一个仅供静态分析使用的 merged.apk。
    """
    unpacked = project_root / "unpacked"
    apks = [
        p for p in unpacked.rglob("*.apk")
        if "_apk_parts" not in [x.lower() for x in p.parts]
    ]
    if not apks:
        # 单 APK 上传时原文件在 input
        apks = list((project_root / "input").glob("*.apk"))
    if not apks:
        raise RuntimeError("没有找到可供 Cpp2IL 使用的 APK")

    out_dir = project_root / "analysis" / "cpp2il_input"
    out_dir.mkdir(parents=True, exist_ok=True)
    merged = out_dir / "merged.apk"

    seen = set()
    with zipfile.ZipFile(merged, "w", zipfile.ZIP_DEFLATED) as zout:
        for apk in apks:
            try:
                with zipfile.ZipFile(apk, "r") as zin:
                    for info in zin.infolist():
                        name = info.filename
                        if not name or name.endswith("/") or name in seen:
                            continue
                        # 签名对静态分析无意义，且 split APK 中会重复
                        if name.upper().startswith("META-INF/"):
                            continue
                        try:
                            data = zin.read(info)
                        except Exception:
                            continue
                        zout.writestr(name, data)
                        seen.add(name)
            except zipfile.BadZipFile:
                continue

    return merged

def start_cpp2il(project_id: str):
    root = get_project_root(project_id)
    tool = resolve_cpp2il()
    if not tool:
        raise RuntimeError("Cpp2IL 尚未就绪。请先点击页面顶部的“安装 / 编译 Cpp2IL”。")

    game_apk = _merge_embedded_apks(root)
    out = root / "analysis" / "cpp2il"
    out.mkdir(parents=True, exist_ok=True)
    log = root / "logs" / "cpp2il.log"

    if tool.suffix.lower() == ".dll":
        args = [
            "dotnet", tool,
            f"--game-path={game_apk}",
            "--output-as=dll_il_recovery",
            f"--output-to={out}",
            "--verbose",
        ]
    else:
        args = [
            tool,
            f"--game-path={game_apk}",
            "--output-as=dll_il_recovery",
            f"--output-to={out}",
            "--verbose",
        ]

    task = start_process(args=args, cwd=out, log_path=log)
    return {
        "task": task_payload(task),
        "output": str(out),
        "log": str(log),
        "game_path": str(game_apk),
    }

def get_cpp2il_task_result(project_id: str, task_id: str):
    root = get_project_root(project_id)
    out = root / "analysis" / "cpp2il"
    task = get_task(task_id)
    payload = task_payload(task)
    payload["output"] = str(out)
    payload["dll_count"] = len(list(out.rglob("*.dll"))) if out.exists() else 0

    if payload["status"] in ("done", "failed", "stopped"):
        with task._finalize_lock:
            if not task.index_built:
                task.index_result = rebuild_index(project_id)
                task.index_built = True
        payload["index"] = task.index_result
    return payload


def _find_assembly_csharp(project_root: Path):
    cpp2il_out = project_root / "analysis" / "cpp2il"
    exact = list(cpp2il_out.rglob("Assembly-CSharp.dll"))
    if exact:
        return exact[0]

    # 兼容大小写或其他输出目录
    for p in (project_root / "analysis").rglob("*.dll"):
        if p.name.lower() == "assembly-csharp.dll":
            return p
    return None

def start_csharp_decompile(project_id: str):
    root = get_project_root(project_id)
    tool = resolve_ilspycmd()
    if not tool:
        # 反编译按钮本身具备自愈能力：缺少 ILSpyCmd 时自动安装。
        setup_ilspycmd()
        tool = resolve_ilspycmd()
    if not tool:
        raise RuntimeError("ILSpyCmd 自动安装后仍不可用，请展开分析日志查看原因。")

    assembly = _find_assembly_csharp(root)
    if not assembly:
        raise RuntimeError("没有找到 Assembly-CSharp.dll。请先成功运行 Cpp2IL。")

    out = root / "analysis" / "reconstructed_source"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)

    log = root / "logs" / "ilspycmd.log"

    args = [
        str(tool),
        "-p",
        "-o", str(out),
        str(assembly),
    ]

    task = start_process(args=args, cwd=out, log_path=log)
    return {
        "task": task_payload(task),
        "output": str(out),
        "assembly": str(assembly),
        "log": str(log),
    }

def get_csharp_decompile_task_result(project_id: str, task_id: str):
    task = get_task(task_id)
    payload = task_payload(task)
    payload.update(source_status(project_id))

    # C# source generation does not change the DLL metadata index. Rebuilding
    # it on every completed-task poll made this endpoint appear to hang.
    if payload["status"] == "done" and not payload["ready"]:
        payload["status"] = "failed"
        payload["error"] = "ILSpyCmd 已退出，但没有生成任何 C# 文件"
    return payload

def start_il2cppdumper(project_id: str):
    root = get_project_root(project_id)
    unpacked = root / "unpacked"
    keys = find_key_files(unpacked)

    binary = _pick(keys["libil2cpp"])
    metadata = _pick(keys["metadata"])

    if not binary or not metadata:
        raise RuntimeError("没有同时找到 libil2cpp.so 和 global-metadata.dat")

    tool = resolve_il2cppdumper()
    if not tool:
        raise RuntimeError("Il2CppDumper 尚未就绪。请先点击页面顶部的“安装 / 编译 Il2CppDumper”。")

    out = root / "analysis" / "il2cppdumper"
    out.mkdir(parents=True, exist_ok=True)
    log = root / "logs" / "il2cppdumper.log"

    if tool.suffix.lower() == ".dll":
        args = ["dotnet", tool, binary, metadata, out]
    else:
        args = [tool, binary, metadata, out]

    task = start_process(args=args, cwd=out, log_path=log)
    return {
        "task": task_payload(task),
        "output": str(out),
        "log": str(log),
    }

def get_il2cpp_task_result(project_id: str, task_id: str):
    root = get_project_root(project_id)
    out = root / "analysis" / "il2cppdumper"
    dump = out / "dump.cs"
    task = get_task(task_id)

    payload = task_payload(task)
    payload["dump_exists"] = dump.exists()
    payload["output"] = str(out)

    if payload["status"] in ("done", "failed", "stopped"):
        with task._finalize_lock:
            if not task.index_built:
                task.index_result = rebuild_index(project_id)
                task.index_built = True
        payload["index"] = task.index_result
    return payload

def rebuild_index(project_id: str):
    root = get_project_root(project_id)
    idx = build_index(root / "analysis")
    p = root / "analysis" / "index.json"
    p.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")
    return idx

def get_index(project_id: str):
    root = get_project_root(project_id)
    p = root / "analysis" / "index.json"
    if not p.exists():
        return rebuild_index(project_id)
    return json.loads(p.read_text(encoding="utf-8"))

def start_native_analysis(project_id: str, types=None):
    """Dump focused ARM disassembly for gameplay types via the patched Cpp2IL ISIL output."""
    root = get_project_root(project_id)
    tool = resolve_cpp2il()
    if not tool:
        raise RuntimeError("Cpp2IL 尚未就绪。")
    game_apk = _merge_embedded_apks(root)
    out = root / "analysis" / "isil-focused"
    out.mkdir(parents=True, exist_ok=True)
    log = root / "logs" / "native-analysis.log"
    selected = [str(x).strip() for x in (types or NATIVE_CORE_TYPES) if str(x).strip()]
    if not selected:
        raise RuntimeError("至少需要一个类型名称。")
    args = (["dotnet", tool] if tool.suffix.lower() == ".dll" else [tool]) + [
        f"--game-path={game_apk}", "--output-as=isil", f"--output-to={out}"
    ]
    env = dict(__import__("os").environ)
    env["CPP2IL_ASSEMBLY_FILTER"] = "Assembly-CSharp"
    env["CPP2IL_TYPE_FILTER"] = ";".join(selected[:50])
    task = start_process(args=args, cwd=out, log_path=log, env=env)
    return {"task": task_payload(task), "types": selected, "output": str(out), "log": str(log)}

def get_native_task_result(project_id: str, task_id: str):
    root = get_project_root(project_id)
    task = get_task(task_id)
    payload = task_payload(task)
    native_root = root / "analysis" / "isil-focused" / "IsilDump"
    payload["native_file_count"] = len(list(native_root.rglob("*.txt"))) if native_root.exists() else 0
    payload["output"] = str(native_root)
    return payload
