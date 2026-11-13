import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {normalizeLevelSummary,numberedLevelTable,jsonLevelEvidence,analyzeLevelSummary,readLevelSummary} from '../src/level-summary.mjs';

test('finite and infinite require explicit analysis evidence; recording targets never qualify',()=>{
  assert.equal(normalizeLevelSummary({total:100,targetLevels:100}),null);
  assert.equal(normalizeLevelSummary({kind:'infinite',evidence:[]}),null);
  const v=normalizeLevelSummary({kind:'infinite',evidence:[{file:'analysis/gameplay/loop.js',detail:'关卡索引取模后持续递增'}]});
  assert.equal(v.kind,'infinite');assert.equal(v.total,null);
  assert.equal(normalizeLevelSummary({kind:'finite',total:-1,evidence:v.evidence}),null);
});
test('complete tables require contiguous unique IDs; packed Cocos main mode is supported',()=>{
  assert.equal(numberedLevelTable([{level:1},{level:2}]),2);
  assert.equal(numberedLevelTable([{id:1},{id:3}]),null);
  assert.equal(numberedLevelTable([{id:1},{id:1}]),null);
  assert.equal(jsonLevelEvidence([0,'NormalModeLevel','[{"id":1},{"id":2}]'],'game/config.json')[0].total,2);
  assert.equal(jsonLevelEvidence({targetLevels:100,unlockedLevel:7},'game/save.json').length,0);
});
test('analysis pipeline finds native table, rejects conflicting totals, preserves unparsed state',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'level-summary-'));
  try{
    await mkdir(path.join(root,'analysis/gameplay'),{recursive:true});
    await writeFile(path.join(root,'analysis/gameplay/native-levels.json'),JSON.stringify([{level:1},{level:2}]));
    assert.equal((await analyzeLevelSummary(root)).total,2);
    assert.equal((await readLevelSummary(root,null)).kind,'unparsed');
    assert.equal((await readLevelSummary(root,{})).kind,'unknown');
    await writeFile(path.join(root,'other.json'),JSON.stringify({levels:[{id:1}]}));
    assert.equal((await analyzeLevelSummary(root,[{file:'other.json',scope:'game-core',extension:'.json'}])).kind,'unknown');
    const summary={kind:'infinite',evidence:[{file:'native.js',detail:'verified repeat loop'}]};
    await writeFile(path.join(root,'analysis/level-summary.json'),JSON.stringify(summary));
    assert.equal((await readLevelSummary(root,{})).kind,'infinite');
  }finally{await rm(root,{recursive:true,force:true});}
});
