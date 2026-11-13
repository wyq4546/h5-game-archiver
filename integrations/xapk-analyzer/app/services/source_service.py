from pathlib import Path
import re

from .project_service import get_project_root

TYPE_RE = re.compile(
    r'(?m)^\s*(?:(?:public|private|protected|internal|abstract|sealed|static|partial|readonly|ref)\s+)*'
    r'(class|struct|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_`]*)'
)
NAMESPACE_FILE_RE = re.compile(r'(?m)^\s*namespace\s+([A-Za-z_][A-Za-z0-9_.]*)\s*(?:;|\{)')
METHOD_RE = re.compile(
    r'(?m)^\s*(?:(?:public|private|protected|internal|static|virtual|override|abstract|sealed|extern|async|unsafe|new|partial)\s+)+'
    r'([A-Za-z_][A-Za-z0-9_<>\[\],.?*& ]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)'
)
FIELD_RE = re.compile(
    r'(?m)^\s*(?:(?:public|private|protected|internal|static|readonly|const|volatile|unsafe|new)\s+)+'
    r'([A-Za-z_][A-Za-z0-9_<>\[\],.?*& ]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:;|=)'
)

def reconstructed_root(project_id: str) -> Path:
    return get_project_root(project_id) / "analysis" / "reconstructed_source"

def source_status(project_id: str):
    root = reconstructed_root(project_id)
    files = list(root.rglob("*.cs")) if root.exists() else []
    return {
        "ready": bool(files),
        "source_file_count": len(files),
        "path": str(root),
    }

def _normalize_type_name(name: str):
    return (name or "").replace("+", ".").strip()

def _simple_name(name: str):
    name = _normalize_type_name(name)
    return name.rsplit(".", 1)[-1].split("`", 1)[0]

def _read_file(p: Path):
    return p.read_text(encoding="utf-8", errors="ignore")

def _method_body(text: str, declaration_end: int):
    cursor = declaration_end
    while cursor < len(text) and text[cursor].isspace():
        cursor += 1
    if cursor >= len(text) or text[cursor] != "{":
        return None
    depth = 0
    for index in range(cursor, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return text[cursor + 1:index]
    return text[cursor + 1:]

def _body_quality(body):
    if body is None:
        return "declaration"
    compact = re.sub(r'//[^\n]*|/\*.*?\*/|\s+', '', body, flags=re.S)
    if not compact:
        return "stub"
    if compact in {"returnnull;", "returnfalse;", "returntrue;", "return0;", "return;", "thrownull;", "thrownewNotImplementedException();"}:
        return "stub"
    if re.fullmatch(r'return(?:default(?:\([^)]*\))?|null|false|true|0|-1);', compact):
        return "stub"
    return "logic"

def _quality_summary(methods):
    counts = {"logic": 0, "stub": 0, "declaration": 0}
    for method in methods:
        counts[method["quality"]] += 1
    total = counts["logic"] + counts["stub"]
    counts["logic_ratio"] = round(counts["logic"] / total, 4) if total else 0
    counts["grade"] = "skeleton" if counts["logic"] == 0 and counts["stub"] else ("partial" if counts["logic_ratio"] < 0.35 else "usable")
    return counts

def find_class_file(project_id: str, class_name: str):
    root = reconstructed_root(project_id)
    if not root.exists():
        return None

    simple = _simple_name(class_name)
    requested = _normalize_type_name(class_name)

    # ILSpy project output normally creates one .cs per type; filename match is fastest.
    direct = list(root.rglob(simple + ".cs"))
    candidates = direct or list(root.rglob("*.cs"))

    best = None
    best_score = -1
    decl_re = re.compile(rf'\b(class|struct|interface|enum|record)\s+{re.escape(simple)}(?:\b|<|`)')

    for p in candidates:
        try:
            text = _read_file(p)
        except Exception:
            continue
        if not decl_re.search(text):
            continue

        ns_match = NAMESPACE_FILE_RE.search(text)
        ns = ns_match.group(1) if ns_match else ""
        full = f"{ns}.{simple}" if ns else simple

        score = 1
        if p.stem == simple:
            score += 3
        if full == requested:
            score += 5
        if requested.endswith("." + simple):
            score += 1

        if score > best_score:
            best_score = score
            best = (p, text, ns, full)

    return best

def class_detail(project_id: str, class_name: str):
    status = source_status(project_id)
    if not status["ready"]:
        return {
            "available": False,
            "message": "还没有生成 C# 源码。请先点击“反编译 C#”。",
            **status,
        }

    found = find_class_file(project_id, class_name)
    if not found:
        return {
            "available": False,
            "message": f"在重建源码中没有定位到类：{class_name}",
            **status,
        }

    p, text, namespace, full_name = found
    native_root = get_project_root(project_id) / "analysis" / "isil-focused" / "IsilDump"
    native_matches = list(native_root.rglob(_simple_name(class_name) + ".txt")) if native_root.exists() else []
    native_file = native_matches[0] if native_matches else None
    native_text = _read_file(native_file)[:500_000] if native_file else ""

    methods = []
    for m in METHOD_RE.finditer(text):
        body = _method_body(text, m.end())
        methods.append({
            "return_type": " ".join(m.group(1).split()),
            "name": m.group(2),
            "parameters": " ".join(m.group(3).split()),
            "quality": _body_quality(body),
            "body_chars": len(body.strip()) if body is not None else 0,
        })

    fields = []
    for m in FIELD_RE.finditer(text):
        fields.append({
            "type": " ".join(m.group(1).split()),
            "name": m.group(2),
        })

    # 避免极端单文件把浏览器一次塞入过多文本。
    max_chars = 250_000
    truncated = len(text) > max_chars
    source = text[:max_chars]

    return {
        "available": True,
        "name": class_name,
        "resolved_name": full_name,
        "namespace": namespace,
        "file": str(p),
        "methods": methods[:500],
        "fields": fields[:500],
        "method_count": len(methods),
        "quality": _quality_summary(methods),
        "native_available": bool(native_file),
        "native_file": str(native_file) if native_file else "",
        "native_disassembly": native_text,
        "field_count": len(fields),
        "source": source,
        "truncated": truncated,
        **status,
    }
