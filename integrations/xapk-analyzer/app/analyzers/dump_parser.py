from pathlib import Path
import re

try:
    import dnfile
except Exception:
    dnfile = None

CLASS_RE = re.compile(
    r'(?m)^\s*(?:(?:public|private|protected|internal|abstract|sealed|static|partial)\s+)*'
    r'(?:class|struct|interface|enum)\s+([A-Za-z_][A-Za-z0-9_`<>]*)'
)
METHOD_RE = re.compile(
    r'(?m)^\s*(?:(?:public|private|protected|internal|static|virtual|override|abstract|sealed|extern|async|unsafe|new)\s+)+'
    r'[\w<>\[\],.`?*&]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\('
)
FIELD_RE = re.compile(
    r'(?m)^\s*(?:(?:public|private|protected|internal|static|readonly|const|volatile|unsafe|new)\s+)+'
    r'[\w<>\[\],.`?*&]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:;|=)'
)

KEYWORDS = [
    "player","game","manager","input","controller","obstacle","reward","coin",
    "collect","level","finish","win","lose","death","dead","enemy","camera",
    "movement","move","runner","stack","trigger","barrel","road","platform",
    "gate","score","upgrade","character","vehicle","wheel"
]

def locate_source_files(root: Path):
    return [p for p in root.rglob("*.cs") if p.is_file()]

def _assembly_name(path: Path) -> str:
    return path.stem

def _is_game_assembly(name: str) -> bool:
    low = (name or "").lower()
    return low == "assembly-csharp" or low.startswith("assembly-csharp-")

def _make_row(name: str, path: Path):
    assembly = _assembly_name(path)
    return {
        "name": name,
        "file": str(path),
        "assembly": assembly,
        "is_game": _is_game_assembly(assembly),
    }

def _uniq(rows):
    seen, out = set(), []
    for row in rows:
        key = (row["name"], row["file"])
        if key not in seen:
            seen.add(key)
            out.append(row)
    return out

def build_index(root: Path):
    classes, methods, fields = [], [], []

    # Il2CppDumper / 其他 C# 文本输出
    for p in locate_source_files(root):
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for m in CLASS_RE.finditer(txt):
            classes.append(_make_row(m.group(1), p))
        for m in METHOD_RE.finditer(txt):
            methods.append(_make_row(m.group(1), p))
        for m in FIELD_RE.finditer(txt):
            fields.append(_make_row(m.group(1), p))

    # Cpp2IL dll_il_recovery 输出
    if dnfile is not None:
        for p in root.rglob("*.dll"):
            try:
                pe = dnfile.dnPE(str(p))
                if not pe.net or not pe.net.mdtables:
                    continue

                type_table = getattr(pe.net.mdtables, "TypeDef", None)
                if type_table:
                    for row in type_table.rows:
                        name = str(getattr(row, "TypeName", "") or "")
                        ns = str(getattr(row, "TypeNamespace", "") or "")
                        full = f"{ns}.{name}" if ns else name
                        if name and name != "<Module>":
                            classes.append(_make_row(full, p))

                method_table = getattr(pe.net.mdtables, "MethodDef", None)
                if method_table:
                    for row in method_table.rows:
                        name = str(getattr(row, "Name", "") or "")
                        if name:
                            methods.append(_make_row(name, p))

                field_table = getattr(pe.net.mdtables, "Field", None)
                if field_table:
                    for row in field_table.rows:
                        name = str(getattr(row, "Name", "") or "")
                        if name:
                            fields.append(_make_row(name, p))
            except Exception:
                continue

    classes, methods, fields = _uniq(classes), _uniq(methods), _uniq(fields)

    game_classes = [x for x in classes if x.get("is_game")]
    game_methods = [x for x in methods if x.get("is_game")]
    game_fields = [x for x in fields if x.get("is_game")]

    # 重点类只从游戏程序集里筛，彻底去掉 UnityEngine/System/Firebase 等噪音
    candidate_source = game_classes if game_classes else classes
    candidates = []
    for row in candidate_source:
        low = row["name"].lower()
        score = sum(1 for k in KEYWORDS if k in low)
        if score:
            # 游戏程序集再加权
            bonus = 3 if row.get("is_game") else 0
            candidates.append({**row, "score": score + bonus})
    candidates.sort(key=lambda x: (-x["score"], x["name"].lower()))

    assemblies = {}
    for row in classes:
        name = row.get("assembly") or "unknown"
        info = assemblies.setdefault(name, {"assembly": name, "class_count": 0, "is_game": row.get("is_game", False)})
        info["class_count"] += 1

    return {
        "class_count": len(classes),
        "method_count": len(methods),
        "field_count": len(fields),

        "game_class_count": len(game_classes),
        "game_method_count": len(game_methods),
        "game_field_count": len(game_fields),

        "classes": classes,
        "methods": methods,
        "fields": fields,
        "candidates": candidates[:500],
        "assemblies": sorted(assemblies.values(), key=lambda x: (not x["is_game"], -x["class_count"], x["assembly"].lower())),
    }

def search_index(index, query, limit=100, game_only=True):
    q = query.lower().strip()
    if not q:
        return []

    out = []
    for kind in ["classes", "methods", "fields"]:
        for row in index.get(kind, []):
            if game_only and not row.get("is_game", False):
                continue
            if q in row["name"].lower():
                out.append({"kind": kind[:-1], **row})
                if len(out) >= limit:
                    return out
    return out
