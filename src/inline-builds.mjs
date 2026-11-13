import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
const require=createRequire(import.meta.url);
const {parse}=require('@babel/parser');
const {PNG}=require('pngjs');

// Read publisher literals as data. Never evaluate downloaded JavaScript.
export function inlineGameBuilds(html){
 if(!html.includes('game-code-pako'))return [];
 const builds=[];
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
  if(!match[1].includes('game-code-pako'))continue;
  const ast=parse(match[1],{sourceType:'script'});
  for(const statement of ast.program.body){
   const e=statement.expression;
   if(e?.type!=='AssignmentExpression'||e.operator!=='='||e.left?.type!=='Identifier'||e.left.name!=='Settings'||e.right?.type!=='ObjectExpression')continue;
   for(const p of e.right.properties){
    if(p.type!=='ObjectProperty'||p.computed||(p.key.value??p.key.name)!=='game-code-pako'||p.value.type!=='StringLiteral')continue;
    const value=p.value.value;
    if(!value||value.length>8*1024*1024||[...value].some(c=>c.charCodeAt(0)>255))throw Error('Invalid inline zlib payload');
    const bytes=Buffer.from(value,'latin1'),code=inflateSync(bytes,{maxOutputLength:16*1024*1024}).toString('utf8');
    parse(code,{sourceType:'unambiguous'});
    builds.push({code,compression:'zlib',compressedBytes:bytes.length,sha256:createHash('sha256').update(code).digest('hex')});
   }
  }
 }
 return builds;
}

export function isEmbeddedPixiGame(code,html){
 // A library or compatibility mention alone is not a complete game. Require
 // the runtime implementation, renderer bootstrap, game entry and real image
 // bytes embedded in the same publisher document.
 if(!/\bvar\s+PIXI\s*=\s*function\b/.test(code)||!/\.getContext\s*\(\s*["'](?:webgl|experimental-webgl)["']/.test(code)||
    !/\bPIXI\.autoDetectRenderer\s*\(/.test(code)||!/\b(?:var|let|const)\s+App\s*=\s*new\s+Game\s*\(/.test(code)||!/\bEngine\s*:\s*["']Pixi["']/.test(code))return false;
 for(const m of html.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)){
  const image=Buffer.from(m[1],'base64');
  if(image.length>32&&image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&image.toString('ascii',12,16)==='IHDR'){
   const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
   if(!width||!height||width*height>16*1024*1024)continue;
   try{PNG.sync.read(image,{checkCRC:true});return true;}catch{}
  }
 }
 return false;
}
