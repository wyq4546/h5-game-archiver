import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIl2CppArtifacts,parseGameplayClasses} from '../src/unity-analysis.mjs';

test('an IL2CPP header-only dump is not a completed analysis',()=>{
 const result=validateIl2CppArtifacts('// Image 0: Assembly-CSharp.dll - 3667\n',null);
 assert.equal(result.status,'failed');assert.match(result.reason,/类型/);
});
test('real classes without exported method mapping remain incomplete',()=>{
 const dump='// Namespace: Game\npublic class Player // TypeDefIndex: 1\n{}';
 for(const script of [null,'not json',JSON.stringify({ScriptMethod:[]}),JSON.stringify({ScriptMethod:[{Name:'Player$$Update',Address:0}]})])assert.equal(validateIl2CppArtifacts(dump,script).status,'failed');
});
test('valid type definitions and original nonzero method mappings complete analysis',()=>{
 const result=validateIl2CppArtifacts('public class Player // TypeDefIndex: 1\n{}',JSON.stringify({ScriptMethod:[{Name:'Player$$Update',Address:18650}]}));
 assert.equal(result.status,'completed');assert.equal(result.typeDefinitions,1);assert.equal(result.mappedMethods,1);
});

test('compiler-generated and generic class names retain their complete identity',()=>{
 const dump='// Image 0: Assembly-CSharp.dll - 0\n// Namespace: Game\nprivate sealed class Movement.<>c // TypeDefIndex: 1\n{}\nprivate sealed class Movement.<ControlRotation>d__41 : IEnumerator // TypeDefIndex: 2\n{}\npublic class Pool<T, U> : Object // TypeDefIndex: 3\n{}';
 assert.deepEqual(parseGameplayClasses(dump).projectClasses.map(item=>item.name),['Movement.<>c','Movement.<ControlRotation>d__41','Pool<T, U>']);
});
