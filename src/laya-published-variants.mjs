import {parse} from '@babel/parser';
export function layaPublishedVariants(text){
 let ast;try{ast=parse(text,{sourceType:'unambiguous',errorRecovery:true});}catch{return {prefabs:[],themes:[],ui:[]};}
 const nodes=[],q=[ast.program];while(q.length){const n=q.pop();if(!n||typeof n!=='object')continue;nodes.push(n);for(const[k,v]of Object.entries(n))if(!['loc','start','end','extra','comments','errors'].includes(k)){if(Array.isArray(v))q.push(...v);else if(v&&typeof v==='object')q.push(v);}}
 const property=n=>n?.computed?n.property?.value:n?.property?.name,decls=new Map();for(const n of nodes)if(n.type==='VariableDeclarator'&&n.id.type==='Identifier'){const a=decls.get(n.id.name)||[];a.push(n);decls.set(n.id.name,a);}const single=n=>decls.get(n)?.length===1?decls.get(n)[0]:null;
 const prefabs=[];for(const n of nodes){if(n.type!=='AssignmentExpression'||n.operator!=='='||n.left.type!=='Identifier'||n.right.type!=='ConditionalExpression')continue;const name=n.left.name,c=n.right,d=single(name);if(property(d?.init)!=='a'||c.alternate?.name!==name||c.consequent.type!=='StringLiteral'||!/^\w[\w-]*$/.test(c.consequent.value))continue;if(!nodes.some(x=>x.type==='CallExpression'&&property(x.callee)==='selectProp'&&x.arguments[0]?.name===name))continue;const tests=[c.test];while(tests.length){const t=tests.pop();if(t.type==='LogicalExpression')tests.push(t.left,t.right);else if(t.type==='BinaryExpression'&&['==','==='].includes(t.operator)){const literal=t.left.type==='StringLiteral'?t.left:t.right,id=t.left.type==='Identifier'?t.left:t.right;if(id.name===name&&literal.type==='StringLiteral')prefabs.push({from:literal.value,to:c.consequent.value});}}}
 const themes=new Set();for(const n of nodes){if(n.type!=='BinaryExpression'||n.operator!=='+')continue;const tokens=[];const flatten=x=>{if(x.type==='BinaryExpression'&&x.operator==='+'){flatten(x.left);flatten(x.right);}else tokens.push(x);};flatten(n);if(tokens.length!==3||tokens[0].type!=='StringLiteral'||tokens[2].type!=='StringLiteral'||tokens[1].type!=='ConditionalExpression')continue;const c=tokens[1],t=c.test;if(t.type!=='BinaryExpression'||!['!=','!==','==','==='].includes(t.operator))continue;const id=t.left.type==='Identifier'?t.left:t.right,zero=t.left.type==='NumericLiteral'?t.left:t.right,d=single(id.name),mod=d?.init;if(zero.value!==0||mod?.type!=='BinaryExpression'||mod.operator!=='%'||mod.right.type!=='NumericLiteral'||!Number.isInteger(mod.right.value)||mod.right.value<1||mod.right.value>32)continue;const value=(x,i)=>x.type==='Identifier'&&x.name===id.name?i:x.type==='NumericLiteral'?x.value:NaN;for(let i=0;i<mod.right.value;i++){const condition=['!=','!=='].includes(t.operator)?i!==0:i===0,k=value(condition?c.consequent:c.alternate,i);if(Number.isFinite(k))themes.add(tokens[0].value+k+tokens[2].value);}}
 // Some published games pass a bounded texture name through selectTexture.
 // Bind the helper's parameter to its actual literal URL template and require
 // the exact same modulo expression in both ternary branches.
 const flatten=n=>n?.type==='BinaryExpression'&&n.operator==='+'?[...flatten(n.left),...flatten(n.right)]:[n];
 const key=n=>n?.type==='Identifier'?n.name:n?.type==='MemberExpression'?key(n.object)+'.'+property(n):n?.type==='NumericLiteral'?String(n.value):null;
 const modKey=n=>n?.type==='BinaryExpression'&&n.operator==='%'&&key(n.left)&&n.right.type==='NumericLiteral'?key(n.left)+'%'+n.right.value:null;
 const finite=n=>{
  if(n?.type==='Identifier')n=single(n.name)?.init;
  if(n?.type!=='ConditionalExpression')return null;
  const t=n.test;if(t.type!=='BinaryExpression'||!['==','===','!=','!=='].includes(t.operator))return null;
  const mod=t.left.type==='NumericLiteral'?t.right:t.left,zero=t.left.type==='NumericLiteral'?t.left:t.right;
  if(zero.value!==0||!modKey(mod))return null;
  const limit=mod.right.value;if(!Number.isInteger(limit)||limit<1||limit>32)return null;
  const same=['==','==='].includes(t.operator)?n.alternate:n.consequent,fallback=['==','==='].includes(t.operator)?n.consequent:n.alternate;
  if(modKey(same)!==modKey(mod)||fallback.type!=='NumericLiteral'||fallback.value!==limit)return null;
  return Array.from({length:limit},(_,i)=>i+1);
 };
 const textureTemplates=[];
 for(const n of nodes){
  if(n.type!=='ClassMethod'||(n.computed?n.key.value:n.key.name)!=='selectTexture'||n.params[0]?.type!=='Identifier')continue;
  const param=n.params[0].name;
  for(const x of nodes.filter(x=>x.start>=n.body.start&&x.end<=n.body.end&&x.type==='BinaryExpression')){
   const p=flatten(x);if(p.length===3&&p[0]?.type==='StringLiteral'&&p[1]?.name===param&&p[2]?.type==='StringLiteral'&&/\.(png|jpe?g|lmat)$/.test(p[2].value))textureTemplates.push([p[0].value,p[2].value]);
  }
 }
 for(const n of nodes){
  if(n.type!=='CallExpression'||property(n.callee)!=='selectTexture')continue;
  const p=flatten(n.arguments[0]);if(p.length!==2||p[0]?.type!=='StringLiteral')continue;
  const values=finite(p[1]);if(!values)continue;
  for(const [prefix,suffix]of textureTemplates)for(const value of values)themes.add(prefix+p[0].value+value+suffix);
 }
 const ui=new Set();for(const n of nodes){if(n.type!=='CallExpression'||n.arguments[0]?.type!=='StringLiteral')continue;const method=property(n.callee),owner=n.callee.object,kind=property(owner);if(owner?.object?.name!=='Laya')continue;const value=n.arguments[0].value;if(['open','load'].includes(method)&&['Scene','View'].includes(kind)&&/\.scene$/.test(value))ui.add(value.replace(/\.scene$/,'.json'));if(method==='getRes'&&kind==='loader'&&/^scene\/.*\.json$/.test(value))ui.add(value);}return {prefabs,themes:[...themes],ui:[...ui]};
}

