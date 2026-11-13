import test from 'node:test';
import assert from 'node:assert/strict';
import { RUNTIME_SOURCE } from '../src/bot-kit.mjs';

const attach = new Function(RUNTIME_SOURCE.replace('export function attach','function attach')+'\nreturn attach;')();
const module = { wasmTable: new WebAssembly.Table({initial:4,element:'externref'}) };

test('field lookup refuses duplicate type names and accepts the exact type identity',()=>{
 const bridge=attach(module,{methods:[],types:[{name:'Nested',id:'Assembly-CSharp.dll:1',fields:[{name:'owner',offset:16}]},{name:'Nested',id:'Assembly-CSharp.dll:2',fields:[{name:'owner',offset:20}]}]});
 assert.throws(()=>bridge.field('Nested','owner'),/歧义/);
 assert.equal(bridge.field('Assembly-CSharp.dll:1','owner'),16);
 assert.equal(bridge.field('Assembly-CSharp.dll:2','owner'),20);
});

test('method lookup requires a signature or table when a name has several addresses',()=>{
 const bridge=attach(module,{types:[],methods:[{name:'Player$$Move',signature:'void Move(float)',table:1},{name:'Player$$Move',signature:'void Move(int)',table:2}]});
 assert.throws(()=>bridge.method('Player$$Move'),/歧义/);
 assert.equal(bridge.method({name:'Player$$Move',signature:'void Move(int)'}),2);
 assert.equal(bridge.method({name:'Player$$Move',table:1}),1);
});

test('Unity 6 intptr_t Injected getters use the public native sret ABI',()=>{
 const memory=new ArrayBuffer(512),table=new WebAssembly.Table({initial:3,element:'externref'}),heap=new Float32Array(memory);let publicCalls=0;
 table.set(1,()=>{throw Error('managed pointer passed to native IntPtr getter');});table.set(2,(out,object)=>{assert.equal(object,42);publicCalls++;heap.set([1.25,2.5,3.75],out/4);});
 const m={wasmTable:table,HEAPF32:heap,HEAPU8:new Uint8Array(memory),_malloc:()=>64,_free:()=>{}};
 const b=attach(m,{types:[],methods:[{name:'UnityEngine.Transform$$get_position_Injected',table:1,dynCall:'viii',signature:'void getter(intptr_t _unity_self, Vector3* ret)'},{name:'UnityEngine.Transform$$get_position',table:2,dynCall:'viii',signature:'Vector3 getter(Transform* self)'}]});
 assert.deepEqual(b.worldPosition(42),[1.25,2.5,3.75]);assert.equal(publicCalls,1);
});
