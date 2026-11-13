import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {resourcePath} from '../src/utils.mjs';

test('captured URL components are accessible through ordinary Windows paths', async t => {
  const parent=path.resolve('.tmp');
  await mkdir(parent,{recursive:true});
  const root=await mkdtemp(path.join(parent,'resource-path-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for(const url of ['https://example.com/adsservice./ad.js','https://example.com/file.','https://example.com/CON/config.json']){
    const file=resourcePath(root,url,'application/javascript','','game');
    const parts=path.relative(root,file).split(path.sep);
    assert.ok(parts.every(p=>!/[. ]$/.test(p)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)),file);
    await mkdir(path.dirname(file),{recursive:true});
    await writeFile(file,'captured bytes');
    assert.equal(await readFile(file,'utf8'),'captured bytes');
  }
});

test('long captured URLs leave copyable paths and retain binary suffixes', () => {
  const root=path.resolve('download/Plants-Vs-Zombies-Fusion-Original-20261005-001132');
  const base='https://app-465975.games.s3.yandex.net/'+Array(6).fill('directory-with-a-long-name').join('/');
  for(const suffix of ['.wasm.br','.bundle','.js']){
    const file=resourcePath(root,base+'/very-long-asset-name'+suffix,'','','game');
    assert.ok(file.length<=240,file);
    assert.ok(file.endsWith(suffix),file);
    assert.equal(file,resourcePath(root,base+'/very-long-asset-name'+suffix,'','','game'));
  }
});

test('Windows path normalization keeps distinct resource identities separate', () => {
  const root=path.resolve('.tmp');
  const urls=['https://example.com/folder./asset.js','https://example.com/folder/asset.js','https://example.com/folder../asset.js'];
  assert.equal(new Set(urls.map(url=>resourcePath(root,url,'','','game'))).size,3);
  const longBase='https://example.com/'+Array(8).fill('directory-with-a-long-name').join('/');
  assert.notEqual(resourcePath(root,longBase+'/a.js?version=1','','','game'),resourcePath(root,longBase+'/a.js?version=2','','','game'));
  assert.notEqual(resourcePath(root,longBase+'/a.js','','POST-111','game'),resourcePath(root,longBase+'/a.js','','POST-222','game'));
});
