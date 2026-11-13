import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from '@babel/parser';

function literal(node) {
 if(['StringLiteral','NumericLiteral','BooleanLiteral'].includes(node?.type))return node.value;
 if(node?.type==='ArrayExpression')return node.elements.map(literal);
 if(node?.type==='ObjectExpression')return Object.fromEntries(node.properties.map(p=>{
  if(p.type!=='ObjectProperty'||p.computed)throw Error('Nonliteral Emscripten package property');
  return [p.key.name??p.key.value,literal(p.value)];
 }));
 throw Error('Nonliteral Emscripten package metadata');
}

export function readEmscriptenPackage(source,bytes) {
 const ast=parse(source,{sourceType:'unambiguous'}),stack=[ast];let metadata,base;
 while(stack.length){const n=stack.pop();if(!n||typeof n!=='object')continue;
  if(n.type==='VariableDeclarator'&&n.id.name==='REMOTE_PACKAGE_BASE'&&n.init?.type==='StringLiteral')base=n.init.value;
  if(n.type==='CallExpression'&&n.callee.name==='loadPackage'&&n.arguments[0]?.type==='ObjectExpression')metadata=literal(n.arguments[0]);
  for(const [k,v] of Object.entries(n)){if(['loc','comments','tokens'].includes(k))continue;if(Array.isArray(v))stack.push(...v);else if(v&&typeof v==='object')stack.push(v);}
 }
 if(!base||!metadata?.files?.length)throw Error('No static Emscripten loadPackage metadata');
 if(metadata.remote_package_size!==bytes.length)throw Error('Emscripten Data size mismatch');
 const files=metadata.files.map(f=>{
  const name=path.posix.normalize(f.filename.replace(/^\/+/,''));
  if(name==='..'||name.startsWith('../')||name!==f.filename.replace(/^\/+/,''))throw Error('Unsafe embedded file path');
  if(!Number.isSafeInteger(f.start)||!Number.isSafeInteger(f.end)||f.start<0||f.end<f.start||f.end>bytes.length)throw Error('Invalid embedded file range');
  return {...f,name};
 });
 return {base,bytes:bytes.length,files};
}

export async function analyzeEmscriptenData(root,loaderFile) {
 const source=await fs.readFile(path.join(root,loaderFile),'utf8');
 const base=source.match(/\bREMOTE_PACKAGE_BASE\s*=\s*"([^"\r\n]+)"/)?.[1];
 if(!base)throw Error('No Emscripten Data filename');
 const dataFile=path.posix.join(path.posix.dirname(loaderFile),base),absolute=path.resolve(root,dataFile);
 if(!absolute.startsWith(path.resolve(root)+path.sep))throw Error('Data path outside archive');
 const data=await fs.readFile(absolute),model=readEmscriptenPackage(source,data),hash=createHash('sha256').update(data).digest('hex');
 const files=[];
 for(const item of model.files){const output=path.posix.join('analysis/emscripten',hash.slice(0,16),'files',item.name),body=data.subarray(item.start,item.end);await fs.mkdir(path.dirname(path.join(root,output)),{recursive:true});await fs.writeFile(path.join(root,output),body);files.push({...item,output,sha256:createHash('sha256').update(body).digest('hex')});}
 const result={status:'extracted',loaderFile,loaderSha256:createHash('sha256').update(source).digest('hex'),dataFile,dataSha256:hash,bytes:data.length,files};
 await fs.writeFile(path.join(root,'analysis/emscripten/file-index.json'),JSON.stringify(result,null,2)+'\n');return result;
}
