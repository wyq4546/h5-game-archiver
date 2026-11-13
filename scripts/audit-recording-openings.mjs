import {readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),root=path.resolve(process.argv[2]||'download'),out=path.resolve('scripts/logs/recording-opening-audit.json');
const files=[];
async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
 const file=path.join(directory,entry.name);if(entry.isDirectory())await walk(file);else if(/\.(mp4|webm)$/i.test(entry.name))files.push(file);
}}
for(const game of await readdir(root,{withFileTypes:true}))if(game.isDirectory())await walk(path.join(root,game.name,'scripts','video'));
const report={createdAt:new Date().toISOString(),root,rule:'Diagnostic only: stationary native scenes require manual/native timeline review; no automatic deletion.',files:[]};
await mkdir(path.dirname(out),{recursive:true});
let next=0;
async function worker(){while(next<files.length){const file=files[next++];try{
 const {stderr}=await exec(process.env.GAME_FFMPEG||'ffmpeg',['-hide_banner','-nostdin','-i',file,'-t','2','-vf','scale=160:284,freezedetect=n=-60dB:d=0.05','-an','-threads','1','-f','null','NUL'],{windowsHide:true,maxBuffer:512*1024});
 const freezes=[];let start;
 for(const match of stderr.matchAll(/freeze_(start|duration|end): ([\d.]+)/g)){
   const value=Number(match[2]);if(match[1]==='start'){start=value;freezes.push({start});}else if(freezes.length)freezes.at(-1)[match[1]]=value;
 }
 report.files.push({file,freezes,coldStartPattern:freezes.some(f=>f.start>0&&f.start<0.5&&f.duration>=0.2&&f.end<1.2)});
 }catch(error){report.files.push({file,error:error.stderr?.slice(-500)||error.message});}
 if(report.files.length%50===0){console.log('扫描 '+report.files.length+'/'+files.length);await writeFile(out,JSON.stringify(report,null,2));}
}}
await Promise.all([worker(),worker()]);report.completedAt=new Date().toISOString();await writeFile(out,JSON.stringify(report,null,2));
console.log(JSON.stringify({report:out,count:files.length,coldStartPatterns:report.files.filter(f=>f.coldStartPattern).length,failed:report.files.filter(f=>f.error).length}));
