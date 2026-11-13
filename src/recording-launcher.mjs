import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync, appendFileSync } from "node:fs";
import { format } from "node:util";

export async function askStartLevel(input = process.stdin, output = process.stdout) {
  const lines = createInterface({ input, output, terminal: Boolean(input.isTTY) });
  const prompt = () => output.write("请输入起始关卡（直接回车从第 1 关开始）：");
  try {
    prompt();
    for await (const line of lines) {
      const value = line.trim() || "1";
      const level = Number(value);
      if (/^\d+$/.test(value) && Number.isInteger(level) && level >= 1 && level <= 2147483647) return level;
      output.write("关卡号必须是 1～2147483647 的整数，请重新输入。\n");
      prompt();
    }
    return null;
  } finally {
    lines.close();
  }
}

export async function launchRecording(entry, { equals = false, recordFlag = "--record" } = {}) {
  const optionIndex = process.argv.indexOf("--start-level");
  const level = optionIndex >= 0 ? Number(process.argv[optionIndex + 1]) : await askStartLevel();
  if (level === null) return;
  if (!Number.isInteger(level) || level < 1 || level > 2147483647) throw new Error("起始关卡必须是正整数");
  const scripts = path.resolve(path.dirname(fileURLToPath(entry)), "..");
  const logs = path.join(scripts, "logs");
  mkdirSync(logs, { recursive: true });
  const file = path.join(logs, `recording-${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}.log`);
  for (const method of ["log", "warn", "error"]) {
    const original = console[method].bind(console);
    console[method] = (...args) => {
      appendFileSync(file, format(...args) + "\n");
      original(...args);
    };
  }
  console.log(`从第 ${level} 关开始录制；每关一个 MP4，保存到 scripts\\video\\recording-时间戳。`);
  console.log("后台录制不弹出游戏窗口，可切换软件或最小化命令行；按 Ctrl+C 停止。");
  const forwardedArgs = process.argv.slice(2).filter((arg, i, arr) => {
    if (arg === "--start-level" || (i > 0 && arr[i - 1] === "--start-level")) return false;
    if (arg.startsWith("--start-level=")) return false;
    if (arg === recordFlag) return false;
    return true;
  });
  process.argv = [process.execPath, fileURLToPath(entry), recordFlag,
    ...(equals ? [`--start-level=${level}`] : ["--start-level", String(level)]),
    ...forwardedArgs];
  await import(entry.href);
}
