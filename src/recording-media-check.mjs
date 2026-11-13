import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);

export function assertNativeMotionContinuity(video,{requireMovement=true}={}){
 const windows=video.motionWindows;
 if(!Array.isArray(windows)||windows.some(w=>!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<0||w.end<w.start)||requireMovement&&!windows.length)throw Error('缺少有效原生运动窗口');
 if(!Array.isArray(video.encodedContinuity?.gaps))throw Error('缺少全片原始编码间隔证据');
 const allowGapMs=Number(process.env.GAME_ALLOW_GAP_MS||0);
 const gaps=video.encodedContinuity.gaps.filter(g=>g.ms>allowGapMs&&windows.some(w=>g.at<w.end&&g.at+g.ms/1000>w.start));
 if(gaps.length)throw Error('原生运动阶段编码间隔异常：'+JSON.stringify(gaps));
}

export function assertMovingMediaContinuity(decoded,windows,duration){
 if(!Number.isFinite(duration)||duration<=0)throw Error('无效媒体时长');
 const alarms=decoded.freezes.map(f=>{const end=f.end??(Number.isFinite(f.duration)?f.start+f.duration:duration),movingSeconds=windows.reduce((sum,w)=>sum+Math.max(0,Math.min(w.end,end)-Math.max(w.start,f.start)),0);return {...f,end,movingSeconds};}).filter(f=>f.movingSeconds>=.05);
 if(alarms.length)throw Error('原生运动中出现完全重复画面：'+JSON.stringify(alarms));
}

// Decode the entire file. Freeze detection is an alarm; native idle phases must
// be reviewed separately instead of being counted as dropped gameplay frames.
export async function inspectRecordingMedia(file,{decodeArgs=[],allowSilentNativeAudio=false}={}) {
 const {stderr}=await exec(process.env.GAME_FFMPEG||'ffmpeg',[
  '-hide_banner','-nostdin','-nostats','-xerror',...decodeArgs,'-threads','1','-i',file,
  '-map','0:v:0','-map','0:a:0','-vf',(decodeArgs.length?'hwdownload,format=nv12,':'')+'scale=160:284,freezedetect@candidate=n=-60dB:d=0.05,freezedetect@identical=n=0:d=0.05',
  '-af','volumedetect','-f','null',process.platform==='win32'?'NUL':'/dev/null',
 ],{windowsHide:true,maxBuffer:2*1024*1024});
 let freezes=[];const candidateFreezes=[];
 for(const match of stderr.matchAll(/\[freezedetect@(candidate|identical) @[^\]]*\] lavfi\.freezedetect\.freeze_(start|duration|end): ([\d.]+)/g)){
  const list=match[1]==='identical'?freezes:candidateFreezes;
  if(match[2]==='start')list.push({start:Number(match[3])});
  else if(list.length)list.at(-1)[match[2]]=Number(match[3]);
 }
 const meanDb=Number(stderr.match(/mean_volume: (-?[\d.]+)/)?.[1]);
 const peakDb=Number(stderr.match(/max_volume: (-?[\d.]+)/)?.[1]);
 if(!Number.isFinite(meanDb)||!Number.isFinite(peakDb)||(!allowSilentNativeAudio&&peakDb<-70))throw Error('没有有效原声音轨：'+file);
 // Downsampling can erase tiny native motion. Only full-resolution identical
 // frames can confirm a duplicate-image alarm; preserve the preview evidence.
 const previewFreezes=freezes;
 if(previewFreezes.length){const {stderr:full}=await exec(process.env.GAME_FFMPEG||'ffmpeg',['-hide_banner','-nostdin','-nostats','-xerror',...decodeArgs,'-threads','1','-i',file,'-map','0:v:0','-an','-vf',(decodeArgs.length?'hwdownload,format=nv12,':'')+'freezedetect@identical=n=0:d=0.05','-f','null',process.platform==='win32'?'NUL':'/dev/null'],{windowsHide:true,maxBuffer:2*1024*1024});freezes=[];for(const match of full.matchAll(/\[freezedetect@identical @[^\]]*\] lavfi\.freezedetect\.freeze_(start|duration|end): ([\d.]+)/g)){if(match[1]==='start')freezes.push({start:Number(match[2])});else if(freezes.length)freezes.at(-1)[match[1]]=Number(match[2]);}}
 return {fullDecode:true,meanDb,peakDb,freezes,previewFreezes,candidateFreezes};
}
