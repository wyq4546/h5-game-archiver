import test from 'node:test';
import assert from 'node:assert/strict';
import { readRuntimeAssetRegistry, collectRuntimeAssetRegistries } from '../src/runtime-assets.mjs';
import { chromium } from 'playwright';

test('native canonical preloads replace inactive templates and cached library URLs prove the published root', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.route('https://game.example/**',route=>route.fulfill({contentType:'text/html',body:`<script>
      const base='https://game.example/build/';
      window.Laya={Loader:{preLoadedMap:{
        'fileconfig.json':{'res/old.atlas':['old/',['a.png']]},
        [base+'fileconfig.json']:{'res/loading.atlas':['loading/',['a.png']]},
        [base+'json/res.json']:{base_url:'https://stale.example/',root_url:'res/',res_lib:[{id:1,sub_pack:'models',url:'a.lh'},{id:2,sub_pack:'models',url:'b.lh'}]}
      },loadedMap:{[base+'res/models/a.lh']:{},[base+'res/models/b.lh']:{}}}};
      </script>`}));
    await page.goto('https://game.example/build/index.html');
    const registry=await page.evaluate(readRuntimeAssetRegistry);
    const configs=registry.dependencyDocuments.filter(d=>d.name.endsWith('fileconfig.json'));
    assert.equal(configs.length,1);
    assert.deepEqual(Object.keys(configs[0].data),['res/loading.atlas']);
    assert.deepEqual(registry.resourceLibraryRoots,[{documentUrl:'https://game.example/build/json/res.json',declaredBase:'https://stale.example/res/',baseUrl:'https://game.example/build/res/',matchedUrls:['https://game.example/build/res/models/a.lh','https://game.example/build/res/models/b.lh']}]);
    await page.evaluate(()=>{Laya.Loader.loadedMap={};});
    assert.deepEqual((await page.evaluate(readRuntimeAssetRegistry)).resourceLibraryRoots,[]);
  } finally {await browser.close();}
});

test('Laya native filename and folder version maps are exported without a modern YYG registry', async t => {
  const previous = {Laya: globalThis.Laya, location: globalThis.location, YYGGames: globalThis.YYGGames};
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  globalThis.location = {href: 'https://publisher.example/game/index.html'};
  globalThis.YYGGames = {bundle: {}};
  globalThis.Laya = {ResourceVersion: {type: 2, FILENAME_VERSION: 2, manifest: {
    'res/scene.ls': 'res/A1B2.ls',
    'res/Glass Wine Bottle.lmat': 'res/C3D4.lmat'
  }}};
  const filenames = await readRuntimeAssetRegistry();
  assert.ok(filenames, 'the legacy SDK must still expose the engine version map');
  assert.equal(filenames.baseUrl, 'https://publisher.example/game/');
  assert.deepEqual(filenames.urlAliases, globalThis.Laya.ResourceVersion.manifest);
  assert.deepEqual(filenames.resources, []);
  globalThis.Laya.ResourceVersion.type = 1;
  globalThis.Laya.ResourceVersion.manifest = {'res/scene.ls': 'v123'};
  const folders = await readRuntimeAssetRegistry();
  assert.deepEqual(folders.urlAliases, {'res/scene.ls': 'v123/res/scene.ls'});
});

test('runtime collection ignores portal frames and retains the actual game registry', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.route('https://portal.example/**', route => route.fulfill({contentType:'text/html', body:`<script>
      window.Laya = {ResourceVersion:{manifest:new Proxy({}, {ownKeys(){throw Error('portal registry must not be read');}})}};
      </script><iframe src="https://game.example/build/index.html"></iframe>`}));
    await page.route('https://game.example/**', route => route.fulfill({contentType:'text/html', body:`<script>
      window.Laya = {ResourceVersion:{type:2,FILENAME_VERSION:2,manifest:{'scene.ls':'scene-v1.ls'}}};
      </script>`}));
    await page.goto('https://portal.example/index.html');
    const result = await collectRuntimeAssetRegistries(page, {gameUrl:'https://game.example/build/index.html#origin=https%3A%2F%2Fportal.example'});
    assert.equal(result.length, 1);
    assert.equal(result[0].baseUrl, 'https://game.example/build/');
    assert.deepEqual(result[0].urlAliases, {'scene.ls':'scene-v1.ls'});
    await page.frames().find(frame => frame.url().startsWith('https://game.example/')).evaluate(() => {
      Laya.ResourceVersion.manifest = new Proxy({}, {ownKeys(){throw Error('game registry corrupted');}});
    });
    await assert.rejects(collectRuntimeAssetRegistries(page, {gameUrl:'https://game.example/build/index.html'}), /game registry corrupted/);
  } finally { await browser.close(); }
});

test('native Laya preloaded packages expose virtual models and material dependencies without a YYG registry', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.route('https://game.example/**',route=>route.fulfill({contentType:'text/html',body:`<script>
      window.Laya={Loader:{preLoadedMap:{
        'gameScene/player.lm':new ArrayBuffer(8),
        'gameScene/player.lmat':{version:'LAYAMATERIAL:02',props:{textures:[{path:'texture.png'}]}},
        'scene/view/play.scene':{type:'View',props:{name:'play'}}
      }}};
      </script>`}));
    await page.goto('https://game.example/build/index.html');
    const registries=await collectRuntimeAssetRegistries(page,{gameUrl:page.url()});
    assert.equal(registries.length,1);
    assert.ok(registries[0].virtualPaths.includes('gameScene/player.lm'));
    assert.ok(registries[0].virtualPaths.includes('gameScene/player.lmat'));
    assert.deepEqual(registries[0].dependencyDocuments,[{name:'gameScene/player.lmat',data:{version:'LAYAMATERIAL:02',props:{textures:[{path:'texture.png'}]}}}]);
    assert.deepEqual(registries[0].embeddedScenes,{'scene/view/play.json':{type:'View',props:{name:'play'}}});
  }finally{await browser.close();}
});

test('normally loaded Laya library metadata and relative cache keys prove the published root',async t=>{
 const previous={Laya:globalThis.Laya,location:globalThis.location,YYGGames:globalThis.YYGGames};t.after(()=>{for(const[k,v]of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}});
 globalThis.location={href:'https://native.example/build/index.html'};globalThis.YYGGames=undefined;
 globalThis.Laya={Loader:{loadedMap:{'json/res.json':{root_url:'res/',base_url:'https://old.example/',res_lib:[{id:1,sub_pack:'home',url:'a.lh'},{id:2,sub_pack:'home',url:'b.lh'}]},'res/home/a.lh':{},'res/home/b.lh':{}}}};
 const registry=await readRuntimeAssetRegistry();assert.ok(registry);
 assert.equal(registry.dependencyDocuments.length,1);assert.equal(registry.resourceLibraryRoots[0].documentUrl,'https://native.example/build/json/res.json');
 assert.deepEqual(registry.resourceLibraryRoots[0].matchedUrls,['https://native.example/build/res/home/a.lh','https://native.example/build/res/home/b.lh']);
 delete Laya.Loader.loadedMap['res/home/b.lh'];assert.deepEqual((await readRuntimeAssetRegistry()).resourceLibraryRoots,[]);
});
