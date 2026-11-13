import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {analyzeConstruct} from '../src/construct-analysis.mjs';

for(const format of ['c2','c3'])test(`${format} world rotation is radians at index 6, independently of reserved index 5`,async t=>{
 const parent=path.resolve(os.tmpdir()),root=await mkdtemp(path.join(parent,'construct-world-'));
 t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),parent);await rm(root,{recursive:true,force:true});});
 const base=path.join(root,'game/native.example');await mkdir(path.join(base,'scripts'),{recursive:true});
 const c3=format==='c3',runtime=c3?'game/native.example/scripts/c3runtime.js':'game/native.example/c2runtime.js';
 const runtimeCode=c3?'self.C3_GetObjectRefTable = () => [C3.Plugins.Sprite]; self.C3_ExpressionFuncs = [];':'cr.getObjectRefTable = () => [cr.plugins_.Sprite];';
 await writeFile(path.join(root,runtime),runtimeCode);
 const world=[10,20,0,100,10,37,1.5*Math.PI,c3?[1,1,1,.4]:.4,0,1];
 const instance=[world,0,1234,[],[],[]];
 const layer=Array(15).fill(null);Object.assign(layer,{0:'Layer',1:0,2:7,3:true,6:1,7:1,14:[instance]});
 const layout=c3?['Level',854,480,false,null,null,null,'Game',9,[layer],[]]:['Level',854,480,false,'Game',9,[layer],[]];
 const project=['Test','Level',[],[['Block',0,false,[],0,0,null,[],[],false,0,123]],[],[layout],[['Game',[]]],null,null,null,854,480];
 const data='game/native.example/data.json';await writeFile(path.join(root,data),JSON.stringify({project}));
 const result=await analyzeConstruct(root,[{relative:runtime,full:path.join(root,runtime)},{relative:data,full:path.join(root,data)}]);
 assert.equal(result.status,'decoded');
 const model=JSON.parse(await readFile(path.join(root,'analysis/construct/project.json'),'utf8'));
 const actual=model.layouts[0].layers[0].instances[0].world;
 assert.equal(actual.angle,1.5*Math.PI);
 assert.equal(actual.opacity,.4);
 assert.equal(actual.originX,0);assert.equal(actual.originY,1);
});
