import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,access,rm,realpath,symlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ensureGameRecordingDirectory,ensureArchiveRecordingDirectory,recordingDataDirectory} from '../src/recording-layout.mjs';
const temporaryRoot=fileURLToPath(new URL('../.tmp/',import.meta.url));
const batch='recording-2026-10-03T12-00-00-000Z';
async function fixture(run){
 await mkdir(temporaryRoot,{recursive:true});const folder=await mkdtemp(path.join(temporaryRoot,'recording-path-test-'));
 const game=path.join(folder,'game'),other=path.join(folder,'other');await mkdir(game,{recursive:true});await mkdir(path.join(other,'scripts','video'),{recursive:true});
 try{await run({folder,game,other});}finally{const base=await realpath(temporaryRoot),target=await realpath(folder);assert(target.startsWith(base+path.sep));await rm(target,{recursive:true,force:true});}
}
test('recording path creates only the owning game standard batch',()=>fixture(async({game})=>{
 const directory=path.join(game,'scripts','video',batch);assert.equal(await ensureGameRecordingDirectory(game,directory),directory);
 assert.equal(await realpath(directory),directory);assert.equal(recordingDataDirectory(directory),path.join(game,'scripts','recording-data',batch));
}));
test('recording path rejects other game, missing batch, nested batch and malformed names',()=>fixture(async({game,other})=>{
 for(const directory of [path.join(other,'scripts','video',batch),path.join(game,'scripts','video'),path.join(game,'scripts','video','misc',batch),path.join(game,'scripts','video','smooth-final')])await assert.rejects(ensureGameRecordingDirectory(game,directory),/scripts\/video\/recording-/);
 await assert.rejects(access(path.join(other,'scripts','video',batch)),{code:'ENOENT'});
}));
test('recording path refuses a video junction before creating a batch in its target',()=>fixture(async({game,other})=>{
 await mkdir(path.join(game,'scripts'));await symlink(path.join(other,'scripts','video'),path.join(game,'scripts','video'),process.platform==='win32'?'junction':'dir');
 await assert.rejects(ensureGameRecordingDirectory(game,path.join(game,'scripts','video',batch)),/目录链接越界/);
 await assert.rejects(access(path.join(other,'scripts','video',batch)),{code:'ENOENT'});
}));
test('recording path preserves an existing resume video',()=>fixture(async({game})=>{
 const directory=path.join(game,'scripts','video',batch);await mkdir(directory,{recursive:true});const file=path.join(directory,'level-000001.mp4');await writeFile(file,'existing video fixture');
 await ensureGameRecordingDirectory(game,directory);assert.equal(await readFile(file,'utf8'),'existing video fixture');
}));
test('shared recorder accepts a standard archive batch and refuses a project-level output',()=>fixture(async({folder})=>{
 const game=path.join(folder,'download','Example-Game');await mkdir(game,{recursive:true});
 const directory=path.join(game,'scripts','video',batch);assert.equal(await ensureArchiveRecordingDirectory(folder,directory),directory);
 await assert.rejects(ensureArchiveRecordingDirectory(folder,path.join(folder,'scripts','video',batch)),/download/);
}));
test('shared recorder refuses an archive game junction that leaves download',()=>fixture(async({folder,other})=>{
 await mkdir(path.join(folder,'download'));const game=path.join(folder,'download','Linked-Game');
 await symlink(other,game,process.platform==='win32'?'junction':'dir');
 await assert.rejects(ensureArchiveRecordingDirectory(folder,path.join(game,'scripts','video',batch)),/游戏目录链接越界/);
 await assert.rejects(access(path.join(other,'scripts','video',batch)),{code:'ENOENT'});
}));
