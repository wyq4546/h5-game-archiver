from pathlib import Path
import subprocess
import os

from .config_service import get_config

def resolve_ilspycmd():
    cfg = get_config()
    value = cfg.get("ilspycmd_path", "")
    if value and Path(value).exists():
        return Path(value)

    base = Path(__file__).resolve().parents[2]
    for p in [
        base / "tools_built" / "ilspycmd" / "ilspycmd.exe",
        base / "tools_built" / "ilspycmd" / "ilspycmd",
    ]:
        if p.exists():
            return p
    return None

def resolve_cpp2il():
    cfg = get_config()
    value = cfg.get("cpp2il_path", "")
    if value and Path(value).exists():
        return Path(value)
    return None

def resolve_il2cppdumper():
    cfg = get_config()
    value = cfg.get("il2cppdumper_path", "")
    if value and Path(value).exists():
        return Path(value)
    return None

def run_process(args, cwd: Path, log_path: Path, timeout=1800):
    with log_path.open("w", encoding="utf-8", errors="ignore") as log:
        p = subprocess.Popen(
            [str(x) for x in args],
            cwd=str(cwd),
            stdout=log,
            stderr=subprocess.STDOUT,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        try:
            code = p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            p.kill()
            raise RuntimeError("外部工具运行超时")
    return code
