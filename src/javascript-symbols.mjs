import {parse} from '@babel/parser';
import traversePackage from '@babel/traverse';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const traverse=traversePackage.default||traversePackage;

export function indexJavaScriptSource(source){
 const ast=parse(source,{sourceType:'unambiguous'}),scopes=[],symbols=[],ids=new WeakMap();
 const scopeId=scope=>{
  if(!scope)return null;if(ids.has(scope))return ids.get(scope);
  const parent=scopeId(scope.parent),id=scopes.length;ids.set(scope,id);
  scopes.push({id,parent,type:scope.block.type,start:scope.block.start,end:scope.block.end,bindings:Object.entries(scope.bindings).map(([name,b])=>({name,kind:b.kind,start:b.identifier.start,end:b.identifier.end}))});return id;
 };
 const nameOf=p=>p.node.id?.name||p.node.key?.name||p.node.key?.value||(p.parentPath?.isVariableDeclarator()?p.parentPath.node.id?.name:null)||(p.parentPath?.isAssignmentExpression()?p.parentPath.node.left.property?.name:null)||null;
 traverse(ast,{enter(p){scopeId(p.scope);if(p.isFunction()||p.isClass())symbols.push({type:p.node.type,name:nameOf(p),scope:scopeId(p.scope),start:p.node.start,end:p.node.end,line:p.node.loc.start.line,parameters:p.node.params?.map(n=>source.slice(n.start,n.end))});}});
 return {version:1,parser:'@babel/parser + @babel/traverse lexical bindings',sourceType:ast.program.sourceType,scopes,symbols,counts:{functions:symbols.filter(n=>/Function|Method/.test(n.type)).length,classes:symbols.filter(n=>/^Class(?:Declaration|Expression)$/.test(n.type)).length,scopes:scopes.length,bindings:scopes.reduce((n,s)=>n+s.bindings.length,0)}};
}

export async function writeJavaScriptIndex(root,relative){
 const file=path.resolve(root,relative),base=path.resolve(root)+path.sep;if(!file.startsWith(base))throw Error('源码路径越过游戏目录');
 const bytes=await fs.readFile(file),sha256=createHash('sha256').update(bytes).digest('hex');
 try {
  const index=indexJavaScriptSource(bytes.toString('utf8')),output='analysis/source-scopes/'+sha256+'.json';
  await fs.mkdir(path.join(root,'analysis/source-scopes'),{recursive:true});await fs.writeFile(path.join(root,output),JSON.stringify({file:relative,sha256,...index}));
  return {status:'parsed',sha256,output,...index.counts,sourceType:index.sourceType};
 }catch(error){return {status:'failed',sha256,reason:error.message};}
}
