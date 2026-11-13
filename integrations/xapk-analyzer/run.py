import json
from pathlib import Path
import uvicorn

BASE = Path(__file__).resolve().parent
config = json.loads((BASE / "config.json").read_text(encoding="utf-8"))

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=config.get("host", "127.0.0.1"),
        port=int(config.get("port", 9999)),
        reload=False,
    )
