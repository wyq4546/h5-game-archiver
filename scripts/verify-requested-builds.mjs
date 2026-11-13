import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {brotliDecompressSync,gunzipSync} from 'node:zlib';
const root=path.resolve(import.meta.dirname,'..');
const names=['Ammo-C40ec84d-20261031-224739','Twerk-Race-3D-20261101-050412','Giant-Rush-20261101-051728','Insect-Evolution-Spider-Run-20261101-052427','Merge-Squad-2048-20261101-053040','Real-War-Not-Fake-20261101-062640','Join-Blob-Clash-20261101-064902','My-Pet-Evolution-Run-20261101-065436'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const unpack=(b,magic)=>{if(b.subarray(0,magic.length).equals(Buffer.from(magic)))return b;for(const decode of [brotliDecompressSync,gunzipSync]){try{const d=decode(b);if(d.subarray(0,magic.length).equals(Buffer.from(magic)))return d;}catch{}}throw Error('Unrecognized payload');};
const results=[];
for(const name of names){
 const dir=path.join(root,'download',name),result={name,checkedAt:new Date().toISOString(),checks:[],errors:[],runtimeVerified:false,strategyVerified:false};
 try{
  const report=JSON.parse(await readFile(path.join(dir,'analysis/report.json'),'utf8'));result.engine=report.engine;
  for(const file of ['analysis/report.json','analysis/source-index.json','scripts/automation-context.json'])await readFile(path.join(dir,file));
  for(const item of report.prioritizedScripts??[]){
   if(!item.ast?.sha256)continue;
   const actual=hash(await readFile(path.join(dir,item.file)));
   if(actual!==item.ast.sha256)throw Error('Source hash mismatch: '+item.file);
   await readFile(path.join(dir,item.ast.output));
   result.checks.push({file:item.file,sha256:actual,kind:'source-index-match'});
  }
  for(const item of report.wasmFiles??[]){
   if(!item.extractedFile)continue;
   const original=unpack(await readFile(path.join(dir,item.file)),[0,97,115,109]);
   const extracted=await readFile(path.join(dir,'analysis',item.extractedFile));
   if(hash(original)!==hash(extracted))throw Error('WASM mismatch: '+item.file);
   result.checks.push({file:item.file,sha256:hash(original),kind:'wasm-match'});
  }
  if(report.engine==='Unity WebGL'){
   if(report.il2cpp?.validation?.status!=='completed')throw Error('IL2CPP mapping incomplete');
   for(const file of ['analysis/il2cpp/dump.cs','analysis/il2cpp/script.json','analysis/bot/runtime.mjs','analysis/bot/context.json'])await readFile(path.join(dir,file));
   for(const item of report.unityDataFiles??[]){
    if(!item.metadataRelative)continue;
    const data=unpack(await readFile(path.join(dir,item.file)),Buffer.from('UnityWebData1.0\0'));
    const magicLength=Buffer.byteLength('UnityWebData1.0\0');const header=data.readUInt32LE(magicLength);let pos=magicLength+4,matched=false;
    while(pos<header){const off=data.readUInt32LE(pos),len=data.readUInt32LE(pos+4),n=data.readUInt32LE(pos+8);pos+=12;const file=data.toString('utf8',pos,pos+n);pos+=n;if(file.endsWith('global-metadata.dat')){const extracted=await readFile(path.join(dir,'analysis',item.metadataRelative));if(hash(data.subarray(off,off+len))!==hash(extracted))throw Error('Metadata mismatch');result.checks.push({file:item.metadataRelative,sha256:hash(extracted),kind:'data-metadata-match'});matched=true;}}
    if(!matched)throw Error('Metadata absent from data header');
   }
  }
  result.status='static-build-verified';
 }catch(e){result.status='failed';result.errors.push(e.message);}
 results.push(result);console.log(result.name,result.status,result.errors.join(';'));
}
const output=process.argv[2];if(output){await mkdir(path.dirname(path.resolve(output)),{recursive:true});await writeFile(output,JSON.stringify({note:'Static build matching only. Does not certify gameplay, runtime loading, audio or recording.',results},null,2));}
if(results.some(r=>r.status==='failed'))process.exitCode=1;
