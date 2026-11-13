import test from 'node:test';
import assert from 'node:assert/strict';
import {wrappedAudioDependencies} from '../src/wrapped-audio-dependencies.mjs';
import {boundedLevelDependencies} from '../src/bounded-level-dependencies.mjs';
test('sound wrapper resolves only literal native calls',()=>{
 const source=`class Sound { static play(name){const asset='res/sound/'+name; loader.load(asset+'.mp3')} } Sound.play('Win'); Sound.play(dynamic); Other.unrelated('Fake');`;
 assert.deepEqual(wrappedAudioDependencies(source),['res/sound/Win.mp3']);
 assert.deepEqual(wrappedAudioDependencies('Sound.play("Win")'),[]);
});
test('bounded native map selection discovers all ten maps',()=>{
 const source=`class Data { static level(){let n=store.level;n>10&&(n=Util.RandomInt(2,11));return n;} } G.map=Data.level();loader.load('res/Level/Level'+G.map+'.ls');`;
 assert.deepEqual(boundedLevelDependencies(source),Array.from({length:10},(_,i)=>'res/Level/Level'+(i+1)+'.ls'));
 assert.deepEqual(boundedLevelDependencies(source.replace('n>10','n>1000').replace('2,11','2,1001')),[]);
 assert.deepEqual(boundedLevelDependencies(source.replace('2,11','2,99')),[]);
});
