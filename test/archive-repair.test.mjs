import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeLegacyBase64StringTable} from '../src/fairygui-assets.mjs';
import {declaredPrefabBaseLetters} from '../src/asset-completer.mjs';
const legacy=`const _0xabc=['aW1nL3NvdW5kL2JnbTAubXAz'];const _0xdef=function(i){i=i-0;let value=_0xabc[i];value=decodeURIComponent(atob(value));return value;};Laya.SoundManager.playMusic(_0xdef('0x0'));throw Error('publisher entry must not execute');`;
test('legacy zero-offset Base64 arrays reveal paths without executing the publisher entry',()=>{
 const result=decodeLegacyBase64StringTable(legacy);
 assert.ok(result.includes('playMusic("img/sound/bgm0.mp3")'));
 assert.ok(result.includes("throw Error('publisher entry must not execute')"));
});
test('mutated Base64 arrays and nonzero decoder offsets are left unresolved',()=>{
 const rotated=legacy+' _0xabc.reverse();';assert.equal(decodeLegacyBase64StringTable(rotated),rotated);
 const shifted=legacy.replace('i=i-0','i=i-1');assert.equal(decodeLegacyBase64StringTable(shifted),shifted);
});
test('model node aliases require literal first-letter normalization passed to selectProp',()=>{
 const source=`let raw=node['a'],model='a'===raw['substring'](1,0)?'a':'w'==raw.substring(0,1)?'w':raw; loader.selectProp(model);`;
 assert.deepEqual(declaredPrefabBaseLetters(source).sort(),['a','w']);
 assert.deepEqual(declaredPrefabBaseLetters(source.replace('selectProp(model)','selectProp(raw)')),[]);
 assert.deepEqual(declaredPrefabBaseLetters(source.replace('substring(0,1)','substring(0,2)')),[]);
});
