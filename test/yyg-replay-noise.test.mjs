import test from 'node:test';
import assert from 'node:assert/strict';
import {isNoiseUrl} from '../src/noise-url.mjs';
import {allowPreviewRequest} from '../src/local-preview.mjs';
test('archived YYG bootstrap and Laya dependencies survive the replay filter',()=>{
 const host='https://h5gamessdk.yyggames.com',origin='http://127.0.0.1:41740',token=Buffer.from(host).toString('base64url');
 for(const resource of ['/sdk/YYGGames.js?20250212215419','/sdk/h5splash.js','/sdk/css/GUI/index.css','/sdk/YYGGames_modules/module_frogames/LayaEngineGame/version.json','/sdk/YYGGames_modules/module_frogames/LayaEngineGame/module_forgames_LayaEngineGame.js','/sdk/adConfig/ad_config.json?123456','/sdk/res/yad.png']){
  assert.equal(isNoiseUrl(host+resource),false,resource);assert.equal(allowPreviewRequest(origin+'/__origin/'+token+resource,origin),true,resource);
  assert.equal(allowPreviewRequest(host+resource,origin),false,'replay still forbids external network access');
 }
});
test('YYG telemetry, unrelated SDK names and advertising hosts remain blocked',()=>{
 for(const url of ['https://h5gamessdk.yyggames.com/api/track','https://www.yyggames.com/ads/click','https://h5gamessdk.yyggames.com/sdk/third-party-ad.js','https://googleads.g.doubleclick.net/pagead/ads','https://www.google.com/g/collect?v=2&tid=G-WD48DJS7EW'])assert.equal(isNoiseUrl(url),true,url);
 assert.equal(isNoiseUrl('https://h5gamessdk.yyggames.com.evil.example/sdk/YYGGames.js'),false);assert.equal(allowPreviewRequest('https://h5gamessdk.yyggames.com.evil.example/sdk/YYGGames.js','http://127.0.0.1:41740'),false);
});
