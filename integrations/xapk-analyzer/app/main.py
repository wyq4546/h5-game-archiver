from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import shutil
import json
from datetime import datetime, timezone
import zipfile
import os

from .models import ToolRunRequest, SearchRequest, NativeAnalysisRequest
from .services.project_service import create_project, get_project_root
from .services.analysis_service import start_il2cppdumper, get_il2cpp_task_result, start_cpp2il, get_cpp2il_task_result, start_csharp_decompile, get_csharp_decompile_task_result, rebuild_index, get_index, start_native_analysis, get_native_task_result
from .services.tool_setup_service import il2cppdumper_status, setup_il2cppdumper, find_il2cppdumper_binary, cpp2il_status, setup_cpp2il, find_cpp2il_binary, ilspycmd_status, setup_ilspycmd, setup_all_tools
from .services.task_service import send_input, stop_task
from .services.config_service import get_config, save_config
from .analyzers.archive import unpack_input
from .analyzers.android_manifest import guess_package_name
from .analyzers.engine import detect_engine, find_architectures, find_key_files, guess_unity_version, read_metadata_version
from .analyzers.dump_parser import search_index
from .services.source_service import class_detail, source_status

BASE = Path(__file__).resolve().parent
STATIC = BASE / "static"

app = FastAPI(title="XAPK Analyzer", version="1.5.0")
app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")

@app.get("/api/health")
def health():
    return {"name": "xapk-analyzer", "version": app.version, "pid": os.getpid()}

@app.get("/")
def home():
    return FileResponse(STATIC / "index.html")

@app.get("/api/tools/il2cppdumper/status")
def tool_status():
    return il2cppdumper_status()


@app.post("/api/tools/il2cppdumper/reselect")
def tool_reselect():
    try:
        root = Path(__file__).resolve().parents[1] / "third_party" / "Il2CppDumper"
        binary = find_il2cppdumper_binary(root)
        if not binary:
            raise RuntimeError("没有找到已编译的 Il2CppDumper 产物，请先点击安装/编译。")
        cfg = get_config()
        cfg["il2cppdumper_path"] = str(binary)
        save_config(cfg)
        return {"ok": True, "path": str(binary)}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/tools/il2cppdumper/setup")
def tool_setup():
    try:
        return setup_il2cppdumper()
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/tools/cpp2il/status")
def cpp2il_tool_status():
    return cpp2il_status()

@app.post("/api/tools/cpp2il/setup")
def cpp2il_tool_setup():
    try:
        return setup_cpp2il()
    except Exception as e:
        raise HTTPException(500, str(e))



@app.post("/api/tools/setup-all")
def setup_all():
    try:
        return setup_all_tools()
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/tools/ilspycmd/status")
def ilspy_tool_status():
    return ilspycmd_status()

