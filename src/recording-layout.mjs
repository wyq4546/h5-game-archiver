import path from 'node:path';
import {mkdir,readdir,rename,lstat,rmdir,realpath} from 'node:fs/promises';

// Shared callers can run from the project root; derive and check the archive.
export async function ensureArchiveRecordingDirectory(projectRoot,videoDirectory,options){
 const directory=path.resolve(videoDirectory),download=path.join(path.resolve(projectRoot),'download');
 const game=path.dirname(path.dirname(path.dirname(directory))),relative=path.relative(download,game);
 if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||relative.includes(path.sep))throw Error('录像只能位于 download/[游戏]/scripts/video/recording-完整UTC时间戳/');
 const physicalDownload=await realpath(download),physicalGame=await realpath(game);
 const equal=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
 if(!equal(path.dirname(physicalGame),physicalDownload))throw Error('录像游戏目录链接越界');
 return ensureGameRecordingDirectory(game,directory,options);
}

// Check the game boundary before creating a batch or moving auxiliary data.
export async function ensureGameRecordingDirectory(gameRoot,videoDirectory,{kind='recording'}={}){
 const root=path.resolve(gameRoot),directory=path.resolve(videoDirectory),scripts=path.join(root,'scripts'),base=path.join(scripts,'video');
 const equal=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
 if(!['recording','review'].includes(kind))throw Error('无效录像批次类型');
 const pattern=new RegExp(`^${kind}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z$`);
 if(!equal(path.dirname(directory),base)||!pattern.test(path.basename(directory)))throw Error(`录像只能放在本游戏 scripts/video/${kind}-完整UTC时间戳/`);
 const physicalRoot=await realpath(root);await mkdir(scripts,{recursive:true});
 if(!equal(await realpath(scripts),path.join(physicalRoot,'scripts')))throw Error('录像 scripts 目录链接越界');
 await mkdir(base,{recursive:true});
 const physicalBase=await realpath(base);
 if(!equal(physicalBase,path.join(physicalRoot,'scripts','video')))throw Error('录像 video 目录链接越界');
 await mkdir(directory,{recursive:true});
 if(!equal(await realpath(directory),path.join(physicalBase,path.basename(directory))))throw Error('录像批次目录链接越界');
 return directory;
}

// Video paths and durable native progress share a batch name, never a tree.
export function recordingDataDirectory(videoDirectory) {
  const absolute=path.resolve(videoDirectory),parts=absolute.split(path.sep),index=parts.lastIndexOf('video');
  if(index<1||parts[index-1]!=='scripts')throw new Error('录制目录必须位于游戏 scripts/video 下');
  parts[index]='recording-data';
  return parts.join(path.sep);
}

export async function ensureRecordingDataDirectory(videoDirectory) {
  const data=recordingDataDirectory(videoDirectory);
  await mkdir(data,{recursive:true});
  // Move old auxiliary files without overwriting evidence. Conflicts need an
  // explicit migration decision rather than silently losing native saves.
  const walk=async(source,target)=>{
    for(const entry of await readdir(source,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;})) {
      const from=path.join(source,entry.name),to=path.join(target,entry.name);
      if(entry.isSymbolicLink())throw Error('辅助数据迁移不遍历目录链接：'+from);
      if(entry.isDirectory()) {
        await walk(from,to);
        if(!(await readdir(from)).length)await rmdir(from);
      } else if(entry.isFile()&&!/\.(?:mp4|webm|mov|mkv|avi)$/i.test(entry.name)) {
        if(await lstat(to).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}))throw Error('辅助数据迁移目标已存在：'+to);
        await mkdir(target,{recursive:true});
        await rename(from,to);
      }
    }
  };
  await walk(videoDirectory,data);
  return data;
}
