// Full Chromium sustained 60 FPS at 1080p in the local Unity archives;
// the bundled headless shell did not. A desktop window can be throttled to 1 FPS.
export function resolveBrowserOptions(argv = process.argv.slice(2)) {
  const recording = argv.includes('--record') || argv.includes('--record-video');
  const headless = !argv.includes('--headed') && (recording || argv.includes('--headless'));
  return { headless, ...(headless && recording ? { channel: 'chromium' } : {}) };
}

// Sample a serialized, read-only native pose/path getter during formal capture.
export function installNativeRecordingMotion(positionSource){
 if(globalThis.__nativeRecordingMotion)throw Error('Native motion observer already installed');
 const {source,captureKey='__gameVideoRecording'}=typeof positionSource==='string'?{source:positionSource}:positionSource;
 if(!['__gameVideoRecording','__nailVideoRecording'].includes(captureKey))throw Error('Unknown native recording state');
 const read=(0,eval)(`(${source})`);if(typeof read!=='function')throw Error('Native pose getter required');
 const state=globalThis.__nativeRecordingMotion={windows:[],samples:0,epoch:null,error:null};let previous=null,previousTime=performance.now();
 const tick=()=>{const now=performance.now(),capture=globalThis[captureKey];let sampleTime=now;
  try{
   if(capture?.armed&&capture.recorder.state==='recording'){
    if(state.epoch!==capture.startedAt){state.epoch=capture.startedAt;state.windows=[];state.samples=0;previous=null;previousTime=now;}
    const observation=read(),timestamped=observation!=null&&!Array.isArray(observation),current=timestamped?observation.pose:observation;
    const observedAt=timestamped?observation.at:now;
    if(current!=null&&(!Array.isArray(current)||current.some(v=>!Number.isFinite(v))))throw Error('Invalid native motion coordinates');
    if(timestamped&&(!Number.isFinite(observedAt)||observedAt<0||observedAt>now))throw Error('Invalid native draw observation timestamp');
    sampleTime=observedAt;
    const moved=current&&previous&&(current.length!==previous.length||current.some((v,i)=>v!==previous[i])),last=state.windows.at(-1);
    if(moved){if(last?.open)last.end=observedAt;else state.windows.push({start:timestamped?observedAt:previousTime,end:observedAt,open:true});}
    else if(last?.open){last.end=previousTime;last.open=false;}
    previous=current;state.samples++;
   }else{const last=state.windows.at(-1);if(last?.open)last.open=false;previous=null;}
   previousTime=sampleTime;state.raf=requestAnimationFrame(tick);
  }catch(error){state.error=error.stack||String(error);if(capture)capture.error=error;}
 };state.raf=requestAnimationFrame(tick);
}

export async function readNativeRecordingMotion(page,media){
 const state=await page.evaluate(()=>{const s=globalThis.__nativeRecordingMotion;return s&&{windows:s.windows,samples:s.samples,epoch:s.epoch,error:s.error};});
 if(!state||state.error||state.epoch!==media.logicalStartedAt||state.samples<2)throw Error('缺少正式区间原生运动证据：'+JSON.stringify(state));
 return {nativeMotionSamples:state.samples,motionWindows:state.windows.map(w=>({start:Math.max(0,(w.start-media.logicalStartedAt)/1000),end:Math.max(0,(w.end-media.logicalStartedAt)/1000)}))};
}

// `planningMs` is the cumulative time the page spent in a synchronous route-planning
// block. The render loop cannot tick during it, so those milliseconds must not count
// as a stalled capture. It is monotonically increasing, so the delta since the last
// sample is what falls inside the interval being judged. Deltas longer than the
// interval itself (planning spanning several health ticks) saturate at the elapsed
// value, which correctly zeroes the slow accumulator for that tick.
export function createFrameRateMonitor(startTime, startFrames) {
  let lastTime = startTime;
  let lastFrames = startFrames;
  let lastPlanning = 0;
  let slowMilliseconds = 0;
  let health = { fps: null, tooSlow: false };
  const minSlowFps = Number(process.env.GAME_MIN_SLOW_FPS || (process.platform === 'win32' ? 15 : 2.0));
  const monitor = (time, frames, planningMs = lastPlanning) => {
    const elapsed = time - lastTime;
    if (elapsed < 1000) return health;
    const planning = Math.max(0, Math.min(elapsed, planningMs - lastPlanning));
    const active = elapsed - planning;
    const fps = active > 0 ? (frames - lastFrames) * 1000 / active : null;
    slowMilliseconds = fps !== null && fps < minSlowFps ? slowMilliseconds + elapsed : 0;
    health = { fps, tooSlow: slowMilliseconds >= 10000 };
    lastTime = time;
    lastFrames = frames;
    lastPlanning = planningMs;
    return health;
  };
  // Drop the interval that just elapsed without letting it count toward the slow
  // budget or reporting its stale fps (used by callers that detect a deliberate
  // freeze themselves).
  monitor.rebaseline = (time, frames) => {
    lastTime = time;
    lastFrames = frames;
    slowMilliseconds = 0;
    health = { fps: null, tooSlow: false };
    return health;
  };
  return monitor;
}
