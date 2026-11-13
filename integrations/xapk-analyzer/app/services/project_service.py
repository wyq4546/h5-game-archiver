from pathlib import Path
import json
import uuid

BASE = Path(__file__).resolve().parents[2]
WORKSPACE = BASE / "workspace"
WORKSPACE.mkdir(exist_ok=True)

def create_project(filename: str):
    project_id = uuid.uuid4().hex[:12]
    root = WORKSPACE / project_id
    for name in ["input", "unpacked", "analysis", "exports", "logs"]:
        (root / name).mkdir(parents=True, exist_ok=True)

    meta = {"project_id": project_id, "filename": filename}
    (root / "project.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    return project_id, root

def get_project_root(project_id: str):
    root = WORKSPACE / project_id
    if not root.exists():
        raise FileNotFoundError(project_id)
    return root

def list_projects():
    rows = []
    for d in sorted(WORKSPACE.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if not d.is_dir():
            continue
        p = d / "project.json"
        if p.exists():
            try:
                rows.append(json.loads(p.read_text(encoding="utf-8")))
            except Exception:
                pass
    return rows
