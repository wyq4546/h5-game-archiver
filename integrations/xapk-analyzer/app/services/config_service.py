import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
CONFIG_PATH = BASE / "config.json"

def get_config():
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

def save_config(data):
    CONFIG_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
