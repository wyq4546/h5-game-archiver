from pathlib import Path
import re
import json

def guess_package_name(root: Path):
    for p in root.rglob("manifest.json"):
        try:
            obj = json.loads(p.read_text(encoding="utf-8", errors="ignore"))
            for key in ["package_name", "packageName", "package"]:
                if isinstance(obj.get(key), str):
                    return obj[key]
        except Exception:
            pass

    for p in root.rglob("AndroidManifest.xml"):
        try:
            txt = p.read_bytes().decode("utf-8", errors="ignore")
            m = re.search(r'package\s*=\s*"([^"]+)"', txt)
            if m:
                return m.group(1)
        except Exception:
            pass
    return None
