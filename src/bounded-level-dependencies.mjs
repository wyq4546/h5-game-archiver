import {parse} from '@babel/parser';
export function boundedLevelDependencies(source){
 let ast;try{ast=parse(source,{sourceType:'unambiguous',errorRecovery:true})}catch{return []}
 const nodes=[];function walk(n){if(!n||typeof n!=='object')return;if(n.type)nodes.push(n);for(const[k,v]of Object.entries(n)){if(['loc','start','end','extra','comments'].includes(k))continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}}walk(ast);
 const prop=n=>n?.type==='Identifier'?n.name:n?.type==='StringLiteral'?n.value:null;
 const ref=n=>n?.type==='Identifier'?n.name:n?.type==='MemberExpression'?ref(n.object)+'.'+prop(n.property):null;
 const ranges=new Map();
 for(const m of nodes.filter(n=>n.type==='ClassMethod')){
  const body=source.slice(m.body.start,m.body.end);
  // A native level counter is capped, then replaced by an explicit bounded RNG.
  const bound=body.match(/([\w$]+)\s*>\s*(0x[\da-f]+|\d+)\s*&&/i);
  if(!bound)continue;const max=Number(bound[2]),v=bound[1];if(max<1||max>32)continue;
  const escaped=v.replace(/[$]/g,'\\$');
  const rng=new RegExp(escaped+'\\s*=\\s*[$\\w]+(?:\\["RandomInt"\\]|\\.RandomInt)\\(\\s*(0x[\\da-f]+|\\d+)\\s*,\\s*(0x[\\da-f]+|\\d+)\\s*\\)','i').exec(body);
  if(rng&&Number(rng[1])>=1&&Number(rng[2])===max+1&&new RegExp('(?:return\\s+|,\\s*)'+escaped+'\\s*;').test(body))ranges.set(prop(m.key),[1,max]);
 }
 const variables=new Map();for(const n of nodes){if(n.type==='AssignmentExpression'&&n.right?.type==='CallExpression'){const range=ranges.get(prop(n.right.callee.property));if(range)variables.set(ref(n.left),range)}}
 const out=new Set();for(const n of nodes){if(n.type!=='BinaryExpression'||n.operator!=='+'||n.right.type!=='StringLiteral'||!/^\.(ls|lh|json)$/.test(n.right.value)||n.left.type!=='BinaryExpression'||n.left.operator!=='+'||n.left.left.type!=='StringLiteral')continue;const range=variables.get(ref(n.left.right));const prefix=n.left.left.value;if(!range||!/^res\/[^\r\n]+$/.test(prefix))continue;for(let i=range[0];i<=range[1];i++)out.add(prefix+i+n.right.value)}return [...out];
}
