import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createReplayServer} from '../src/replay.mjs';
test('offline CrazyGames exposes native local-mode settings JSON without granting ad rewards',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'crazy-settings-'));await fs.mkdir(path.join(root,'archive'));
 await fs.writeFile(path.join(root,'index.html'),'<html></html>');await fs.writeFile(path.join(root,'sdk.js'),'throw Error("publisher SDK should not run");');
 const sdk='https://sdk.crazygames.com/crazygames-sdk-v3.js';await fs.writeFile(path.join(root,'archive/manifest.json'),JSON.stringify({gameUrl:'https://game.example/index.html',resources:[{url:'https://game.example/index.html',method:'GET',saved:true,status:200,path:'index.html',type:'document',contentType:'text/html'},{url:sdk,method:'GET',saved:true,status:200,path:'sdk.js',type:'script',contentType:'application/javascript'}]}));
 const replay=await createReplayServer(root);t.after(async()=>{replay.server.closeAllConnections();await new Promise(r=>replay.server.close(r));await fs.rm(root,{recursive:true,force:true});});
 const url=new URL('/__origin/'+Buffer.from('https://sdk.crazygames.com').toString('base64url')+'/crazygames-sdk-v3.js',replay.url),body=await(await fetch(url)).text();
 const window={},context=vm.createContext({window,navigator:{userAgent:'Android Mobile',language:'en-US'},location:{search:''},URLSearchParams,localStorage:{},setTimeout});vm.runInContext(body,context);
 assert.deepEqual(JSON.parse(JSON.stringify(window.CrazyGames.SDK.game.settings)),{disableChat:false,muteAudio:false});assert.equal(typeof window.CrazyGames.SDK.game.addSettingsChangeListener,'function');
 let reward=0,errors=0;const pending=window.CrazyGames.SDK.ad.requestAd('rewarded',{adFinished(){reward++;},adError(){errors++;}});assert.equal(typeof pending.catch,'function');assert.equal(await pending,false);assert.equal(errors,1);assert.equal(reward,0);
});
