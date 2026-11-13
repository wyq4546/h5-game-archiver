import { mkdir, rename, rm, stat, access, readFile, writeFile, truncate } from "node:fs/promises";
import {createHash} from 'node:crypto';
import {recordingDataDirectory,ensureArchiveRecordingDirectory} from './recording-layout.mjs';
import {fileURLToPath} from 'node:url';
import { createVideoChunkWriter } from './video-chunk-writer.mjs';
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { createFrameRateMonitor } from './recording-runtime.mjs';
export { resolveBrowserOptions, createFrameRateMonitor } from './recording-runtime.mjs';

const exec = promisify(execFile);
// 临时 webm 的清理绝不能影响成败判定：宿主的批量删除护栏在单轮删除量到达阈值时会抛错，
// 一旦把这个异常当成"导出失败"，就会把已经导出成功的成片再重录 8 遍，
// 还会因为异常发生在改名之后、规范化之前，产出一堆 -attempt-N.mp4（第 61 关就是这么废掉的）。
const dropQuiet = async (file) => {
  if (!file) return true;
  try {
    await rm(file, { force: true });
    return true;
  } catch (error) {
    try {
      await truncate(file, 0); // 删不掉就清空占位，至少不占磁盘
      console.warn(`[录制] 临时文件删除被拦截，已清空占位：${path.basename(file)}（${error.message.split('：')[0]}）`);
    } catch (inner) {
      console.warn(`[录制] 临时文件未能清理：${path.basename(file)}`);
    }
    return false;
  }
};
const ffmpeg = () => process.env.GAME_FFMPEG || "ffmpeg";
const ffprobe = () => process.env.GAME_FFPROBE || "ffprobe";
let ffprobeAvailable = null;
async function isFfprobeAvailable() {
  if (ffprobeAvailable !== null) return ffprobeAvailable;
  try {
    await exec(ffprobe(), ['-version'], { windowsHide: true, timeout: 1500 });
    ffprobeAvailable = true;
  } catch {
    ffprobeAvailable = false;
  }
  return ffprobeAvailable;
}
const recorderSourceFiles=['game-video-recorder.mjs','recording-runtime.mjs','video-chunk-writer.mjs','recording-layout.mjs'];
const recorderSourceBytes=await Promise.all(recorderSourceFiles.map(name=>readFile(new URL(name,import.meta.url))));
const recorderFingerprint=createHash('sha256');recorderSourceFiles.forEach((name,i)=>recorderFingerprint.update(name+'\0').update(recorderSourceBytes[i]));
const recorderSourceSha256=recorderFingerprint.digest('hex');
const diagnosticRateProfile = Object.freeze({
  name: 'h264-diagnostic-4m-max5m-v1', captureHintBitsPerSecond: 4_000_000,
  outputTargetBitsPerSecond: 4_000_000, outputMaxBitsPerSecond: 5_000_000, outputBufferBits: 10_000_000
});

async function inspectEncodedFrames(input, trimHeadSeconds, cutAt, { diagnostic = false } = {}) {
  const method = diagnostic ? 'ffprobe-video-packet-pts-sorted' : 'ffprobe-decoded-frame-best-effort-timestamp';
  const args = diagnostic
    ? ['-v','error','-select_streams','v:0','-show_packets','-show_entries','packet=pts_time','-of','json',input]
    : ['-v','error','-threads','1','-select_streams','v:0','-show_entries','frame=best_effort_timestamp_time','-of','json',input];
  let all;
  if (await isFfprobeAvailable()) {
    try {
      const {stdout}=await exec(ffprobe(),args,{windowsHide:true,maxBuffer:16*1024*1024});
      const parsed=JSON.parse(stdout);
      all=(diagnostic ? parsed.packets : parsed.frames)
        .map(item=>Number(diagnostic ? item.pts_time : item.best_effort_timestamp_time))
        .filter(Number.isFinite).filter(t=>t>=trimHeadSeconds&&(cutAt==null||t<=trimHeadSeconds+cutAt));
      if(diagnostic) all.sort((a,b)=>a-b);
    } catch {}
  }
  if (!all) {
    const {stderr} = await exec(ffmpeg(), ['-threads', '2', '-i', input, '-vf', 'showinfo', '-f', 'null', '-'], {windowsHide:true, maxBuffer:32*1024*1024});
    all = [];
    for (const m of stderr.matchAll(/pts_time:\s*([\d.]+)/g)) {
      const t = Number(m[1]);
      if (Number.isFinite(t) && t >= trimHeadSeconds && (cutAt == null || t <= trimHeadSeconds + cutAt)) {
        all.push(t);
      }
    }
    if (diagnostic) all.sort((a, b) => a - b);
  }
  const times=all.filter(t=>t<=trimHeadSeconds+2);
  if(times.length<2)throw Error(diagnostic ? '录制开头没有足够的视频包时间戳' : '录制开头没有足够的原始编码帧');
  const firstAtMs=Math.max(0,(all[0]-trimHeadSeconds)*1000);
  const boundary={at:0,ms:firstAtMs,kind:diagnostic ? 'logical-start-to-first-packet' : 'logical-start-to-first-frame'};
  const gaps=[boundary,...times.slice(1).map((t,i)=>({at:times[i]-trimHeadSeconds,ms:(t-times[i])*1000}))];
  const fullGaps=[boundary,...all.slice(1).map((t,i)=>({at:all[i]-trimHeadSeconds,ms:(t-all[i])*1000}))];
  const max=(items)=>items.reduce((v,g)=>Math.max(v,g.ms),0);
  const durationSeconds=all.at(-1)-all[0], rate=(all.length-1)/durationSeconds;
  return {opening:{method,...(diagnostic ? {packets:times.length,firstPacketAtMs:firstAtMs} : {frames:times.length,firstFrameAtMs:firstAtMs}),maxGapMs:max(gaps),gaps:gaps.filter(g=>g.ms>48.1)},
    full:{method,...(diagnostic ? {packets:all.length,averagePacketRate:rate} : {frames:all.length,averageEncodedFps:rate}),durationSeconds,maxGapMs:max(fullGaps),gaps:fullGaps.filter(g=>g.ms>48.1),
      note:diagnostic ? 'Sorted video packet PTS before CFR; packet timing is informational and does not prove decoded-frame continuity. Final decoding and black-screen verification remain required.' : 'Raw encoder timestamps before CFR; gaps and frame rate require native motion/idle correlation.'}};
}

