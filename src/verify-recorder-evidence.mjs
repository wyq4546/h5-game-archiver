import {readFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// A 60 FPS MP4 header cannot prove the recorder implementation or its raw timing.
export async function verifyRecorderEvidence(video,dataDirectory) {
  const names=['game-video-recorder.mjs','recording-runtime.mjs','video-chunk-writer.mjs','recording-layout.mjs'];
  if(!/^[a-f0-9]{64}$/.test(video.recorderSourceSha256||'')||JSON.stringify(video.recorderSourceFiles)!==JSON.stringify(names))throw Error('缺少真实共享录制器源码版本');
  const expected=path.join(await realpath(dataDirectory),'source','recorder-'+video.recorderSourceSha256);
  if(await realpath(video.recorderSourceDirectory)!==await realpath(expected))throw Error('共享录制器源码快照越出本批次');
  const hash=createHash('sha256');for(const name of names)hash.update(name+'\0').update(await readFile(path.join(expected,name)));
  if(hash.digest('hex')!==video.recorderSourceSha256)throw Error('共享录制器源码快照不一致');
  const opening=video.encodedOpening;
  if(!video.captureEveryFrame||video.fps!==60||!(video.trimHeadSeconds>=1.5)||!(opening?.frames>=2)||!Number.isFinite(opening.firstFrameAtMs)||opening.firstFrameAtMs>42.0||!Number.isFinite(opening.maxGapMs)||opening.maxGapMs>42.0||opening.gaps.length)throw Error('同会话预热或原始编码开头未通过');
  if(!(video.encodedContinuity?.frames>=opening.frames)||!Number.isFinite(video.encodedContinuity.maxGapMs))throw Error('缺少全片原始编码时间戳证据');
  return {recorderSourceSha256:video.recorderSourceSha256,encodedOpening:opening,encodedContinuity:video.encodedContinuity};
}
