import {parse} from '@babel/parser';
import ivm from 'isolated-vm';
// This module is imported only in the bounded --no-node-snapshot decoder child.
// Execute the string-table scaffold in an isolate with no host references; never the game IIFE.
export function decodeLegacyScaffold(text){
 let ast;try{ast=parse(text,{sourceType:'unambiguous',errorRecovery:true});}catch{return text;}
 const statements=ast.program.body,first=statements[0];
 if(first?.type!=='VariableDeclaration'||first.declarations.length!==1)return text;
 const table=first.declarations[0];if(table.id.type!=='Identifier'||!/^_0x[\da-f]+$/i.test(table.id.name)||table.init?.type!=='ArrayExpression'||!table.init.elements.every(e=>e?.type==='StringLiteral'))return text;
 const roots=new Set();let end=first.end,scaffold=null;
 for(const n of statements.slice(1,4)){
  if(n.type==='FunctionDeclaration'&&/^_0x[\da-f]+$/i.test(n.id.name)){roots.add(n.id.name);end=n.end;continue;}
  if(n.type==='VariableDeclaration'&&n.declarations.length===1&&n.declarations[0].init?.type==='FunctionExpression'){roots.add(n.declarations[0].id.name);end=n.end;continue;}
  const expression=n.type==='ExpressionStatement'?n.expression:null;
  const call=expression?.type==='SequenceExpression'?expression.expressions[0]:expression;
  if(expression?.type==='SequenceExpression' && call?.type==='CallExpression' && call.callee.type==='FunctionExpression' && call.arguments[0]?.name===table.id.name && call.arguments[1]?.type==='NumericLiteral'){scaffold=text.slice(0,end)+';('+text.slice(call.start,call.end)+');';end=call.end;break;}
  if(call?.type==='CallExpression'&&call.callee.type==='FunctionExpression'&&call.arguments[0]?.name===table.id.name&&call.arguments[1]?.type==='NumericLiteral'){end=n.end;continue;}
  break;
 }
 if(!roots.size)return text;
 const nodes=[],todo=[ast.program];while(todo.length){const n=todo.pop();if(!n||typeof n!=='object')continue;nodes.push(n);for(const[k,v]of Object.entries(n))if(!['loc','start','end','extra','comments','tokens','errors'].includes(k)){if(Array.isArray(v))todo.push(...v);else if(v&&typeof v==='object')todo.push(v);}}
 const safe=(n,params)=>n?.type==='NumericLiteral'||n?.type==='StringLiteral'||(n?.type==='Identifier'&&params.has(n.name))||(n?.type==='UnaryExpression'&&['+','-'].includes(n.operator)&&safe(n.argument,params))||(n?.type==='BinaryExpression'&&['+','-'].includes(n.operator)&&safe(n.left,params)&&safe(n.right,params));
 const bindings=new Map();for(const n of nodes){if((n.type==='VariableDeclarator'||n.type==='FunctionDeclaration')&&n.id?.type==='Identifier')bindings.set(n.id.name,(bindings.get(n.id.name)||0)+1);if(n.params)for(const p of n.params)if(p.type==='Identifier')bindings.set(p.name,(bindings.get(p.name)||0)+1);}
 const ambiguous=new Set([...bindings].filter(([,count])=>count>1).map(([name])=>name));if([...roots].some(name=>ambiguous.has(name)))return text;
 const wrappers=new Map();let added=true;
 while(added){added=false;for(const n of nodes){if(n.type!=='FunctionDeclaration'||!n.id||roots.has(n.id.name)||ambiguous.has(n.id.name)||wrappers.has(n.id.name)||n.body.body.length!==1||n.body.body[0].type!=='ReturnStatement')continue;const c=n.body.body[0].argument,params=new Set(n.params.filter(p=>p.type==='Identifier').map(p=>p.name));if(c?.type==='CallExpression'&&c.callee.type==='Identifier'&&(roots.has(c.callee.name)||wrappers.has(c.callee.name))&&c.arguments.every(a=>safe(a,params))){wrappers.set(n.id.name,text.slice(n.start,n.end));added=true;}}}
 const names=new Set([...roots,...wrappers.keys()]);
 const calls=nodes.filter(n=>n.start>=end&&n.type==='CallExpression'&&n.callee.type==='Identifier'&&names.has(n.callee.name)&&n.arguments.every(a=>safe(a,new Set()))).sort((a,b)=>a.start-b.start);
 if(calls.length>20000)return text;
 const isolate=new ivm.Isolate({memoryLimit:64});
 try{const context=isolate.createContextSync();context.evalSync('globalThis.window=globalThis;'+(scaffold||text.slice(0,end))+'\n'+[...wrappers.values()].join('\n'),{timeout:1500});
  const edits=[];for(let i=0;i<calls.length;i+=500){const batch=calls.slice(i,i+500),code='JSON.stringify(['+batch.map(c=>'(()=>{try{return '+text.slice(c.start,c.end)+';}catch{return null;}})()').join(',')+'])';const values=JSON.parse(context.evalSync(code,{timeout:1500}));for(let j=0;j<batch.length;j++)if(typeof values[j]==='string')edits.push({node:batch[j],value:values[j]});}
  for(const e of edits.sort((a,b)=>b.node.start-a.node.start))text=text.slice(0,e.node.start)+JSON.stringify(e.value)+text.slice(e.node.end);return text;
 }catch{return text;}finally{isolate.dispose();}
}