export const recordingBrowserArgs = ["--disable-background-timer-throttling", "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "--autoplay-policy=no-user-gesture-required",
  "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--enable-zero-copy", "--mute-audio",
  "--use-gl=angle", "--use-angle=d3d11"];

export function recordingDirectory(scripts) {
  return path.join(scripts, "video", `recording-${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}`);
}

let nvencSupported = null;

async function checkNvencSupport() {
  if (process.env.GAME_DISABLE_NVENC !== '0' && (process.env.GAME_DISABLE_NVENC || process.env.GAME_FORCE_LIBX264 || true)) return false;
  if (nvencSupported !== null) return nvencSupported;
  try {
    const { stdout } = await exec(ffmpeg(), ["-hide_banner", "-encoders"], { windowsHide: true });
    nvencSupported = /\bh264_nvenc\b/.test(stdout);
  } catch {
    nvencSupported = false;
  }
  return nvencSupported;
}

async function exportPublishingVideo(input, output, cutAt, fps, speed = 1.0, trimHeadSeconds = 0, outputWidth = 1080, outputHeight = 1920, rateControl = null, blurredBackground = false) {
  const hasNvenc = await checkNvencSupport();
  const bitrateArgs = rateControl ? ["-b:v", String(rateControl.outputTargetBitsPerSecond),
    "-maxrate", String(rateControl.outputMaxBitsPerSecond), "-bufsize", String(rateControl.outputBufferBits)] : [];
  let outputEncoder = hasNvenc ? 'h264_nvenc' : 'libx264';
  const videoCodecArgs = hasNvenc
    ? ["-c:v", "h264_nvenc", "-preset", "p4", ...(rateControl ? ["-rc", "vbr", ...bitrateArgs] : ["-cq", "20"])]
    : ["-c:v", "libx264", "-preset", "fast", ...(rateControl ? bitrateArgs : ["-crf", "18"]), "-threads", process.env.GAME_FFMPEG_THREADS || "4"];

  const filterArgs = [];
  if (blurredBackground) {
    const pts = (speed && speed !== 1.0) ? `setpts=${(1 / speed).toFixed(6)}*PTS,` : '';
    const filterComplex = `[0:v]${pts}split=2[front][back];` +
      `[back]scale=${Math.round(outputWidth / 4)}:${Math.round(outputHeight / 4)}:force_original_aspect_ratio=increase,crop=${Math.round(outputWidth / 4)}:${Math.round(outputHeight / 4)},boxblur=20:2,eq=brightness=-0.14:saturation=0.75,scale=${outputWidth}:${outputHeight}:flags=bilinear[bg];` +
      `[front]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease:flags=lanczos[fg];` +
      `[bg][fg]overlay=0:(H-h)/2:shortest=1,setsar=1[v_out]`;
    filterArgs.push("-filter_complex", filterComplex, "-map", "[v_out]", "-map", "0:a:0?");
  } else {
    const speedFilters = [];
    if (speed && speed !== 1.0) {
      speedFilters.push(`setpts=${(1 / speed).toFixed(6)}*PTS`);
    }
    const vf = [
      ...speedFilters,
      `scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1`
    ].join(',');
    filterArgs.push("-map", "0:v:0", "-map", "0:a:0?", "-vf", vf);
  }

  const af = (speed && speed !== 1.0) ? ["-af", `atempo=${speed}`] : [];
  const outputDuration = cutAt > 0 ? (speed && speed !== 1.0 ? cutAt / speed : cutAt) : null;

  try {
    await exec(ffmpeg(), ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-i", input,
      ...(trimHeadSeconds > 0 ? ["-ss", trimHeadSeconds.toFixed(6)] : []),
      ...(outputDuration ? ["-t", outputDuration.toFixed(6)] : []),
      ...filterArgs,
      ...af,
      "-r", String(fps), "-fps_mode", "cfr", ...videoCodecArgs,
      "-color_range", "tv", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
      "-movflags", "+faststart", output], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  } catch (error) {
    if (hasNvenc) {
      console.warn(`[VideoRecorder] NVENC 转码失败，正在回退至 CPU libx264: ${error.message}`);
      nvencSupported = false;
      outputEncoder = 'libx264';
      await rm(output, { force: true });
      await exec(ffmpeg(), ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-i", input,
        ...(trimHeadSeconds > 0 ? ["-ss", trimHeadSeconds.toFixed(6)] : []),
        ...(outputDuration ? ["-t", outputDuration.toFixed(6)] : []),
        ...filterArgs,
        ...af,
        "-r", String(fps), "-fps_mode", "cfr", "-c:v", "libx264", "-preset", "fast", ...(rateControl ? bitrateArgs : ["-crf", "18"]),
        "-color_range", "tv", "-pix_fmt", "yuv420p", "-threads", process.env.GAME_FFMPEG_THREADS || "4", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart", output], { windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    } else {
      throw error;
    }
  }
  return { outputEncoder };
}

export async function checkVideoTools() {
  try {
    const { stdout } = await exec(ffmpeg(), ["-hide_banner", "-encoders"], { windowsHide: true });
    if (!/\baac\b/.test(stdout)) throw new Error("缺少 AAC 编码器");
    if (!/\blibx264\b/.test(stdout) && !/\bh264_nvenc\b/.test(stdout)) throw new Error("缺少 H.264 编码器 (libx264 或 h264_nvenc)");
    nvencSupported = /\bh264_nvenc\b/.test(stdout);
  } catch (error) {
    throw new Error(`MP4 录制需要 FFmpeg（含 H.264/AAC），请安装后加入 PATH，或设置 GAME_FFMPEG 为 ffmpeg.exe 完整路径：${error.message}`);
  }
}

// Mirror the game's Web Audio output. No microphone or desktop audio is used.
export function installGameAudioCapture() {
  if (globalThis.__gameAudioCapture || !globalThis.AudioNode) return;
  const destinations = new Map();
  globalThis.__gameAudioCapture = destinations;
  const NativeAudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  const CapturedAudioContext = new Proxy(NativeAudioContext, {
    construct(target, args, newTarget) {
      const context = Reflect.construct(target, args, newTarget);
      // Create the track before gameplay makes its first sound, so the opening
      // of the very first level is not silently recorded without an audio track.
      const destination = context.createMediaStreamDestination();
      // Keep the capture track clock alive even before the game's first sound.
      // An unconnected destination produces no audio packets and stalls WebM.
      const silence = context.createConstantSource();
      silence.offset.value = 0;
      silence.connect(destination);
      silence.start();
      destinations.set(context, destination);
      return context;
    },
  });
  globalThis.AudioContext = CapturedAudioContext;
  if (globalThis.webkitAudioContext === NativeAudioContext) globalThis.webkitAudioContext = CapturedAudioContext;
  const connect = AudioNode.prototype.connect;
  const disconnect = AudioNode.prototype.disconnect;
  AudioNode.prototype.connect = function (destination, ...ports) {
    const result = connect.call(this, destination, ...ports);
    if (destination === this.context.destination && this.context.createMediaStreamDestination) {
      let tap = destinations.get(this.context);
      if (!tap) {
        tap = this.context.createMediaStreamDestination();
        destinations.set(this.context, tap);
      }
      connect.call(this, tap, ...ports);
    }
    return result;
  };
  AudioNode.prototype.disconnect = function (...args) {
    const result = disconnect.apply(this, args);
    if (args[0] === this.context.destination) {
      const tap = destinations.get(this.context);
      if (tap) { try { disconnect.call(this, tap, ...args.slice(1)); } catch {} }
    }
    return result;
  };
}

export async function createVideoRecorder(page, {
  directory,
  frame = page,
  fps = 60,
  captureEveryFrame = true,
  deferChunkWrites = true,
  speed = 1.0,
  preferredMimeTypes = [
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=h264',
    'video/webm;codecs=avc1,opus',
    'video/webm;codecs=avc1',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9'
  ],
  encoderWarmupMs = 1500,
  outputWidth = 1080,
  outputHeight = 1920,
  blurredBackground = false,
  maxDeferredBytes = 256 * 1024 * 1024,
  recordingMode = 'formal',
  deferredFlushBytes = 0,
  chunkTransport = process.env.GAME_CHUNK_TRANSPORT || 'pull'
}) {
  if(!['formal','diagnostic'].includes(recordingMode))throw new TypeError('recordingMode 必须为 formal 或 diagnostic');
  const diagnostic=recordingMode==='diagnostic';
  if(!['binding','pull'].includes(chunkTransport))throw new TypeError('Unknown chunk transport');
  if(chunkTransport==='pull'&&(!deferChunkWrites||deferredFlushBytes!==0))throw new Error('Pull transport requires bounded full deferred capture');
  if(captureEveryFrame!==true||(!diagnostic&&fps!==60)||(diagnostic&&fps!==30))throw Error('正式输出必须60 FPS、诊断输出必须30 FPS；均须无参逐绘制帧采集');
  if (![outputWidth,outputHeight].every(n=>Number.isSafeInteger(n)&&n>0&&n%2===0))throw new TypeError('输出尺寸必须为正偶数像素');
  if (!Number.isSafeInteger(maxDeferredBytes) || maxDeferredBytes < 1) throw new TypeError('maxDeferredBytes 必须为正整数');
  if (!Number.isSafeInteger(deferredFlushBytes) || deferredFlushBytes < 0 || deferredFlushBytes > maxDeferredBytes) throw new TypeError('deferredFlushBytes 必须为不超过缓冲上限的非负整数');
  if (deferredFlushBytes && (!diagnostic || !deferChunkWrites)) throw new Error('周期缓冲写入仅供逐绘制帧诊断录制');
  // Chromium's off-the-record Blob backend has a 2 GiB memory quota. Keep
  // diagnostic writes well below it, even when the requested clip cap is larger.
  const effectiveMaxDeferredBytes = diagnostic && deferredFlushBytes ? Math.min(maxDeferredBytes, 1024 * 1024 * 1024) : maxDeferredBytes;
  if (deferredFlushBytes > effectiveMaxDeferredBytes) throw new TypeError('deferredFlushBytes 不能超过实际待写缓冲上限');
  const legacyReview = diagnostic && path.basename(path.resolve(directory)).startsWith('review-');
  if (legacyReview) {
    const legacy = JSON.parse(await readFile(path.join(recordingDataDirectory(directory), 'report.json'), 'utf8'));
    if (legacy.mode !== 'diagnostic-record' || path.resolve(legacy.directory) !== path.resolve(directory)) throw Error('review 仅兼容续录已有诊断批次；新录像必须使用 recording-完整UTC时间戳');
  }
  directory=await ensureArchiveRecordingDirectory(fileURLToPath(new URL('../',import.meta.url)),directory,{kind:legacyReview?'review':'recording'});
  if (!Array.isArray(preferredMimeTypes) || preferredMimeTypes.some(value => typeof value !== 'string')) {
    throw new TypeError('preferredMimeTypes must be an array of MIME strings');
  }
  if(!Number.isFinite(encoderWarmupMs)||encoderWarmupMs<1500)throw new TypeError('encoderWarmupMs must be finite and at least 1500 ms');
  try {
    const b = page.context?.().browser?.();
    if (b) {
      const { prioritizeOwnedBrowser } = await import('./browser-priority.mjs');
      await prioritizeOwnedBrowser(b);
    }
  } catch {}
  const dataDirectory=recordingDataDirectory(directory);
  await mkdir(directory, { recursive: true });
  const recorderSourceDirectory=path.join(dataDirectory,'source','recorder-'+recorderSourceSha256);
  await mkdir(recorderSourceDirectory,{recursive:true});
  for(let i=0;i<recorderSourceFiles.length;i++)await writeFile(path.join(recorderSourceDirectory,recorderSourceFiles[i]),recorderSourceBytes[i]);
  let current = null;
  let checkingHealth = false;
  const healthMonitor = setInterval(async () => {
    const clip = current;
    if (!clip || !clip.armed || !clip.measure || clip.healthError || checkingHealth) return;
    checkingHealth = true;
    try {
      // Route planning runs as one long synchronous block in the page (tens of
      // thousands of A* expansions on the big levels), so the render loop cannot
      // tick and the frame counter legitimately stalls. A live "planning" boolean
      // is useless here — this very evaluate() queues behind the blocked main
      // thread and only runs once planning is over. Read the accumulated duration
      // instead and subtract it from the interval being judged. Level 43 aborted
      // with "录制刷新持续约 10 秒低于 15 FPS" while the game itself was healthy
      // (run-2026-09-14T09-34-49-976Z / 12-16-35-520Z).
      const sample = await frame.evaluate(() => {
        const state = globalThis.__gameVideoRecording;
        if (state?.error) return { error: { message: state.error.stack || state.error.message || String(state.error), code: state.error.code } };
        return state && state.recorder.state !== 'inactive'
          ? { time: performance.now() - state.startedAt, frames: state.frames, planning: !!globalThis.__gbPlanning, planningMs: globalThis.__gbPlanningMs || 0 } : null;
      });
      if (!sample || current !== clip) return;
      if (sample.error) {
        clip.healthError = Object.assign(new Error(sample.error.message), { code: sample.error.code });
        clip.rejectFailure(clip.healthError);
        return;
      }
      const health = clip.measure(sample.time, sample.frames, sample.planningMs);
      if (health.tooSlow && !diagnostic) {
        clip.healthError = new Error(`录制刷新持续约 10 秒低于 15 FPS（当前 ${health.fps.toFixed(1)} FPS），已停止；请检查系统负载，使用默认后台录制入口重新录制本关。`);
        clip.rejectFailure(clip.healthError);
      } else if (health.fps !== null && health.fps < 59 && sample.time - clip.lastHealthLog >= 5000) {
        // 只在刷新率掉出 59 FPS 基线时告警；正常录制不再每 5 秒刷屏（成片末尾仍会打印平均值）。
        clip.lastHealthLog = sample.time;
        console.log(`[录制] ${clip.stem} 刷新率偏低 ${health.fps.toFixed(1)} FPS`);
      }
    } catch (error) {
      if (current === clip && !page.isClosed()) {
        clip.healthError = new Error(`无法检查录制刷新：${error.message}`);
        clip.rejectFailure(clip.healthError);
      }
    } finally { checkingHealth = false; }
  }, 2000);
  if (page.__activeGameVideoRecorderHealthMonitor) {
    clearInterval(page.__activeGameVideoRecorderHealthMonitor);
  }
  page.__activeGameVideoRecorderHealthMonitor = healthMonitor;
  healthMonitor.unref();
  page.once("close", () => clearInterval(healthMonitor));
  let writes = Promise.resolve();
  let writeError = null;

  page.__activeGameVideoRecorderChunkHandler = base64 => {
    if (!current) return;
    const clip = current;
    writes = writes.then(() => clip.writer.write(Buffer.from(base64, "base64")));
    // Handle immediately even if the browser closes before finish awaits it.
    writes.catch(error => {
      writeError = error;
      clip.healthError = error;
      clip.rejectFailure(error);
    });
    return writes;
  };

  if(chunkTransport==='binding')await page.exposeFunction("__gameWriteVideoChunk", base64 => {
    return page.__activeGameVideoRecorderChunkHandler?.(base64);
  }).catch(error => {
    if (!error.message?.includes("already registered")) throw error;
  });

  return {
    get active() { return current !== null; },
    get failure() { return current?.failure; },
    assertHealthy() { if (current?.healthError) throw current.healthError; },
    // Prepare while native gameplay is idle. Keep THIS encoder alive through
    // the take; stopping a disposable warm-up recorder reintroduces cold start.
    async prepare(level, { endWhen = null, warmAllCodecs = true, nativeStart = null } = {}) {
      if (current) throw new Error("上一段视频尚未保存");
      if (nativeStart && (!Number.isSafeInteger(nativeStart.expectedLevel) || nativeStart.expectedLevel < 1 ||
          !['function', 'string'].includes(typeof nativeStart.source) ||
          !Number.isFinite(nativeStart.maxGapMs ?? 42.0) || (nativeStart.maxGapMs ?? 42.0) <= 0 || (nativeStart.maxGapMs ?? 42.0) > 42.0)) {
        throw new TypeError('nativeStart 必须包含真实 expectedLevel、只读 source 和不超过 42.0 ms 的采样间隔');
      }
      const nativeStartConfig = nativeStart ? { expectedLevel: nativeStart.expectedLevel, source: nativeStart.source.toString(), maxGapMs: nativeStart.maxGapMs ?? 42.0 } : null;
      const base = `level-${String(level).padStart(6, "0")}`;
      let stem = base;
      for (let attempt = 2; ; attempt += 1) {
        const used = await Promise.all([`${stem}.mp4`, `${stem}-partial.mp4`, `.${stem}.capture.webm`]
          .map(name => access(path.join(directory, name)).then(() => true, () => false)));
        if (!used.some(Boolean)) break;
        stem = `${base}-attempt-${attempt}`;
      }
      const raw = path.join(directory, `.${stem}.capture.webm`);
      const file = path.join(directory, `${stem}.mp4`);
      if (await access(file).then(() => true, () => false)) throw new Error(`视频已存在，请换一个录制目录：${file}`);
      const writer = await createVideoChunkWriter(raw);
      current = { raw, file, stem, writer, level, armed: false };
      current.failure = new Promise((_, reject) => { current.rejectFailure = reject; });
      current.failure.catch(() => {});
      current.lastHealthLog = 0;
      writes = Promise.resolve();
      writeError = null;
      const info = await frame.evaluate(async ({ endWhen, fps, captureEveryFrame, deferChunkWrites, preferredMimeTypes, encoderWarmupMs, warmAllCodecs, maxDeferredBytes, effectiveMaxDeferredBytes, deferredFlushBytes, nativeStart, rateControl }) => {
        const canvas = [
          document.getElementById("layaCanvas"),
          document.getElementById("unity-canvas"),
          document.querySelector("#canvas"),
          globalThis.Laya?.stage?.canvas,
          globalThis.Laya?.Render?._mainCanvas?.source,
          globalThis.__module?.canvas,
          globalThis.Module?.canvas,
          ...[...document.querySelectorAll("canvas")]
            .filter(c => c.isConnected && (c.clientWidth > 0 || c.offsetWidth > 0))
            .sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight)),
          ...[...document.querySelectorAll("canvas")]
            .filter(c => c.width && c.height)
            .sort((a, b) => b.width * b.height - a.width * a.height),
        ].find(c => c && typeof c.captureStream === "function" && c.width > 0 && c.height > 0);
        if (!canvas?.captureStream || !globalThis.MediaRecorder) throw new Error("浏览器不支持画布录制");
        // Omitting the rate captures each canvas paint. A separate capture timer
        // can miss paints even when it nominally matches the game's 60 Hz loop.
        const stream = canvas.captureStream();
        const contexts = [...(globalThis.__gameAudioCapture?.entries() || [])].filter(([context]) => context.state !== "closed");
        // A suspended audio track can stall MediaRecorder's entire muxer,
        // including video. Resume it before attaching; otherwise record video alone.
        await Promise.race([
          Promise.all(contexts.map(([context]) => context.resume().catch(() => {}))),
          new Promise(resolve => setTimeout(resolve, 1500)),
        ]);
        const primary = contexts.find(([context]) => context.state === "running");
        const audio = primary?.[1];
        const audioBridges = [];
        // Merge separate SDK/game audio contexts into one recorded track.
        if (primary) for (const [context, destination] of contexts) {
          if (context === primary[0] || context.state !== "running") continue;
          const source = primary[0].createMediaStreamSource(destination.stream);
          source.connect(audio);
          audioBridges.push(source);
        }
        for (const track of audio?.stream.getAudioTracks() || []) stream.addTrack(track.clone());
        // Games may prefer a supported platform encoder to reduce live capture
        // CPU pressure. Keep the existing portable VP8 fallback for all callers.
        const mimeType = [...preferredMimeTypes, "video/webm;codecs=vp8,opus", "video/webm;codecs=vp8", "video/webm"]
          .find(value => MediaRecorder.isTypeSupported(value));
        if (!mimeType) throw new Error("浏览器缺少录制编码器");
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: rateControl?.captureHintBitsPerSecond ?? 10_000_000, audioBitsPerSecond: 192_000 });
        const state = { recorder, stream, canvas, audioBridges, deferChunkWrites, deferredFlushBytes,
          requestedMaxDeferredBytes: deferChunkWrites ? maxDeferredBytes : null,
          maxDeferredBytes: deferChunkWrites ? effectiveMaxDeferredBytes : null,
          pending: Promise.resolve(), error: null, captureStartedAt: performance.now(), startedAt: null, armed: false, cutAt: null, raf: null, frames: 0, chunkCount: 0 };
        recorder.addEventListener('stop', () => { state.endedAt = performance.now(); }, { once: true });
        state.stopped = new Promise(resolve => recorder.addEventListener("stop", resolve, { once: true }));
        recorder.addEventListener("error", event => { state.error = event.error || new Error("录制失败"); });
        state.chunks = [];
        state.queuedBytes = 0;
        state.bufferedBytes = 0;
        state.peakBufferedBytes = 0;
        state.totalCapturedBytes = 0;
        state.flushedBytes = 0;
        state.flushedChunkCount = 0;
        state.writeChunk = (blob, deferred = false) => {
          const size = blob.size;
          state.pending = state.pending.then(async () => {
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const url = String(reader.result);
                resolve(url.slice(url.lastIndexOf(",") + 1));
              };
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
            await globalThis.__gameWriteVideoChunk(base64);
            blob = null; // Release the Blob reference only after the native file-write ACK.
            state.flushedBytes += size;
            state.flushedChunkCount++;
            if (deferred) state.bufferedBytes -= size;
          });
          state.pending.catch(error => {
            state.error = error;
            if (recorder.state !== 'inactive') recorder.stop();
          });
        };
        state.flushDeferred = () => {
          const chunks = state.chunks;
          state.chunks = [];
          state.queuedBytes = 0;
          for (const blob of chunks) state.writeChunk(blob, true);
        };
        recorder.addEventListener("dataavailable", event => {
          if (!event.data.size) return;
          state.chunkCount++;
          state.totalCapturedBytes += event.data.size;
          if (!deferChunkWrites) return state.writeChunk(event.data);
          state.bufferedBytes += event.data.size;
          state.peakBufferedBytes = Math.max(state.peakBufferedBytes, state.bufferedBytes);
          if (state.bufferedBytes > effectiveMaxDeferredBytes) {
            state.error = new Error(`Deferred video buffer exceeded ${effectiveMaxDeferredBytes} bytes (${(effectiveMaxDeferredBytes / 1024 / 1024).toFixed(1)} MiB)`);
            if (recorder.state !== 'inactive') recorder.stop();
            return;
          }
          state.chunks.push(event.data);
          state.queuedBytes += event.data.size;
          if (deferredFlushBytes && state.queuedBytes >= deferredFlushBytes) state.flushDeferred();
        });
        recorder.start(250);
        globalThis.__gameVideoRecording = state;
        globalThis.__gameVideoEnd = () => {
          if (!state.armed || recorder.state === "inactive") return;
          state.cutAt = Math.max(0.05, (performance.now() - state.startedAt) / 1000 - 0.12);
          recorder.stop();
        };
        const finished = endWhen ? (0, eval)(`(${endWhen})`) : null;
        const readNativeStart = nativeStart ? (0, eval)(`(${nativeStart.source})`) : null;
        if (readNativeStart && typeof readNativeStart !== 'function') throw new Error('原生开战观察器必须为只读函数');
        let lastNativeIdle = null;
        const watch = () => {
          if (recorder.state === 'inactive') return;
          try {
            // The prior RAF sample precedes the native start. Retaining that
            // frame includes the first actual combat paint without pausing it.
            if (!state.armed && readNativeStart) {
              const sample = readNativeStart(), now = performance.now();
              if (!sample || sample.level !== nativeStart.expectedLevel) lastNativeIdle = null;
              else if (sample.gameStarted === false) {
                const rendering = sample.rendering;
                lastNativeIdle = { time: now, state: { level: sample.level, gameStarted: false },
                  rendering: rendering && Number.isFinite(rendering.drawFrames) && Number.isFinite(rendering.rafFrames)
                    ? { drawFrames: rendering.drawFrames, rafFrames: rendering.rafFrames, time: now } : null };
              }
              else if (sample.gameStarted === true) {
                const gapMs = lastNativeIdle ? now - lastNativeIdle.time : Infinity;
                if (!lastNativeIdle || !Number.isFinite(gapMs) || gapMs <= 0 || gapMs > nativeStart.maxGapMs) throw new Error('原生开战缺少同关前一帧闲置证据，或观测间隔超限：' + gapMs);
                if (lastNativeIdle.time - state.captureStartedAt < encoderWarmupMs) throw new Error('原生自动开战早于同会话编码器预热完成');
                state.startedAt = lastNativeIdle.time;
                state.frames = 1;
                state.armed = true;
                state.trimHeadSeconds = (state.startedAt - state.captureStartedAt) / 1000;
                state.nativeStartEvidence = { expectedLevel: nativeStart.expectedLevel, before: lastNativeIdle.state,
                  after: { level: sample.level, gameStarted: true }, beforeAt: lastNativeIdle.time,
                  observedAt: now, gapMs, maxGapMs: nativeStart.maxGapMs, rendering: lastNativeIdle.rendering, method: 'previous-native-frame' };
              } else throw new Error('原生开战观察器返回无效 gameStarted');
            }
            if (state.armed) state.frames += 1;
            if (state.armed && finished?.()) globalThis.__gameVideoEnd();
            else state.raf = requestAnimationFrame(watch);
          } catch (error) {
            state.error = Object.assign(new Error(`录制收尾检测失败：${error.stack || error.message || error}`), { code: 'VIDEO_ENDING_FAILED' });
            recorder.stop();
          }
        };
        state.raf = requestAnimationFrame(watch);
        // Warm-up is pre-input idle footage only. The physical recording keeps
        // running, while logical start below excludes this lead-in from export.
        const warmup = warmAllCodecs || /(?:h264|avc1)/i.test(mimeType) ? encoderWarmupMs : 0;
        if (warmup > 0) await new Promise((resolve, reject) => {
          let lastRequest = 0;
          const poll = () => {
            if (state.error || recorder.state === 'inactive') return reject(state.error || new Error('Encoder stopped during preparation'));
            const elapsed = performance.now() - state.captureStartedAt;
            if (elapsed >= warmup && state.chunkCount >= 1) return resolve();
            if (elapsed >= warmup && recorder.state === 'recording' && performance.now() - lastRequest > 400) {
              lastRequest = performance.now();
              try { recorder.requestData(); } catch {}
            }
            if (elapsed > warmup + 6000) return reject(new Error('Encoder preparation received fewer than one chunk'));
            setTimeout(poll, 25);
          };
          poll();
        });
        return { width: canvas.width, height: canvas.height, audioTracks: stream.getAudioTracks().length, mimeType, fps, captureEveryFrame, encoderWarmupMs: warmup,
          rateControl: rateControl ? { ...rateControl, recorderReportedVideoBitsPerSecond: recorder.videoBitsPerSecond,
            note: 'Capture bitrate is an encoder hint; reported configuration is not measured raw bitrate.' } : undefined,
          deferChunkWrites, deferredFlushBytes, requestedMaxDeferredBytes: deferChunkWrites ? maxDeferredBytes : null,
          maxBufferedBytes:deferChunkWrites?effectiveMaxDeferredBytes:null,nativeStartExpectedLevel:nativeStart?.expectedLevel ?? null };
      }, { endWhen: endWhen?.toString() || null, fps, captureEveryFrame, deferChunkWrites, preferredMimeTypes, encoderWarmupMs, warmAllCodecs, maxDeferredBytes, effectiveMaxDeferredBytes, deferredFlushBytes, nativeStart: nativeStartConfig, rateControl: diagnostic ? diagnosticRateProfile : null });
      current.info = {...info,recordingMode,chunkTransport,recorderSourceSha256,recorderSourceDirectory,recorderSourceFiles};
      current.measure = createFrameRateMonitor(0, 0);
      return info;
    },
    async start(level, options = {}) {
      if (!current) await this.prepare(level, {...options, warmAllCodecs: true});
      if (current.level !== level || current.armed) throw new Error('录制预热关号不符或本关已经开始');
      if (current.info?.nativeStartExpectedLevel) throw new Error('原生自动开战必须调用 adoptNativeStart，禁止覆盖原生开头时间');
      const timing = await frame.evaluate(() => {
        const state = globalThis.__gameVideoRecording;
        if (!state || state.armed || state.recorder.state !== 'recording') throw new Error('Prepared encoder is unavailable or already started');
        state.startedAt = performance.now();
        state.frames = 0;
        state.armed = true;
        state.trimHeadSeconds = (state.startedAt - state.captureStartedAt) / 1000;
        return {trimHeadSeconds:state.trimHeadSeconds,logicalStartedAt:state.startedAt};
      });
      current.armed = true;
      Object.assign(current.info,timing);
      return current.info;
    },
    async adoptNativeStart(level, { timeoutMs = 30000 } = {}) {
      if (!current || current.level !== level || current.armed || !current.info?.nativeStartExpectedLevel) throw new Error('缺少同会话预热的原生自动开战录制');
      await frame.waitForFunction(() => globalThis.__gameVideoRecording?.nativeStartEvidence || globalThis.__gameVideoRecording?.error, null, { timeout: timeoutMs });
      const timing = await frame.evaluate(() => {
        const state = globalThis.__gameVideoRecording;
        if (state?.error) throw state.error;
        const evidence = state?.nativeStartEvidence;
        if (!state?.armed || state.recorder.state !== 'recording' || !evidence || evidence.method !== 'previous-native-frame' ||
            evidence.before?.gameStarted !== false || evidence.after?.gameStarted !== true || evidence.before.level !== evidence.after.level ||
            !Number.isFinite(evidence.gapMs) || evidence.gapMs <= 0 || evidence.gapMs > 42.0 ||
            !Number.isFinite(evidence.maxGapMs) || evidence.maxGapMs <= 0 || evidence.maxGapMs > 42.0 || evidence.gapMs > evidence.maxGapMs ||
            evidence.expectedLevel !== evidence.after.level || evidence.observedAt - evidence.beforeAt !== evidence.gapMs ||
            evidence.beforeAt !== state.startedAt || !(state.trimHeadSeconds >= 1.5)) throw new Error('原生自动开战的真实前后帧证据无效');
        return { trimHeadSeconds: state.trimHeadSeconds, logicalStartedAt: state.startedAt, nativeStartEvidence: evidence };
      });
      current.armed = true;
      Object.assign(current.info, timing);
      return current.info;
    },
    async discard(){
      if(!current)return null;
      return this.finish({partial:true,outcome:'interrupted',discard:true});
    },
    async finish({ partial = false, outcome = 'completed', trimTailSeconds = 0, additionalTrimTailSeconds = 0, motionWindows = [], discard = false, deferValidation = false } = {}) {
      if (!current) return null;
      const clip = current;
      if(!['completed','failed','interrupted'].includes(outcome))throw new TypeError('无效录制 outcome');
      // Diagnostic attempts have a real playable ending even when gameplay
      // loses or times out. Do not use partial's discard path for those clips.
      if(!discard&&diagnostic&&clip.armed&&!page.isClosed())partial=false;
      const unmarked=!clip.armed&&!partial;
      if(unmarked)partial=true;
      if (page.isClosed()) partial = true;
      let finishError;
      try {
        if (!page.isClosed()) clip.metrics = await frame.evaluate(async ({ trimTailSeconds, additionalTrimTailSeconds, partial, diagnostic, chunkTransport }) => {
          const state = globalThis.__gameVideoRecording;
          if (!state) return;
          if (state.recorder.state !== "inactive") {
            if (trimTailSeconds > 0) state.cutAt = Math.max(0.05, (performance.now() - state.startedAt) / 1000 - trimTailSeconds);
            state.recorder.stop();
          }
          state.frameCaptureEndedAt = performance.now();
          cancelAnimationFrame(state.raf);
          await state.stopped;
          if (!partial && (!state.error || diagnostic)) {
            if(chunkTransport==='pull')globalThis.__gameVideoPullChunks=state.chunks;
            else state.flushDeferred();
          }
          state.chunks = [];
          try { await state.pending; }
          catch (error) { if (!diagnostic) throw error; state.error ||= error; }
          finally {
            state.stream.getTracks().forEach(track => track.stop());
            state.audioBridges.forEach(source => source.disconnect());
            globalThis.__gameVideoRecording = null;
            globalThis.__gameVideoEnd = null;
          }
          if (state.error && !diagnostic) throw state.error;
          if (additionalTrimTailSeconds > 0) {
            const end = state.cutAt ?? (state.endedAt - state.startedAt) / 1000;
            state.cutAt = Math.max(0.05, end - additionalTrimTailSeconds);
          }
          const durationMs = state.cutAt
            ? state.cutAt * 1000
            : ((state.frameCaptureEndedAt || state.endedAt) - state.startedAt);
          return { cutAt: state.cutAt, trimHeadSeconds: state.trimHeadSeconds || 0,
            captureError: state.error ? { message: state.error.message || String(state.error), code: state.error.code } : undefined,
            chunkCount: state.chunkCount, peakBufferedBytes: state.peakBufferedBytes || 0,
            totalCapturedBytes: state.totalCapturedBytes, flushedBytes: state.flushedBytes,
            flushedChunkCount: state.flushedChunkCount, bufferedBytesAtEnd: state.bufferedBytes,
            averageRefreshFps: state.frames * 1000 / durationMs };
        }, { trimTailSeconds, additionalTrimTailSeconds, partial, diagnostic, chunkTransport });
        if(chunkTransport==='pull'&&!partial&&clip.metrics){
          let bytes=0,count=0;
          try{
            for(;;){
              const part=await frame.evaluate(async()=>{
                const queue=globalThis.__gameVideoPullChunks;if(!queue?.length)return null;
                const blob=queue.shift(),bytes=blob.size;
                const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>{const value=String(reader.result);resolve(value.slice(value.lastIndexOf(',')+1));};reader.readAsDataURL(blob);});
                return {base64,bytes};
              });
              if(!part)break;
              if(!Number.isSafeInteger(part.bytes)||part.bytes<=0||Buffer.from(part.base64,'base64').length!==part.bytes)throw Error('Pulled recording chunk byte count mismatch');
              await page.__activeGameVideoRecorderChunkHandler(part.base64);
              bytes+=part.bytes;count++;
              if(count%5===0)await new Promise(r=>setTimeout(r,5));
            }
            if(bytes!==clip.metrics.totalCapturedBytes||count!==clip.metrics.chunkCount)throw Error('Pulled capture is incomplete: '+JSON.stringify({bytes,count,expectedBytes:clip.metrics.totalCapturedBytes,expectedChunks:clip.metrics.chunkCount}));
            Object.assign(clip.metrics,{flushedBytes:bytes,flushedChunkCount:count,bufferedBytesAtEnd:0});
          }finally{await frame.evaluate(()=>{globalThis.__gameVideoPullChunks=null;}).catch(()=>{});}
        }
      } catch (error) {
        if (!partial && !page.isClosed()) finishError = error;
        else partial = true;
      }
      try { await writes; } catch (error) { finishError = error; }
      try { await clip.writer.close(); } catch (error) { finishError ||= error; }
      finally { current = null; }
      if (partial) {
        if (!discard&&diagnostic && page.isClosed()) {
          const bytes = (await stat(clip.raw)).size;
          const failure = new Error('诊断页面已关闭，无法完成最终 flush；已 ACK 的原始前缀保留，不能算完整录像');
          failure.recordingEvidence = { raw: clip.raw, bytes, info: clip.info, metrics: clip.metrics,
            partialCapture: true, unknownTail: true, recorderArmed: clip.armed,
            prefixAvailable: bytes > 0, requiresRecovery: bytes > 0, nativeVictoryInVideo: null, victoryPresenceVerified: false,
            reason: 'page-closed-before-final-flush', observedAt: new Date().toISOString(),
            note: 'Incomplete capture; decoding and victory presence have not been verified.',
            writeFailure: (writeError || finishError)?.stack };
          throw failure;
        }
        await dropQuiet(clip.raw);
        if(unmarked)throw Error('录制仅完成预热，未正式 start，禁止发布预热片');
        return null;
      }
      if (clip.healthError && !diagnostic) {
        await dropQuiet(clip.raw);
        throw clip.healthError;
      }
      if (writeError || finishError) {
        const failure = writeError || finishError;
        if (diagnostic) failure.recordingEvidence = { raw: clip.raw, metrics: clip.metrics, info: clip.info };
        else await dropQuiet(clip.raw);
        throw failure;
      }
      const rawStat = await stat(clip.raw).catch(() => null);
      if (!rawStat || rawStat.size < 4) {
        await dropQuiet(clip.raw);
        if (!partial) throw new Error("录制没有收到视频数据，已停止，未将本关标为录制成功");
        return null;
      }
      const file = clip.file;
      const encoding = path.join(directory, `.${clip.stem}.encoding.mp4`);
      try {
        if (await access(file).then(() => true, () => false)) throw new Error(`输出文件已存在：${file}`);
        if(diagnostic){
          const encoded=await inspectEncodedFrames(clip.raw,clip.metrics?.trimHeadSeconds||0,clip.metrics?.cutAt,{diagnostic:true});
          clip.metrics.encodedOpening=encoded.opening;
          clip.metrics.encodedContinuity=encoded.full;
          clip.metrics.motionWindows=motionWindows;
        }
        // 门槛默认基准为 59.0 FPS（大于 59 即可达标通过）；GAME_MIN_FPS 与 GAME_ALLOW_GAP_MS
        // 允许根据环境灵活注入，仍拒绝整体掉帧的录像，不放宽 CFR 只能补重复画面的原则。
        const minFps=Number(process.env.GAME_MIN_FPS||59.0);
        const allowGapMs=Number(process.env.GAME_ALLOW_GAP_MS||0);
        if(!diagnostic && !deferValidation && captureEveryFrame && fps>=minFps) {
          if(!Number.isFinite(clip.metrics?.averageRefreshFps)||clip.metrics.averageRefreshFps<minFps)throw Error(`正式录制区间页面刷新不足 ${minFps} FPS：`+clip.metrics?.averageRefreshFps);
          const encoded=await inspectEncodedFrames(clip.raw,clip.metrics?.trimHeadSeconds||0,clip.metrics?.cutAt);
          clip.metrics.encodedOpening=encoded.opening;
          clip.metrics.encodedContinuity=encoded.full;
          if(!Number.isFinite(encoded.full.averageEncodedFps)||encoded.full.averageEncodedFps<minFps)throw Error(`原始编码帧率不足 ${minFps} FPS，禁止 CFR 补成标称 60 FPS：`+JSON.stringify(encoded.full));
          if(clip.metrics.encodedOpening.maxGapMs>Math.max(48.1,allowGapMs)||(clip.metrics.encodedOpening.gaps||[]).some(g=>g.ms>allowGapMs))throw Error('原始编码开头丢帧，禁止用 CFR 重复画面掩盖：'+JSON.stringify(clip.metrics.encodedOpening));
          if(!Array.isArray(motionWindows)||motionWindows.some(w=>!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<0||w.end<w.start))throw Error('原生运动时间窗口无效');
          clip.metrics.motionWindows=motionWindows;
          const movingGaps=encoded.full.gaps.filter(g=>g.ms>allowGapMs&&motionWindows.some(w=>g.at<w.end&&g.at+g.ms/1000>w.start));
          if(movingGaps.length)throw Error('原生运动阶段编码丢帧，禁止交付：'+JSON.stringify(movingGaps));
        }
        const cutAt = clip.metrics?.cutAt;
        const exported = await exportPublishingVideo(clip.raw, encoding, cutAt, fps, speed, clip.metrics?.trimHeadSeconds || 0, outputWidth, outputHeight,
          diagnostic ? diagnosticRateProfile : null, blurredBackground);
        if (diagnostic) clip.info.outputEncoder = exported.outputEncoder;
        await rename(encoding, file);
        if(!deferValidation)await dropQuiet(clip.raw);
        console.log(`[录制] ${clip.stem} 平均页面刷新 ${clip.metrics?.averageRefreshFps?.toFixed(2)} FPS`);
        return { file, bytes: (await stat(file)).size, partial, outcome, ...clip.metrics, ...clip.info,...(deferValidation?{validationPending:true,rawCaptureFile:clip.raw,motionWindows}:{} ) };
      } catch (error) {
        const rejected=new Error(`MP4 导出失败，原始录制保留在 ${clip.raw}：${error.message}`);
        rejected.recordingEvidence={raw:clip.raw,metrics:clip.metrics,info:clip.info};
        throw rejected;
      }
    },
  };
}

// Keep the source stream until the user-requested post-recording inspection.
// Encoding is complete; no quality approval is implied by validationPending.
export async function inspectDeferredRecording(video){
 if(!video.validationPending||!video.rawCaptureFile)throw Error('No pending source recording');
 if(path.dirname(path.resolve(video.rawCaptureFile))!==path.dirname(path.resolve(video.file))||!video.rawCaptureFile.endsWith('.webm'))throw Error('Source capture must stay beside its MP4');
 const encoded=await inspectEncodedFrames(video.rawCaptureFile,video.trimHeadSeconds||0,video.cutAt);
 return {...video,encodedOpening:encoded.opening,encodedContinuity:encoded.full,validationPending:false};
}
