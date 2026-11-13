import test from 'node:test';import assert from 'node:assert/strict';import {layaPublishedVariants} from '../src/laya-published-variants.mjs';
test('native prefab conditional and inline bounded theme expressions are read without executing code',()=>{const source=`globalThis.mustNotExecute=true;let name=level.nodeData[i].a;name=game.level>5&&name==='coffee'?'milk':name;assets.selectProp(name);let sky=Math.ceil(game.level/5)%3;Laya.Material.load('img/sky/sky'+(sky!==0?sky:3)+'.lmat');`;const r=layaPublishedVariants(source);assert.deepEqual(r.prefabs,[{from:'coffee',to:'milk'}]);assert.deepEqual(r.themes.sort(),['img/sky/sky1.lmat','img/sky/sky2.lmat','img/sky/sky3.lmat']);assert.equal(globalThis.mustNotExecute,undefined);});
test('unbounded themes and unrelated conditional filenames are not inferred',()=>{assert.deepEqual(layaPublishedVariants(`let name='coffee';name=flag&&name==='coffee'?'milk':name;assets.selectProp(name);let sky=game.level;load('img/sky'+(sky!==0?sky:3)+'.lmat');`),{prefabs:[],themes:[],ui:[]});});

test('Laya lazy UI open and generated createView/getRes references resolve original JSON paths',()=>{const r=layaPublishedVariants(`Laya['View']['open']('scene/view/getCupView.scene');this.createView(Laya.loader.getRes('scene/view/trySkinView.json'));other.View.open('unrelated.scene');`);assert.deepEqual(r.ui.sort(),['scene/view/getCupView.json','scene/view/trySkinView.json']);});

test('bounded modulo texture names resolve through their declared helper template',()=>{
 const source=`class Assets{selectTexture(name,done){Laya.Texture2D.load('img/propmat/'+name+'.png',done);}}let sky=game.maxLevel%3==0?3:game.maxLevel%3;assets.selectTexture('sky_'+sky,done);let unbounded=game.maxLevel;assets.selectTexture('road_'+unbounded,done);throw Error('never execute');`;
 assert.deepEqual(layaPublishedVariants(source).themes.sort(),['img/propmat/sky_1.png','img/propmat/sky_2.png','img/propmat/sky_3.png']);
 assert.deepEqual(layaPublishedVariants(source.replace('3:game.maxLevel%3','3:other.maxLevel%3')).themes,[]);
});
