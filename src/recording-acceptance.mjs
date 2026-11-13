import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {inspectRecordingMedia,assertNativeMotionContinuity,assertMovingMediaContinuity} from './recording-media-check.mjs';
import {verifyRecorderEvidence} from './verify-recorder-evidence.mjs';
const exec=promisify(execFile);

export async function acceptRecordedClip(video,dataDirectory,{width=1080,height=1920,nativePassed=false,nativeAudioEvidence=null}={}) {
 if(!nativePassed)throw Error('缺少真实原生过关或已授权跑局目标证据');
 const minFps = Number(process.env.GAME_MIN_FPS || 59.0);
 if(video.partial||video.outcome!=='completed'||!(video.audioTracks>=1)||!Number.isFinite(video.averageRefreshFps)||video.averageRefreshFps<minFps||!Number.isFinite(video.encodedContinuity?.averageEncodedFps)||video.encodedContinuity.averageEncodedFps<minFps)throw Error('录制未完成或原始帧率不合格');
 await verifyRecorderEvidence(video,dataDirectory);assertNativeMotionContinuity(video);
 let v = null, a = null, duration = null;
 try {
  const {stdout}=await exec(process.env.GAME_FFPROBE||'ffprobe',['-v','error','-show_streams','-show_format','-of','json',video.file],{windowsHide:true,timeout:2000});
  const probe=JSON.parse(stdout);
  v=probe.streams.find(s=>s.codec_type==='video');
  a=probe.streams.find(s=>s.codec_type==='audio');
  duration=Number(probe.format.duration);
 } catch {
  const ffmpeg = process.env.GAME_FFMPEG || 'ffmpeg';
  const {stderr} = await exec(ffmpeg, ['-i', video.file], {windowsHide:true}).catch(e => e);
  const durMatch = stderr?.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  duration = durMatch ? (+durMatch[1] * 3600 + +durMatch[2] * 60 + +durMatch[3]) : 0;
  const vMatch = stderr?.match(/Stream\s+#\d+:\d+.*?: Video:\s*([a-zA-Z0-9]+).*?,\s*(\d+)x(\d+).*?,\s*([\d.]+)\s*fps/);
  v = vMatch ? { codec_name: vMatch[1], width: +vMatch[2], height: +vMatch[3], r_frame_rate: (vMatch[4] === '60' ? '60/1' : vMatch[4]) } : null;
  const aMatch = stderr?.match(/Stream\s+#\d+:\d+.*?: Audio:\s*([a-zA-Z0-9]+)/);
  a = aMatch ? { codec_name: aMatch[1] } : null;
 }
 if(v?.width!==width||v?.height!==height||v?.codec_name!=='h264'||v?.r_frame_rate!=='60/1'||a?.codec_name!=='aac'||!(duration>0.5))throw Error('成片格式不合格');
 let allowSilentNativeAudio=false;
 if(nativeAudioEvidence){
  if(nativeAudioEvidence.kind!=='verified-native-silent'||nativeAudioEvidence.observedPlaybackEvents!==0)throw Error('原生静音证据不符');
  const base=await fs.realpath(dataDirectory),file=await fs.realpath(nativeAudioEvidence.assetEvidenceFile),rel=path.relative(base,file);
  if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('原生静音证据必须保存在本批次内');
  const bytes=await fs.readFile(file);
  if(createHash('sha256').update(bytes).digest('hex')!==nativeAudioEvidence.sha256)throw Error('原生静音证据哈希不符');
  const assets=JSON.parse(bytes);
  if(!Array.isArray(assets.audioSources)||assets.audioSources.length||!Array.isArray(assets.animationClips)||!assets.animationClips.length||assets.animationClips.some(c=>!Array.isArray(c.events)||c.events.some(e=>/footstep|onland|audio|sound|playclip/i.test(e))))throw Error('原始构建不能证实无播放配置');
  allowSilentNativeAudio=true;
 }
 const media=await inspectRecordingMedia(video.file,{allowSilentNativeAudio});assertMovingMediaContinuity(media,video.motionWindows,duration);
 return {passed:true,checkedAt:new Date().toISOString(),file:video.file,sha256:createHash('sha256').update(await fs.readFile(video.file)).digest('hex'),width,height,fps:60,duration,bytes:(await fs.stat(video.file)).size,nativeRefreshFps:video.averageRefreshFps,nativeEncodedFps:video.encodedContinuity.averageEncodedFps,...(allowSilentNativeAudio?{nativeAudioEvidence}:{}),...media};
}
