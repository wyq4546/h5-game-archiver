import { open } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

// Keep one handle for the clip instead of reopening its path for every chunk.
// Positional writes also make a retry safe if a failed write changed the file.
export async function createVideoChunkWriter(file, { openFile = open, wait = sleep } = {}) {
  async function retry(action) {
    for (let attempt = 0; ; attempt++) {
      try { return await action(); }
      catch (error) {
        if (!['EBUSY', 'EPERM', 'EACCES'].includes(error.code) || attempt === 8) throw error;
        await wait(Math.min(400, 50 * (attempt + 1)));
      }
    }
  }
  const handle = await retry(() => openFile(file, 'wx'));
  let position = 0, closed = false;
  return {
    async write(buffer) {
      if (closed) throw new Error('Video capture file is closed');
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesWritten } = await retry(() => handle.write(buffer, offset, buffer.length - offset, position));
        if (!bytesWritten) throw new Error(`Video capture write made no progress: ${file}`);
        offset += bytesWritten;
        position += bytesWritten;
      }
    },
    async close() {
      if (closed) return;
      closed = true;
      await handle.close();
    },
  };
}
