import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);

// Scope scheduling changes to the renderer/GPU OS PIDs returned by this
// browser's own CDP session. Closing the browser ends their lifetime.
export async function prioritizeOwnedBrowser(browser){
 if(process.platform!=='win32')return {applied:false,reason:'Windows only'};
 const session=await browser.newBrowserCDPSession();
 try{
  const {processInfo}=await session.send('SystemInfo.getProcessInfo');
  const targets=processInfo.filter(p=>/^(renderer|gpu)$/i.test(p.type)).map(p=>({id:Number(p.id),type:p.type,cpuTimeAtSetup:Number(p.cpuTime)}));
  if(!targets.length||targets.some(p=>!Number.isSafeInteger(p.id)||p.id<1))throw Error('Owned browser process identities unavailable');
  const script=`$ErrorActionPreference='Stop'; $rows=foreach($processId in @(${targets.map(p=>p.id).join(',')})){ $owned=Get-Process -Id $processId; $before=[string]$owned.PriorityClass; $owned.PriorityClass='AboveNormal'; [pscustomobject]@{id=$processId;before=$before;after=[string]$owned.PriorityClass} }; ConvertTo-Json -Compress -InputObject @($rows)`;
  const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:10000});
  const processes=JSON.parse(stdout);if(processes.some(p=>p.after!=='AboveNormal'))throw Error('Owned browser priority did not apply');
  return {applied:true,priority:'AboveNormal',targets,processes};
 }finally{await session.detach();}
}
