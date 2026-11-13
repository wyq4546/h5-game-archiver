import {parse} from '@babel/parser';
// Match native basename-to-file helpers and the fields passed to them.
// No publisher code is evaluated and no numeric filenames are guessed.
export function configuredAssetTemplates(source){
 let ast;try{ast=parse(source,{sourceType:'unambiguous',errorRecovery:true});}catch{return [];}
 const nodes=[];const walk=n=>{if(!n||typeof n!=='object')return;if(n.type)nodes.push(n);for(const [k,v] of Object.entries(n)){if(['loc','start','end','extra','comments'].includes(k))continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}};walk(ast.program);
 const prop=n=>n?.type==='Identifier'?n.name:n?.type==='StringLiteral'?n.value:null;
 const helpers=new Map();
 for(const n of nodes){if(n.type!=='ClassMethod'||!n.static||n.params.length!==1||n.params[0].type!=='Identifier')continue;const r=n.body.body.find(x=>x.type==='ReturnStatement')?.argument;
  if(r?.type!=='BinaryExpression'||r.operator!=='+'||r.right.type!=='StringLiteral'||!/^\.(ls|lh|json)$/.test(r.right.value))continue;
  const left=r.left;if(left.type!=='BinaryExpression'||left.operator!=='+'||left.left.type!=='StringLiteral'||left.right.name!==n.params[0].name||!/^res\/[\w/-]+\/$/.test(left.left.value))continue;
  helpers.set(prop(n.key),{prefix:left.left.value,suffix:r.right.value});
 }
 const out=[];
 for(const n of nodes){if(n.type!=='BinaryExpression'||n.operator!=='+'||n.right.type!=='StringLiteral'||!/^\.(ls|lh|json)$/.test(n.right.value))continue;const l=n.left;if(l.type!=='BinaryExpression'||l.operator!=='+'||l.left.type!=='StringLiteral'||!/^res\/[\w/-]+\/$/.test(l.left.value)||l.right.type!=='MemberExpression')continue;const field=prop(l.right.property);if(field)out.push({prefix:l.left.value,suffix:n.right.value,field});}
 for(const n of nodes){if(n.type!=='CallExpression'||n.callee.type!=='MemberExpression')continue;const helper=helpers.get(prop(n.callee.property)),a=n.arguments[0];if(helper&&a?.type==='MemberExpression'){const field=prop(a.property);if(field)out.push({...helper,field});}}
 return [...new Map(out.map(v=>[JSON.stringify(v),v])).values()];
}
export function configuredAssetDependencies(data,templates){
 const out=new Set();const walk=n=>{if(!n||typeof n!=='object')return;for(const t of templates){const name=n[t.field];if(typeof name==='string'&&/^[\w/-]+$/.test(name))out.add(t.prefix+name+t.suffix);}for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);};walk(data);return [...out];
}
