from __future__ import annotations

from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, Dict
import subprocess
import threading
import time
import uuid
import os

TASKS: Dict[str, "ProcessTask"] = {}
LOCK = threading.Lock()

@dataclass
class ProcessTask:
    task_id: str
    args: list[str]
    cwd: Path
    log_path: Path
    process: Optional[subprocess.Popen] = None
    status: str = "pending"  # pending/running/waiting_input/done/failed/stopped
    exit_code: Optional[int] = None
    started_at: float = field(default_factory=time.time)
    ended_at: Optional[float] = None
    wait_kind: Optional[str] = None
    log_text: str = ""
    error: Optional[str] = None
    index_built: bool = False
    index_result: Optional[dict] = None
    _finalize_lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    _thread: Optional[threading.Thread] = None

    def elapsed(self) -> int:
        end = self.ended_at or time.time()
        return max(0, int(end - self.started_at))

def _decode(data: bytes) -> str:
    if not data:
        return ""
    for enc in ("utf-8", "gb18030", "cp936"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            pass
    return data.decode("utf-8", errors="replace")

def _detect_wait_kind(text: str) -> Optional[str]:
    low = text.lower()
    if "input il2cpp dump address or input 0 to force continue" in low:
        return "dump_address"
    if "input coderegistration" in low:
        return "code_registration"
    if "input metadataregistration" in low:
        return "metadata_registration"
    return None

def _reader_loop(task: ProcessTask):
    try:
        task.status = "running"
        task.log_path.parent.mkdir(parents=True, exist_ok=True)
        with task.log_path.open("w", encoding="utf-8", errors="ignore") as logf:
            while True:
                if task.process is None:
                    break

                chunk = task.process.stdout.readline()
                if chunk:
                    text = _decode(chunk)
                    task.log_text += text
                    task.log_text = task.log_text[-200000:]
                    logf.write(text)
                    logf.flush()

                    wait = _detect_wait_kind(task.log_text)
                    if wait and task.process.poll() is None:
                        task.wait_kind = wait
                        task.status = "waiting_input"
                else:
                    if task.process.poll() is not None:
                        break
                    time.sleep(0.05)

        code = task.process.wait()
        task.exit_code = code
        task.ended_at = time.time()

        if task.status == "stopped":
            return
        task.wait_kind = None
        task.status = "done" if code == 0 else "failed"

    except Exception as e:
        task.error = str(e)
        task.status = "failed"
        task.ended_at = time.time()

def start_process(args, cwd: Path, log_path: Path, env: Optional[dict] = None) -> ProcessTask:
    task_id = uuid.uuid4().hex[:12]
    task = ProcessTask(task_id=task_id, args=[str(x) for x in args], cwd=cwd, log_path=log_path)

    proc = subprocess.Popen(
        [str(x) for x in args],
        cwd=str(cwd),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=0,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        env=env,
    )
    task.process = proc

    t = threading.Thread(target=_reader_loop, args=(task,), daemon=True)
    task._thread = t

    with LOCK:
        TASKS[task_id] = task
    t.start()
    return task

def get_task(task_id: str) -> ProcessTask:
    with LOCK:
        task = TASKS.get(task_id)
    if not task:
        raise KeyError(task_id)
    return task

def send_input(task_id: str, text: str):
    task = get_task(task_id)
    if not task.process or task.process.poll() is not None:
        raise RuntimeError("任务已经结束，无法继续输入")
    if task.process.stdin is None:
        raise RuntimeError("任务 stdin 不可用")

    data = (text.rstrip("\r\n") + "\n").encode("utf-8")
    task.process.stdin.write(data)
    task.process.stdin.flush()
    task.wait_kind = None
    task.status = "running"

def stop_task(task_id: str):
    task = get_task(task_id)
    if task.process and task.process.poll() is None:
        task.status = "stopped"
        try:
            task.process.kill()
        except Exception:
            pass
        task.ended_at = time.time()
    return task

def task_payload(task: ProcessTask):
    return {
        "task_id": task.task_id,
        "status": task.status,
        "exit_code": task.exit_code,
        "elapsed_seconds": task.elapsed(),
        "wait_kind": task.wait_kind,
        "log_text": task.log_text[-50000:],
        "error": task.error,
    }