@app.post("/api/tools/ilspycmd/setup")
def ilspy_tool_setup():
    try:
        return setup_ilspycmd()
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in [".xapk", ".apk", ".zip"]:
        raise HTTPException(400, "只支持 .xapk / .apk / .zip")

    project_id, root = create_project(file.filename or "game.xapk")
    input_path = root / "input" / (file.filename or "game.xapk")

    with input_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        extra = unpack_input(input_path, root / "unpacked")
        engine, backend = detect_engine(root / "unpacked")
        summary = {
            "project_id": project_id,
            "filename": file.filename,
            "package_name": guess_package_name(root / "unpacked"),
            "engine": engine,
            "backend": backend,
            "unity_version": guess_unity_version(root / "unpacked"),
            "metadata_version": read_metadata_version(root / "unpacked"),
            "architectures": find_architectures(root / "unpacked"),
            "files_found": find_key_files(root / "unpacked"),
            "extra": extra,
        }
        (root / "project.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        return summary
    except Exception as e:
        raise HTTPException(500, f"解析失败：{e}")


@app.post("/api/project/{project_id}/run")
def run_tool(project_id: str, req: ToolRunRequest):
    try:
        tool = req.tool.lower()
        if tool == "il2cppdumper":
            return start_il2cppdumper(project_id)
        if tool == "cpp2il":
            return start_cpp2il(project_id)
        if tool == "decompile":
            return start_csharp_decompile(project_id)
        raise RuntimeError("未知分析器")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/project/{project_id}/task/{task_id}")
def task_status(project_id: str, task_id: str):
    try:
        return get_il2cpp_task_result(project_id, task_id)
    except KeyError:
        raise HTTPException(404, "任务不存在")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/project/{project_id}/task/{task_id}/input")
def task_input(project_id: str, task_id: str, payload: dict):
    try:
        value = str(payload.get("value", ""))
        send_input(task_id, value)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/project/{project_id}/task/{task_id}/stop")
def task_stop(project_id: str, task_id: str):
    try:
        stop_task(task_id)
        return get_il2cpp_task_result(project_id, task_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/project/{project_id}/cpp2il-task/{task_id}")
def cpp2il_task_status(project_id: str, task_id: str):
    try:
        return get_cpp2il_task_result(project_id, task_id)
    except KeyError:
        raise HTTPException(404, "任务不存在")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/project/{project_id}/decompile-task/{task_id}")
def decompile_task_status(project_id: str, task_id: str):
    try:
        return get_csharp_decompile_task_result(project_id, task_id)
    except KeyError:
        raise HTTPException(404, "任务不存在")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/project/{project_id}/native-analysis")
def native_analysis(project_id: str, req: NativeAnalysisRequest):
    try:
        return start_native_analysis(project_id, req.types or None)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/project/{project_id}/native-task/{task_id}")
def native_task_status(project_id: str, task_id: str):
    try:
        return get_native_task_result(project_id, task_id)
    except KeyError:
        raise HTTPException(404, "任务不存在")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/project/{project_id}/source/status")
def project_source_status(project_id: str):
    try:
        return source_status(project_id)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/project/{project_id}/class-detail")
def project_class_detail(project_id: str, name: str):
    try:
        return class_detail(project_id, name)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/project/{project_id}/reindex")
def reindex(project_id: str):
    try:
        return rebuild_index(project_id)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/project/{project_id}/index")
def index(project_id: str):
    try:
        return get_index(project_id)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/project/{project_id}/search")
def search(project_id: str, req: SearchRequest):
    try:
        idx = get_index(project_id)
        return {"results": search_index(idx, req.query, req.limit, game_only=(req.scope == "game"))}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/project/{project_id}/export")
def export(project_id: str):
    try:
        root = get_project_root(project_id)
        data = {
            "project": json.loads((root / "project.json").read_text(encoding="utf-8")),
            "index": get_index(project_id),
        }
        out = root / "exports" / "analysis.json"
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return FileResponse(out, media_type="application/json", filename=f"{project_id}-analysis.json")
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/project/{project_id}/export-source")
def export_source(project_id: str):
    try:
        root = get_project_root(project_id)
        source_root = root / "analysis" / "reconstructed_source"
        source_files = list(source_root.rglob("*.cs")) if source_root.exists() else []
        if not source_files:
            raise HTTPException(409, "还没有可导出的 C# 源码，请先运行“反编译 C#”。")

        project = json.loads((root / "project.json").read_text(encoding="utf-8"))
        out = root / "exports" / f"{project_id}-reconstructed-source.zip"
        out.parent.mkdir(parents=True, exist_ok=True)
        readme = (
            "XAPK Analyzer reconstructed C# source\n"
            f"Project: {project_id}\n"
            f"Input: {project.get('filename', '')}\n"
            f"Generated: {datetime.now(timezone.utc).isoformat()}\n"
            f"C# files: {len(source_files)}\n\n"
            "These files were reconstructed from an IL2CPP recovery DLL. "
            "They are not guaranteed to match the developer's original source code.\n"
        )

        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("README.txt", readme)
            for source_file in source_files:
                archive.write(source_file, Path("src") / source_file.relative_to(source_root))

        return FileResponse(
            out,
            media_type="application/zip",
            filename=f"{project_id}-reconstructed-source.zip",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
