import {readdir,readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
function inside(root,file){const relative=path.relative(root,file);return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);}

// Formal acceptance reports take precedence over filenames. Diagnostic,
// rejected and recovery footage must never inflate completed level counts.
export async function scanVerifiedRecordingBatches(root){
 const auxiliary=path.join(root,'scripts','recording-data'),videoRoot=path.join(root,'scripts','video');let entries;
 try{entries=await readdir(auxiliary,{withFileTypes:true});}catch{return null;}
 let canonicalVideos;try{canonicalVideos=await realpath(videoRoot);}catch{return null;}
 const levels=new Set();let recognized=false,lastRecordedAt=null,nativeTotal=null;
 for(const entry of entries){
  if(!entry.isDirectory()||!/^recording-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z$/.test(entry.name))continue;
  let report;try{report=JSON.parse(await readFile(path.join(auxiliary,entry.name,'report.json'),'utf8'));}catch{continue;}
  const formal=report.recordVideo===true&&(Array.isArray(report.levels)||Array.isArray(report.runs));
  const aggregate=Array.isArray(report.completedLevelNumbers)&&Number.isInteger(report.qualityVerification?.passed)&&report.qualityVerification.failed===0;
  if(!formal&&!aggregate)continue;recognized=true;
  let batch;try{batch=await realpath(path.join(videoRoot,entry.name));if(!inside(canonicalVideos,batch))continue;}catch{continue;}
  const candidates=aggregate?report.completedLevelNumbers.slice(0,report.qualityVerification.passed).map(level=>({level,video:{file:path.join(batch,`level-${String(level).padStart(6,'0')}.mp4`)}})):(report.levels||report.runs);
  const accepted=[];
  for(const original of candidates){
   const item={...original};
   if(formal&&!item.acceptance&&Number.isSafeInteger(item.level??item.run))try{item.acceptance=JSON.parse(await readFile(path.join(auxiliary,entry.name,`acceptance-${String(item.level??item.run).padStart(6,'0')}.json`),'utf8'));}catch{}
   if(aggregate||item.acceptance?.passed===true&&item.video?.outcome==='completed'&&/^[a-f0-9]{64}$/.test(item.acceptance.sha256||'')&&item.acceptance.file===item.video.file)accepted.push(item);
  }
  for(const item of accepted){
   const level=item.level??item.run;if(!Number.isSafeInteger(level)||level<0||!item.video?.file)continue;
   let file,info;try{file=await realpath(item.video.file);if(!inside(batch,file)||path.extname(file).toLowerCase()!=='.mp4')continue;info=await stat(file);}catch{continue;}
   if(!info.isFile()||info.size<100*1024||item.acceptance?.bytes!=null&&item.acceptance.bytes!==info.size)continue;
   levels.add(level);lastRecordedAt=Math.max(lastRecordedAt||0,info.mtimeMs);
  }
  if(Number.isSafeInteger(report.nativeTotal)&&report.nativeTotal>0)nativeTotal=report.nativeTotal;
  else if(report.nativeCampaignEnd!=null&&report.status==='completed')nativeTotal=new Set(accepted.filter(item=>(item.cycle||0)===0).map(item=>item.scene??item.nativeLevel)).size||nativeTotal;
 }
 return recognized?{videoCount:levels.size,maxLevel:levels.size?Math.max(...levels):0,lastRecordedAt,nativeTotal}:null;
}
