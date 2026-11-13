import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCompleteness} from '../src/capture.mjs';

const fixture=()=>({gameUrl:'https://example.com/build/index.html',resources:['index.html','main.js','data.bin'].map(name=>({url:'https://example.com/build/'+name,saved:true,type:name.endsWith('.html')?'document':'script',bytes:500000})),runtimeInspection:{engine:'Unknown / insufficient runtime assets',coreReady:false,coreRule:'未识别引擎'}});
test('a large unknown runtime cannot be declared core-complete',()=>{
  const result=assessCompleteness(fixture());
  assert.equal(result.status,'incomplete');
  assert.ok(result.criticalFailures.some(item=>/引擎|核心/.test(item.error)));
});
test('a known complete build still fails completion when its local startup fails',()=>{
  const manifest=fixture();manifest.runtimeInspection={engine:'Three.js',coreReady:true};
  manifest.localReplay={status:'failed',error:'PokiSDK.getURLParam is not a function'};
  assert.equal(assessCompleteness(manifest).status,'incomplete');
  manifest.localReplay={status:'passed',scope:'startup-and-visible-canvas'};
  assert.equal(assessCompleteness(manifest).status,'core-complete');
});

test('recorded Unity configuration 404s remain critical until offline startup succeeds',()=>{
  const m=fixture();m.runtimeInspection={engine:'Unity WebGL',coreReady:true};
  m.resources.push({url:'https://example.com/build/StreamingAssets/aa/settings.json',method:'GET',type:'fetch',status:404,saved:true});
  assert.equal(assessCompleteness(m).status,'incomplete');
  m.localReplay={status:'passed',externalNetwork:'blocked'};
  assert.equal(assessCompleteness(m).status,'core-complete');
  assert.equal(assessCompleteness(m).nonCriticalFailures.length,1);
  m.resources.push({url:'https://example.com/build/StreamingAssets/aa/catalog.json',type:'fetch',status:404,saved:true});
  assert.equal(assessCompleteness(m).status,'incomplete');
});
