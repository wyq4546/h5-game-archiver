from pathlib import Path
import re

def all_files(root: Path):
    return [p for p in root.rglob("*") if p.is_file()]

def detect_engine(root: Path):
    files = all_files(root)
    names = [p.name.lower() for p in files]

    engine = "unknown"
    backend = "unknown"

    if any(n in names for n in [
        "libunity.so",
        "libil2cpp.so",
        "global-metadata.dat",
        "assembly-csharp.dll",
        "globalgamemanagers",
    ]):
        engine = "unity"

    if "libil2cpp.so" in names or "global-metadata.dat" in names:
        engine = "unity"
        backend = "il2cpp"
    elif "assembly-csharp.dll" in names:
        engine = "unity"
        backend = "mono"
    elif any(n.endswith(".dex") for n in names):
        backend = "android-dex"

    if engine == "unknown" and any("libcocos2d" in n for n in names):
        engine = "cocos"

    if any(n == "libgodot_android.so" for n in names):
        engine = "godot"

    return engine, backend

def find_architectures(root: Path):
    result = set()
    for p in root.rglob("*.so"):
        lowparts = [x.lower() for x in p.parts]
        for arch in ["arm64-v8a", "armeabi-v7a", "x86_64", "x86"]:
            if arch in lowparts:
                result.add(arch)
    return sorted(result)

def find_key_files(root: Path):
    out = {
        "libil2cpp": [],
        "metadata": [],
        "assembly_csharp": [],
        "unity": [],
        "dex": [],
    }
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        n = p.name.lower()
        if n == "libil2cpp.so":
            out["libil2cpp"].append(str(p))
        elif n == "global-metadata.dat":
            out["metadata"].append(str(p))
        elif n == "assembly-csharp.dll":
            out["assembly_csharp"].append(str(p))
        elif n == "libunity.so":
            out["unity"].append(str(p))
        elif n.endswith(".dex"):
            out["dex"].append(str(p))
    return out

def guess_unity_version(root: Path):
    pat = re.compile(rb"20\d{2}\.\d+\.\d+[abfp]\d+")
    candidates = []
    for name in ["globalgamemanagers", "data.unity3d", "resources.assets"]:
        candidates.extend(root.rglob(name))
    for p in candidates:
        try:
            with p.open("rb") as f:
                data = f.read(10_000_000)
            m = pat.search(data)
            if m:
                return m.group(0).decode("ascii", errors="ignore")
        except Exception:
            pass
    return None


def read_metadata_version(root: Path):
    """读取 global-metadata.dat 头部版本号。"""
    for p in root.rglob("global-metadata.dat"):
        try:
            with p.open("rb") as f:
                head = f.read(8)
            if len(head) >= 8 and int.from_bytes(head[:4], "little") == 0xFAB11BAF:
                return int.from_bytes(head[4:8], "little", signed=True)
        except Exception:
            pass
    return None
