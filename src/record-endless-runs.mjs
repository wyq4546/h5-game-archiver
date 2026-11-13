import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {checkVideoTools,createVideoRecorder,recordingDirectory} from './game-video-recorder.mjs';
import {installNativeRecordingMotion,readNativeRecordingMotion} from './recording-runtime.mjs';
import {ensureGameRecordingDirectory,recordingDataDirectory} from './recording-layout.mjs';
import {acceptRecordedClip} from './recording-acceptance.mjs';

// Profiles retain each game's native input controller, observer, and real save.
export async function recordEndlessRuns(profile) {
 const option=n=>{const i=process.argv.indexOf(n);return i<0?undefined:process.argv[i+1];};
 const runsInput=Number(option('--runs')??0),seconds=Number(option('--seconds')??60);
 if(!Number.isSafeInteger(runsInput)||runsInput<0||!Number.isFinite(seconds)||seconds<=0)throw Error('--runs为非负整数，--seconds为正数');
 // 每局重试上限：原生撞车/编码抖动的通过率天然低于 1，短跑酷游戏可显式放宽，缺省保持 3 次快速失败。
 const maxAttempts=Number(option('--attempts')??3);
 if(!Number.isSafeInteger(maxAttempts)||maxAttempts<1)throw Error('--attempts为正整数');
 const limit=runsInput||Infinity;await checkVideoTools();
 await Promise.all(profile.preflight.map(f=>fs.access(path.join(profile.root,f))));
 const videoDirectory=option('--resume')?path.resolve(option('--resume')):recordingDirectory(path.join(profile.root,'scripts'));
 await ensureGameRecordingDirectory(profile.root,videoDirectory);
 const data=recordingDataDirectory(videoDirectory);await fs.mkdir(data,{recursive:true});
 const reportFile=path.join(data,'report.json'),checkpointFile=path.join(data,'checkpoint.json');
 const report=await fs.readFile(reportFile,'utf8').then(JSON.parse).catch(()=>({game:profile.name,mode:'native-endless-timed-runs',recordVideo:true,targetSeconds:seconds,runs:[],attempts:[]}));
 if(report.targetSeconds!==seconds)throw Error('续录目标时长与批次不一致');
 let checkpoint=await fs.readFile(checkpointFile,'utf8').then(JSON.parse).catch(()=>null);
 const sourcePaths=[...profile.sources,new URL(import.meta.url),new URL('./recording-acceptance.mjs',import.meta.url),new URL('./recording-media-check.mjs',import.meta.url)];
 const hash=createHash('sha256'),sources=await Promise.all(sourcePaths.map(f=>fs.readFile(f)));
 sourcePaths.forEach((f,i)=>hash.update(path.basename(String(f))+'\0').update(sources[i]));const version=hash.digest('hex');
 const sourceDirectory=path.join(data,'source','automation-'+version);await fs.mkdir(sourceDirectory,{recursive:true});
 await Promise.all(sourcePaths.map((f,i)=>fs.writeFile(path.join(sourceDirectory,path.basename(String(f))),sources[i])));
 const write=async()=>{await fs.mkdir(data,{recursive:true});await fs.writeFile(reportFile,JSON.stringify(report,null,2)+'\n');};
 const log=async e=>{console.log(JSON.stringify(e));await fs.appendFile(path.join(data,'run.jsonl'),JSON.stringify({...e,at:new Date().toISOString()})+'\n');};
 let game,recorder,stop=false;process.on('SIGINT',()=>{stop=true;console.log('本局完成并验收后保存停止');});
 try {
  report.status=report.runs.length>0?'running':'initialized';delete report.error;delete report.finishedAt;await write();
  while(!stop&&report.runs.length<limit){
   const run=report.runs.length+1,attempt=report.attempts.filter(x=>x.run===run).length+1;
   let result;
   try{
    game=await profile.open(checkpoint?.storage);const page=game.page;
    await profile.ready(game);await page.evaluate(installNativeRecordingMotion,{source:profile.pose.toString()});
    recorder=await createVideoRecorder(page,{directory:videoDirectory,captureEveryFrame:true,deferChunkWrites:true});
    let media;
    if(profile.nativeStart){
     await recorder.prepare(run,{nativeStart:profile.nativeStart(run),endWhen:profile.endWhen?profile.endWhen(seconds):null});await page.waitForTimeout(50);
     await profile.start(game);media=await recorder.adoptNativeStart(run);
    }else{await recorder.prepare(run,{endWhen:profile.endWhen?profile.endWhen(seconds):null});media=await recorder.start(run);await profile.start(game);}
    await log({event:'run-start',run,attempt,targetSeconds:seconds,automationVersion:version,nativeStartEvidence:media.nativeStartEvidence});
    let current,elapsed=0,lastLog=0;
    while(true){
     current=await profile.snapshot(game);elapsed=current?.now!=null?(current.now-media.logicalStartedAt)/1000:await page.evaluate(t=>(performance.now()-t)/1000,media.logicalStartedAt);
     if(game.errors.length||game.failed.length||current.errors.length)throw Error(JSON.stringify({errors:game.errors,failed:game.failed,control:current.errors}));
     if(profile.dead(current))throw Error('原生碰撞或跑局中断：'+JSON.stringify(current));
     if(elapsed>=seconds&&profile.alive(current)&&(!profile.targetReached||profile.targetReached(current,seconds)))break;
     if(elapsed>seconds+15)throw Error('原生跑局未在预期时间内进入目标状态');
     if(elapsed-lastLog>=1){await fs.appendFile(path.join(data,'telemetry.jsonl'),JSON.stringify({run,attempt,elapsed,...current})+'\n');lastLog=elapsed;}
     await page.waitForTimeout(200);
    }
    const motion=await readNativeRecordingMotion(page,media);
    result={run,attempt,targetSeconds:seconds,elapsedSeconds:elapsed,native:current,automationVersion:version,errors:game.errors,failed:game.failed};
    result.video=await recorder.finish({outcome:'completed',motionWindows:motion.motionWindows});recorder=null;
    const storage=await game.save();await game.close();game=null;
    result.acceptance=await acceptRecordedClip(result.video,data,{nativePassed:elapsed>=seconds&&profile.alive(current)&&(!profile.targetReached||profile.targetReached(current,seconds))});
    report.runs.push(result);report.attempts.push({run,attempt,outcome:'accepted'});
    checkpoint={savedAt:new Date().toISOString(),storage};await fs.writeFile(checkpointFile,JSON.stringify(checkpoint,null,2)+'\n');
    report.status='running';await write();await log({event:'run-accepted',run,duration:result.acceptance.duration,nativeRefreshFps:result.acceptance.nativeRefreshFps,sha256:result.acceptance.sha256});
   }catch(error){
    if(recorder){await recorder.discard().catch(()=>{});recorder=null;}
    if(game){await game.close().catch(()=>{});game=null;}
    const evidence=error.recordingEvidence;
    if(evidence?.raw){
     const rejected=path.join(data,'rejected');await fs.mkdir(rejected,{recursive:true});const file=path.join(rejected,`run-${String(run).padStart(6,'0')}-attempt-${attempt}.webm`);await fs.rename(evidence.raw,file).catch(()=>{});
    }
    if(result?.video?.file){
     const rejected=path.join(data,'rejected');await fs.mkdir(rejected,{recursive:true});const file=path.join(rejected,`run-${String(run).padStart(6,'0')}-attempt-${attempt}.mp4`);await fs.rename(result.video.file,file).catch(()=>{});
    }
    report.attempts.push({run,attempt,outcome:'failed',error:error.message,automationVersion:version});
    await write().catch(()=>{});
    await log({event:'run-attempt-failed',run,attempt,error:error.message});
    if(report.attempts.filter(x=>x.run===run&&x.automationVersion===version).length>=maxAttempts)throw error;
    continue;
   }
  }
  report.status=stop?'stopped':'completed';report.finishedAt=new Date().toISOString();delete report.error;await write();console.log(JSON.stringify({status:report.status,runs:report.runs.length,report:reportFile}));
 }catch(error){
  report.status='failed';report.error=error.message;report.failedAt=new Date().toISOString();await write().catch(()=>{});
  if(game){const temporary=path.join(profile.root,'scripts/.tmp');await fs.mkdir(temporary,{recursive:true});await game.page.screenshot({path:path.join(temporary,'recording-failure.png')}).catch(()=>{});}
  throw error;
 }finally{await recorder?.discard().catch(()=>{});await game?.close();}
}
