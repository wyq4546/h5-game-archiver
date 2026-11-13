from pathlib import Path
import zipfile

def safe_extract_zip(src: Path, dst: Path):
    dst.mkdir(parents=True, exist_ok=True)
    base = dst.resolve()
    with zipfile.ZipFile(src, "r") as zf:
        for member in zf.infolist():
            target = (dst / member.filename).resolve()
            if target != base and base not in target.parents:
                raise RuntimeError(f"Unsafe archive path: {member.filename}")
        zf.extractall(dst)

def unpack_input(src: Path, unpacked: Path):
    if src.suffix.lower() not in [".apk", ".xapk", ".zip"]:
        raise ValueError("只支持 APK / XAPK / ZIP")

    safe_extract_zip(src, unpacked)

    # APK 本身就是 ZIP；单 APK 上传时直接展开已足够。
    # XAPK 内部还可能有多个 split APK，继续展开。
    apk_parts = unpacked / "_apk_parts"
    apk_parts.mkdir(exist_ok=True)

    apks = [p for p in unpacked.rglob("*.apk") if "_apk_parts" not in p.parts]
    extracted = []

    for apk in apks:
        out = apk_parts / apk.stem
        out.mkdir(exist_ok=True)
        try:
            safe_extract_zip(apk, out)
            extracted.append(str(out))
        except Exception:
            pass

    return {
        "embedded_apks": [str(x) for x in apks],
        "extracted_apks": extracted,
    }
