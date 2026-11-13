import { readFile, writeFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const exec=promisify(execFile);
const [archive,mode='final']=process.argv.slice(2);
const logs=path.resolve('download',archive,'scripts/logs');
const log=await readFile(path.join(logs,`cadence-${mode}.log`),'utf8');
const files=[...log.matchAll(/MP4 已保存：([^\r\n]+?\.mp4)/g)].map(m=>m[1]);
if(!files.length)throw Error('No completed clips in log');
const reports=[];
for(const input of files){
  const probe=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',input],{windowsHide:true})).stdout);
  const video=probe.streams.find(s=>s.codec_type==='video');
  const fps=video.avg_frame_rate.split('/').map(Number).reduce((a,b)=>a/b);
  const duration=Number(video.duration);
  const sampleStart=Math.min(3,duration/4), sampleLength=Math.min(6,duration-sampleStart);
  const {stdout}=await exec('ffmpeg',['-v','error','-ss',String(sampleStart),'-i',input,'-t',String(sampleLength),'-vf','scale=108:192','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],{windowsHide:true,encoding:'buffer',maxBuffer:40*1024*1024});
  const size=108*192*3,diffs=[];
  for(let offset=size;offset+size<=stdout.length;offset+=size){let sum=0;for(let i=0;i<size;i++)sum+=Math.abs(stdout[offset+i]-stdout[offset-size+i]);diffs.push(sum/size);}
  const report={input,duration,fps,width:video.width,height:video.height,codec:video.codec_name,frames:Number(video.nb_frames),audio:probe.streams.find(s=>s.codec_type==='audio')?.codec_name,sample:{start:sampleStart,seconds:sampleLength,nearlyRepeated:diffs.filter(d=>d<.05).length,distinctFramesPerSecond:diffs.filter(d=>d>=.05).length/sampleLength}};
  if(mode==='baseline'){
    const raw=path.join(path.dirname(input),'.'+path.basename(input,'.mp4')+'.capture.webm');
    const rawProbe=JSON.parse((await exec('ffprobe',['-v','error','-select_streams','v','-show_entries','frame=best_effort_timestamp_time','-of','json',raw],{windowsHide:true,maxBuffer:3*1024*1024})).stdout);
    const times=rawProbe.frames.map(f=>Number(f.best_effort_timestamp_time)*1000);
    const histogram={};times.slice(1).forEach((t,i)=>{const k=Math.round((t-times[i])/16.667);histogram[k]=(histogram[k]||0)+1;});
    report.source={fps:(times.length-1)*1000/(times.at(-1)-times[0]),intervalsInGameFrames:histogram};
  }
  const volume=await exec('ffmpeg',['-hide_banner','-i',input,'-af','volumedetect','-vn','-f','null','-'],{windowsHide:true});
  report.maxVolume=/max_volume: ([-\d.]+) dB/.exec(volume.stderr)?.[1]||null;
  if(archive.startsWith('Barrel-Roller')){
    const tail=await exec('ffmpeg',['-v','error','-sseof','-1','-i',input,'-vf','scale=108:192','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],{windowsHide:true,encoding:'buffer',maxBuffer:5*1024*1024});
    let resultPanelFrames=0;
    for(let offset=0;offset+size<=tail.stdout.length;offset+=size){
      let green=0;
      for(let pixel=0;pixel<108*48;pixel++){
        const i=offset+pixel*3;
        if(tail.stdout[i]<40&&tail.stdout[i+1]>170&&tail.stdout[i+2]<180)green++;
      }
      if(green/(108*48)>.5)resultPanelFrames++;
    }
    report.resultPanelFrames=resultPanelFrames;
    if(process.argv.includes('--assert-boundaries')&&resultPanelFrames)throw Error(`Result panel remains in ${resultPanelFrames} tail frames: ${input}`);
  }
  const stem=`cadence-${mode}-${path.basename(input,'.mp4')}`;
  for(const [tag,seek]of [['opening',0],['ending',Math.max(0,duration-1)]]){
    await exec('ffmpeg',['-v','error','-ss',String(seek),'-i',input,'-vf',`select='lt(n,${fps})',scale=108:192,tile=10x${Math.ceil(fps/10)}`,'-frames:v','1','-y',path.join(logs,`${stem}-${tag}.png`)],{windowsHide:true});
  }
  report.remainingTemporaryFiles=(await readdir(path.dirname(input))).filter(n=>n.startsWith('.')&&/\.(webm|mp4)$/.test(n));
  reports.push(report);console.log(JSON.stringify(report));
}
await writeFile(path.join(logs,`cadence-${mode}-media.json`),JSON.stringify(reports,null,2));
