import test from 'node:test';import assert from 'node:assert/strict';
import {configuredAssetTemplates,configuredAssetDependencies} from '../src/configured-scenes.mjs';
test('native config basename helpers resolve only declared fields, without guessed levels',()=>{
 const source=`class Paths {static scene(n){return "res/export/Conventional/"+n+".ls";} static model(n){return "res/export/Conventional/"+n+".lh";} static unsafe(n){return external+n+".ls";}} Paths.scene(config.Level.path);Paths.model(effect.model_path);Paths.unsafe(config.name);`;
 const templates=configuredAssetTemplates(source);
 assert.deepEqual(configuredAssetDependencies({1:{path:'level_TX_02'},2:{path:'level_TX_10'},3:{model_path:'effect_hit'},4:{path:'../bad',name:'ignored'}},templates).sort(),['res/export/Conventional/effect_hit.lh','res/export/Conventional/level_TX_02.ls','res/export/Conventional/level_TX_10.ls'].sort());
 assert.equal(templates.length,2);
});

test('direct native config member concatenation resolves declared scene names',()=>{const t=configuredAssetTemplates('const scene="res/Scene/Conventional/"+Config.levels[index].name+".ls";');assert.deepEqual(configuredAssetDependencies({1:{name:'Level_2'},2:{name:'Level_10'}},t),['res/Scene/Conventional/Level_2.ls','res/Scene/Conventional/Level_10.ls']);});
