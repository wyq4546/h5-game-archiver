import vm from 'node:vm';
import { webcrack } from 'webcrack';

// Reading copies are generated from the original plaintext, never by editing
// damaged regex output. Only the obfuscator's decoder runs in webcrack's sandbox.
export async function decodeReadableJs(text) {
  new vm.Script(text);
  const result = await webcrack(text, { unpack: false, jsx: false, mangle: false });
  new vm.Script(result.code);
  return result.code + '\n';
}
