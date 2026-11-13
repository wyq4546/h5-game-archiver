import {parse} from '@babel/parser';
// Resolve only verified wrapper templates: prefix+parameter, optional local alias,
// then alias+audio extension in the SAME wrapper. Never invent sound names.
export function wrappedAudioDependencies(source){
 let ast;try{ast=parse(source,{sourceType:'unambiguous',errorRecovery:true})}catch{return []}
 const methods=new Map(),calls=[],vars=new Map(),addVar=(k,v)=>{if(!k||!v)return;if(!vars.has(k))vars.set(k,new Set());vars.get(k).add(v);};
 const walk=(n,fn)=>{if(!n||typeof n!=='object')return;if(n.type)fn(n);for(const[k,v]of Object.entries(n)){if(['loc','start','end','extra','comments'].includes(k))continue;if(Array.isArray(v))v.forEach(c=>walk(c,fn));else if(v&&typeof v==='object')walk(v,fn)}};
 const name=n=>n?.type==='Identifier'?n.name:n?.type==='StringLiteral'?n.value:null;
 const addExpr=(id,e)=>{if(!id||!e)return;if(e.type==='StringLiteral')addVar(id,e.value);else if(e.type==='BinaryExpression'&&e.operator==='+'&&e.left?.type==='StringLiteral'&&e.right?.type==='CallExpression'&&name(e.right.callee?.property)==='floor'){const m=e.right.arguments[0];const n=m?.type==='BinaryExpression'&&m.operator==='*'&&(m.left?.type==='NumericLiteral'?m.left.value:m.right?.type==='NumericLiteral'?m.right.value:0);if(Number.isInteger(n)&&n>0&&n<=32)for(let i=0;i<n;i++)addVar(id,e.left.value+i);}};
 walk(ast,n=>{if(n.type==='VariableDeclarator'&&n.id?.type==='Identifier')addExpr(n.id.name,n.init);if(n.type==='AssignmentExpression'&&n.left?.type==='Identifier')addExpr(n.left.name,n.right);if(['ClassMethod','ObjectMethod'].includes(n.type)&&n.params[0]?.type==='Identifier'){
  const key=name(n.key),arg=n.params[0].name;let prefix,ext;const aliases=new Set();
  walk(n.body,b=>{if(b.type==='VariableDeclarator'&&b.id.type==='Identifier'&&b.init?.type==='BinaryExpression'&&b.init.operator==='+'&&b.init.left.type==='StringLiteral'&&b.init.right.type==='Identifier'&&b.init.right.name===arg&&/^(?:res\/)?(?:sound|sounds|audio|music)\/$/.test(b.init.left.value)){prefix=b.init.left.value;aliases.add(b.id.name)}});
  walk(n.body,b=>{if(b.type==='BinaryExpression'&&b.operator==='+'&&b.left.type==='Identifier'&&aliases.has(b.left.name)&&b.right.type==='StringLiteral'&&/^\.(mp3|ogg|wav|m4a)$/.test(b.right.value))ext=b.right.value});
  walk(n.body,b=>{const t=b?.left;if(b.type==='BinaryExpression'&&b.operator==='+'&&/^\.(mp3|ogg|wav|m4a)$/.test(b.right?.value||'')&&t?.type==='BinaryExpression'&&t.operator==='+'&&t.left?.type==='StringLiteral'&&/^(?:res\/)?(?:sound|sounds|audio|music)\/$/i.test(t.left.value)&&t.right?.name===arg){prefix=t.left.value;ext=b.right.value}});
  if(key&&prefix&&ext){if(!methods.has(key))methods.set(key,[]);methods.get(key).push({prefix,ext})}
 }if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'){const k=name(n.callee.property),a=n.arguments[0];if(a?.type==='StringLiteral')calls.push({key:k,value:a.value});else if(a?.type==='Identifier')calls.push({key:k,id:a.name});}});
 const out=new Set();for(const c of calls){const vals=c.id?[...(vars.get(c.id)||[])]:[c.value];for(const v of vals)if(/^[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*$/.test(v))for(const t of methods.get(c.key)||[])out.add(t.prefix+v+t.ext);}return [...out];
}
