import {parse} from '@babel/parser';

// Evaluate only the literal URL expression of a declared webpack chunk loader.
// Never invoke bundle code, calls, getters, or an inferred range of chunk IDs.
export function webpackChunkDependencies(text) {
 const urls=new Set();if(text.length>8*1024*1024||!/[\w$]+\.u\s*=/.test(text)||!/[\w$]+\.e\s*\(/.test(text))return urls;
 let ast;try{ast=parse(text,{sourceType:'unambiguous',errorRecovery:false});}catch{return urls;}
 const loaders=[],calls=[],hashes=new Map(),aliases=new Set(),walk=(root,visit)=>{const queue=[root];while(queue.length){const n=queue.pop();if(!n||typeof n!=='object')continue;if(typeof n.type==='string')visit(n);for(const [key,value]of Object.entries(n)){if(['loc','start','end','comments','tokens','extra'].includes(key))continue;if(Array.isArray(value))queue.push(...value);else if(value&&typeof value==='object')queue.push(value);}}};
 walk(ast,n=>{
  if(n.type==='AssignmentExpression'&&n.operator==='='&&n.left.type==='MemberExpression'&&!n.left.computed&&n.left.property.name==='u'&&n.left.object.type==='Identifier'&&['ArrowFunctionExpression','FunctionExpression'].includes(n.right.type))loaders.push({runtime:n.left.object.name,fn:n.right});
  if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&!n.callee.computed&&n.callee.property.name==='e'&&n.callee.object.type==='Identifier'&&n.arguments[0]?.type==='NumericLiteral')calls.push({runtime:n.callee.object.name,id:n.arguments[0].value});
  if(n.type==='AssignmentExpression'&&n.operator==='='&&n.left.type==='MemberExpression'&&!n.left.computed&&n.left.property.name==='h'&&n.left.object.type==='Identifier'&&['ArrowFunctionExpression','FunctionExpression'].includes(n.right.type)&&!n.right.params.length){const body=n.right.body,expression=body.type==='BlockStatement'&&body.body.length===1&&body.body[0].type==='ReturnStatement'?body.body[0].argument:body;if(expression?.type==='StringLiteral')hashes.set(n.left.object.name,expression.value);}
  if(n.type==='VariableDeclarator'&&n.init?.type==='ObjectExpression'&&n.init.properties.length&&n.init.properties.every(p=>p.type==='ObjectProperty'&&!p.computed&&Number.isSafeInteger(Number(p.key.value??p.key.name))&&['ArrowFunctionExpression','FunctionExpression'].includes(p.value.type))){for(const p of n.init.properties)if(p.value.params[2]?.type==='Identifier')aliases.add(p.value.params[2].name);}
 });
 const unknown=Symbol('unknown');
 for(const {runtime,fn}of loaders){
  if(fn.params.length!==1||fn.params[0].type!=='Identifier')continue;const parameter=fn.params[0].name;
  const expression=fn.body.type==='BlockStatement'?(fn.body.body.length===1&&fn.body.body[0].type==='ReturnStatement'?fn.body.body[0].argument:null):fn.body;if(!expression)continue;
  const ids=new Set(calls.filter(c=>c.runtime===runtime||aliases.has(c.runtime)).map(c=>c.id));
  const resolve=(n,id)=>{
   if(!n)return unknown;if(n.type==='StringLiteral'||n.type==='NumericLiteral'||n.type==='BooleanLiteral')return n.value;
   if(n.type==='Identifier')return n.name===parameter?id:unknown;
   if(n.type==='CallExpression'&&!n.arguments.length&&n.callee.type==='MemberExpression'&&!n.callee.computed&&n.callee.object.type==='Identifier'&&n.callee.object.name===runtime&&n.callee.property.name==='h')return hashes.get(runtime)??unknown;
   if(n.type==='ObjectExpression'){const value=Object.create(null);for(const p of n.properties){if(p.type!=='ObjectProperty'||p.computed)return unknown;const key=p.key.value??p.key.name,item=resolve(p.value,id);if(item===unknown)return unknown;value[key]=item;}return value;}
   if(n.type==='MemberExpression'&&n.computed){const object=resolve(n.object,id),key=resolve(n.property,id);return object===unknown||key===unknown||!['string','number'].includes(typeof key)||!object||typeof object!=='object'?unknown:object[key];}
   if(n.type==='BinaryExpression'){const a=resolve(n.left,id),b=resolve(n.right,id);if(a===unknown||b===unknown||a!==undefined&&a!==null&&!['string','number','boolean'].includes(typeof a)||b!==undefined&&b!==null&&!['string','number','boolean'].includes(typeof b))return unknown;if(n.operator==='+'&&(a===undefined||b===undefined))return unknown;switch(n.operator){case '+':return a+b;case '===':return a===b;case '==':return a==b;case '!==':return a!==b;default:return unknown;}}
   if(n.type==='LogicalExpression'&&n.operator==='||'){const a=resolve(n.left,id);return a===unknown?unknown:a||resolve(n.right,id);}
   if(n.type==='ConditionalExpression'){const condition=resolve(n.test,id);return condition===unknown?unknown:resolve(condition?n.consequent:n.alternate,id);}
   return unknown;
  };
  walk(expression,n=>{if(n.type==='ObjectProperty'&&!n.computed){const key=Number(n.key.value??n.key.name);if(Number.isSafeInteger(key)&&key>=0)ids.add(key);}});
  if(ids.size>512)continue;
  for(const id of ids){if(!Number.isSafeInteger(id)||id<0)continue;const value=resolve(expression,id);if(typeof value==='string'&&value.length<1024&&/^(?!\/\/|[a-z]+:)[\w./-]+\.(?:m?js|css)(?:\?[^\s<>`{}]*)?$/i.test(value))urls.add(value);}
 }
 return urls;
}
