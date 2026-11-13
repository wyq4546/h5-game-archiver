import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source='tools/wabt/include/wabt/opcode.def',bytes=await fs.readFile(source),entries=[];
const scalar={0x06:'blocktype',0x07:'u32',0x08:'u32',0x09:'u32',0x12:'func',0x13:'callindirect',0x14:'u32',0x15:'u32',0x18:'u32',0x1c:'types',0x25:'u32',0x26:'u32',0xd0:'s33',0xd2:'func',0xd5:'u32',0xd6:'u32'};
for(const line of bytes.toString('utf8').split(/\r?\n/)){
 const match=line.match(/^WABT_OPCODE\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*(\d+),\s*(0x[\da-f]+|0),\s*(0x[\da-f]+),\s*\w+,\s*"([^"]+)"/i);if(!match)continue;
 const memoryBytes=Number(match[1]),prefix=Number(match[2]),code=Number(match[3]),name=match[4];let immediate;
 if(prefix===0){
  if(code<0x45&&!Object.hasOwn(scalar,code))continue;
  if(code===0x1f)continue;
  immediate=scalar[code];
 }else if(prefix===0xfd){
  immediate=memoryBytes?name.endsWith('_lane')?'memlane':'memarg':name==='v128.const'||name==='i8x16.shuffle'?'bytes16':/(?:extract|replace)_lane(?:_[su])?$/.test(name)?'lane':undefined;
 }else if(prefix===0xfc){
  if([8,10,12,14].includes(code))immediate='twoindices';else if([9,11,13,15,16,17,18].includes(code))immediate='u32';else if(code>22)continue;
 }else if(prefix===0xfe){if(code>0x4e)continue;immediate=memoryBytes?'memarg':name==='atomic.fence'?'lane':undefined;}
 else continue;
 entries.push({prefix,code,name,...(immediate?{immediate}:{})});
}
const table={source,sourceSha256:createHash('sha256').update(bytes).digest('hex'),license:'Apache-2.0; copyright WebAssembly Community Group participants; see tools/wabt/LICENSE',entries};
await fs.writeFile('src/wasm-opcodes.json',JSON.stringify(table,null,2)+'\n');console.log(JSON.stringify({source,opcodes:entries.length}));
