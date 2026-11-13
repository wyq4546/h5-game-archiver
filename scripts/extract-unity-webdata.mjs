#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractUnityWebData } from '../src/unity-analysis.mjs';

function archiveAnalysisOutput(input) {
  let current = path.dirname(path.resolve(input));
  while (path.dirname(current) !== current) {
    if (path.basename(current).toLowerCase() === 'game') {
      const archiveRoot = path.dirname(current);
      const base = path.basename(input).replace(/\.(?:data|unityweb)$/i, '') || 'unity-data';
      return path.join(archiveRoot, 'analysis', 'unity-data', base);
    }
    current = path.dirname(current);
  }
  const base = path.basename(input).replace(/\.(?:data|unityweb)$/i, '') || 'unity-data';
  return path.join(path.dirname(path.resolve(input)), 'analysis', 'unity-data', base);
}

const [input, requestedOutput] = process.argv.slice(2);
if (!input) throw new Error('Usage: node scripts/extract-unity-webdata.mjs <barrol.data> [output]');

const data = await readFile(input);
const output = path.resolve(requestedOutput || archiveAnalysisOutput(input));
const result = await extractUnityWebData(data, output, path.resolve(input));
console.log(JSON.stringify({ input: path.resolve(input), output, ...result }, null, 2));
