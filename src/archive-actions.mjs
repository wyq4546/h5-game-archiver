import { realpath, access, readFile, mkdir } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import { execFile, spawn, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
const runFile = promisify(execFile);

function within(root, target) {
  const relative = path.relative(root, target);
  return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
export async function resolveArchiveDirectory(downloadRoot, name) {
  if (!name || name === '.' || name === '..' || /[\\/]/.test(name)) throw new Error('归档名称无效');
  const base = await realpath(downloadRoot);
  const root = await realpath(path.join(base, name));
  if (!within(base, root)) throw new Error('归档路径超出 download 目录');
  await access(path.join(root, 'archive', 'manifest.json'));
  return root;
}
export async function readArchivePreview(downloadRoot, name) {
  const root = await resolveArchiveDirectory(downloadRoot, name);
  const file = await realpath(path.join(root, 'preview', 'local.png'));
  if (!within(root, file)) throw new Error('预览路径超出归档目录');
  return readFile(file);
}
// 封面缺位时的兜底：优先用离线回放截图，其次用抓取结束截图。
// 只在响应时读取，不写回 cover，避免占位图覆盖之后补抓的真实封面。
export async function readArchiveScreenshot(downloadRoot, name) {
  const root = await resolveArchiveDirectory(downloadRoot, name);
  for (const file of ['local.png', 'capture-end.png']) {
    try {
      const target = await realpath(path.join(root, 'preview', file));
      if (!within(root, target)) continue;
      const bytes = await readFile(target);
      if (bytes.length > 8 && bytes[0] === 0x89 && bytes.toString('ascii', 1, 4) === 'PNG') return { bytes, file };
    } catch {}
  }
  throw new Error('暂无游戏截图');
}
export async function openArchiveFolder(downloadRoot, name) {
  const root = await resolveArchiveDirectory(downloadRoot, name);
  if (process.platform !== 'win32') throw new Error('打开文件夹目前仅支持 Windows');
  const script = fileURLToPath(new URL('../scripts/open-archive-folder.ps1', import.meta.url));
  const {stdout} = await runFile('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Folder',root], {windowsHide:true,timeout:15000,maxBuffer:65536});
  const result = JSON.parse(stdout.trim());
  if (!result.opened) throw new Error('未找到对应的资源管理器窗口');
  return result;
}
export async function openVideoFolder(downloadRoot, name) {
  const root = await resolveArchiveDirectory(downloadRoot, name);
  if (process.platform !== 'win32') throw new Error('打开文件夹目前仅支持 Windows');
  const videoDir = path.join(root, 'scripts', 'video');
  await mkdir(videoDir, { recursive: true });
  const script = fileURLToPath(new URL('../scripts/open-archive-folder.ps1', import.meta.url));
  const {stdout} = await runFile('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Folder',videoDir], {windowsHide:true,timeout:15000,maxBuffer:65536});
  const result = JSON.parse(stdout.trim());
  if (!result.opened) throw new Error('未找到对应的资源管理器窗口');
  return result;
}

export const activeGameRecordings = new Map();
const startingGameRecordings = new Map();

export function isGameRecording(name) {
  return activeGameRecordings.has(name);
}

export function startGameRecording(downloadRoot, name, scheduledMap) {
  const active = activeGameRecordings.get(name);
  if (active) return Promise.resolve({ pid: active.pid, alreadyRunning: true });
  const starting = startingGameRecordings.get(name);
  if (starting) return starting.then(result => ({ ...result, alreadyRunning: true }));
  const pending = launchGameRecording(downloadRoot, name, scheduledMap);
  startingGameRecordings.set(name, pending);
  return pending.finally(() => startingGameRecordings.delete(name));
}

async function launchGameRecording(downloadRoot, name, scheduledMap) {
  const root = await resolveArchiveDirectory(downloadRoot, name);
  const sched = scheduledMap?.get?.(name);

  let cwd;
  let args;

  if (sched) {
    cwd = path.resolve(downloadRoot, '..', sched.cwdRel);
    args = [...sched.args];
  } else {
    const dedicated=['record-runs.mjs','record-levels.mjs'].map(file=>path.join(root,'scripts','internal',file)).find(existsSync);
    const internalRun = path.join(root, 'scripts', 'internal', 'run-auto.mjs');
    const localRun = path.join(root, 'scripts', 'run-auto.mjs');
    if(dedicated){
      cwd=root;args=[path.relative(root,dedicated)];
    } else if (existsSync(internalRun)) {
      if(!(await readFile(internalRun,'utf8')).includes('createVideoRecorder'))throw new Error(`游戏「${name}」现有脚本只支持游玩，尚未提供视频录制入口`);
      cwd = path.join(root, 'scripts');
      args = ['internal/run-auto.mjs', '--record'];
    } else if (existsSync(localRun)) {
      cwd = path.join(root, 'scripts');
      if(!(await readFile(localRun,'utf8')).includes('createVideoRecorder'))throw new Error(`游戏「${name}」现有脚本只支持游玩，尚未提供视频录制入口`);
      args = ['run-auto.mjs', '--record'];
    } else {
      throw new Error(`未找到游戏「${name}」的自动化录制脚本`);
    }
  }

  const logsDir = path.resolve(downloadRoot, '../data/logs');
  await mkdir(logsDir, { recursive: true });
  const logFile = path.join(logsDir, `record-${name}.log`);
  const logStream = createWriteStream(logFile, { flags: 'a' });

  const child = spawn(process.execPath, args, {
    cwd,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  const recording = {
    pid: child.pid,
    process: child,
    startedAt: new Date().toISOString()
  };

  const cleanup = () => {
    if (activeGameRecordings.get(name) === recording) activeGameRecordings.delete(name);
    try { logStream.end(); } catch {}
  };
  child.once('exit', cleanup);
  try {
    await once(child, 'spawn');
    activeGameRecordings.set(name, recording);
  } catch (error) {
    cleanup();
    throw error;
  }

  return { pid: child.pid };
}

export async function stopGameRecording(downloadRoot, name) {
  let stopped = false;
  const active = activeGameRecordings.get(name);
  if (active && active.process) {
    try {
      execSync(`taskkill /pid ${active.pid} /t /f`, { windowsHide: true });
      stopped = true;
    } catch {}
    activeGameRecordings.delete(name);
  }

  try {
    const ps = `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*${name}*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
    await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 5000 });
    stopped = true;
  } catch {}

  return { ok: true, stopped };
}
