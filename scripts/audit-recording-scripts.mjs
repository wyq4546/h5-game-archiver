import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'download'),rows=[];
async function walk(directory,game){for(const entry of await readdir(directory,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
 if(['video','recording-data','.tmp','logs','source','bot'].includes(entry.name))continue;
 const file=path.join(directory,entry.name);if(entry.isDirectory())await walk(file,game);else if(entry.name.endsWith('.mjs')){
  const code=await readFile(file,'utf8');if(!/createVideoRecorder|new MediaRecorder/.test(code))continue;
  const calls=code.split(/\r?\n/).flatMap((line,i)=>/createVideoRecorder|recorder\.start\(|recorder\.prepare\(|new MediaRecorder|captureStream\(/.test(line)?[{line:i+1,text:line.trim().slice(0,350)}]:[]);
  rows.push({game,file,shared:code.includes('src/game-video-recorder.mjs'),explicitPrepare:/recorder\.prepare\(/.test(code),preferredH264:/preferredMimeTypes[^\n]*h264/.test(code),chunkWriting:/deferChunkWrites\s*:\s*true/.test(code)?'explicit-deferred':/deferChunkWrites\s*:\s*false/.test(code)?'explicit-live':'shared-default-or-imported',mobileParameters:{isMobile:/isMobile\s*:\s*true/.test(code),hasTouch:/hasTouch\s*:\s*true/.test(code),userAgent:/userAgent\s*:/.test(code)},motionEvidence:/installNativeRecordingMotion|motionWindows/.test(code),discardedStartupRecorder:/recorder\.start\(0\)/.test(code),calls});
 }
}}
for(const entry of await readdir(root,{withFileTypes:true}))if(entry.isDirectory())await walk(path.join(root,entry.name,'scripts'),entry.name);
for(const [name,games] of [['maze-runner.mjs',['Color-Maze-Puzzle-20260923-044000','Color-Maze-Puzzle-2-20260923-044200']],['unity-maze-runner.mjs',['Maze-Paint-3D-20260923-044500']]]){
 const file=path.resolve('scripts',name),code=await readFile(file,'utf8'),calls=code.split(/\r?\n/).flatMap((line,i)=>/createVideoRecorder|recorder\.start\(|recorder\.prepare\(/.test(line)?[{line:i+1,text:line.trim().slice(0,350)}]:[]);
 for(const game of games)rows.push({game,file,shared:true,explicitPrepare:/recorder\.prepare\(/.test(code),preferredH264:false,mobileParameters:{isMobile:/isMobile\s*:\s*true/.test(code),hasTouch:/hasTouch\s*:\s*true/.test(code),userAgent:/userAgent\s*:/.test(code)},motionEvidence:/installNativeRecordingMotion|motionWindows/.test(code),discardedStartupRecorder:/recorder\.start\(0\)/.test(code),calls});
}
const report={createdAt:new Date().toISOString(),root,note:'Static flow inventory only. Flags may be configured in an imported module: false is a review candidate, not proof of missing runtime behavior. Native full-run and actual movie evidence is required separately; this inventory does not certify games or diagnose existing videos.',scripts:rows};
await mkdir('scripts/logs',{recursive:true});const file=path.resolve('scripts/logs/recording-script-audit.json');await writeFile(file,JSON.stringify(report,null,2));console.log(JSON.stringify({file,scripts:rows.length,games:new Set(rows.map(r=>r.game)).size,localRecorders:rows.filter(r=>!r.shared).map(r=>r.file)}));
