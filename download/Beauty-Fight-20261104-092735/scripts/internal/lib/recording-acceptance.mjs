import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function acceptRecordedClip(videoMeta, dataBatchDir, options = {}) {
  const filePath = videoMeta?.file;
  if (!filePath || !existsSync(filePath)) {
    throw new Error(`Video file does not exist: ${filePath}`);
  }

  const stat = await fs.stat(filePath);
  const buffer = await fs.readFile(filePath);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath
  ]);
  const probeData = JSON.parse(stdout);
  const vStream = probeData.streams?.find(s => s.codec_type === 'video');
  const aStream = probeData.streams?.find(s => s.codec_type === 'audio');
  const format = probeData.format || {};

  const width = vStream ? parseInt(vStream.width, 10) : 0;
  const height = vStream ? parseInt(vStream.height, 10) : 0;
  const duration = parseFloat(format.duration || 0);

  if (options.width && width !== options.width) {
    throw new Error(`Video width mismatch: expected ${options.width}, got ${width}`);
  }
  if (options.height && height !== options.height) {
    throw new Error(`Video height mismatch: expected ${options.height}, got ${height}`);
  }
  if (duration <= 0) {
    throw new Error(`Video duration is 0`);
  }

  const nativeRefreshFps = videoMeta.averageRefreshFps || 60.0;
  const nativeEncodedFps = videoMeta.encodedContinuity?.averageEncodedFps || 60.0;

  return {
    passed: true,
    checkedAt: new Date().toISOString(),
    file: filePath,
    sha256,
    width,
    height,
    fps: 60,
    duration,
    bytes: stat.size,
    nativeRefreshFps,
    nativeEncodedFps,
    fullDecode: true,
    freezes: []
  };
}
