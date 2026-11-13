import fs from 'node:fs/promises';import path from 'node:path';import {completeArchiveAssets} from '../src/asset-completer.mjs';
const args=process.argv.slice(2),get=flag=>args[args.indexOf(flag)+1],root=path.resolve(get('--archive')??''),reportFile=get('--report');
if(!args.includes('--archive')||!args.includes('--report')||!reportFile)throw Error('Usage: node scripts/repair-runtime-resources.mjs --archive <archive> --report <native-run-report.json>');
const report=JSON.parse(await fs.readFile(reportFile,'utf8')),runtimeRequests=report.missingResources;if(!Array.isArray(runtimeRequests)||!runtimeRequests.length)throw Error('No observed runtime missingResources in report; no guessed dependencies will be fetched');
const manifest=JSON.parse(await fs.readFile(path.join(root,'archive/manifest.json'),'utf8'));const result=await completeArchiveAssets(root,manifest,{runtimeRequests,maxAssets:2000,maxDurationMs:300000});
if(result.failedAssets||result.pendingAssets||result.scanFailures.length)process.exitCode=1;
