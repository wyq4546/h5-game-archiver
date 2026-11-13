import {parse} from '@babel/parser';
import { createDecipheriv } from 'node:crypto';
import vm from 'node:vm';
import { inflateRawSync } from 'node:zlib';

// Read package item records, not arbitrary strings in component data.
export function fairyguiAssets(buffer) {
  if (buffer.subarray(0, 4).toString() !== 'FGUI') return [];
  let data = buffer, pos = 4;
  const u8 = () => data.readUInt8(pos++);
  const u16 = () => { const n = data.readUInt16BE(pos); pos += 2; return n; };
  const i32 = () => { const n = data.readInt32BE(pos); pos += 4; return n; };
  const utf = () => { const n = u16(); if (pos+n > data.length) throw new Error('Truncated FairyGUI string'); const s = data.toString('utf8',pos,pos+n); pos += n; return s; };
  i32(); const compressed = u8(); utf(); utf(); pos += 20;
  if (compressed) { data = inflateRawSync(data.subarray(pos), {maxOutputLength:32*1024*1024}); pos = 0; }
  const index = pos;
  function seek(block) {
    pos = index; const count = u8(), short = u8();
    if (block >= count) return false;
    pos += block * (short ? 2 : 4);
    const offset = short ? u16() : i32();
    if (!offset) return false;
    pos = index + offset;
    if (pos < index || pos >= data.length) throw new Error('Invalid FairyGUI block');
    return true;
  }
  if (!seek(4)) throw new Error('Missing FairyGUI string table');
  const strings = [], count = i32();
  if (count < 0 || count > 100000) throw new Error('Invalid FairyGUI string count');
  for (let i=0;i<count;i++) strings.push(utf());
  const readS = () => { const i=u16(); if(i===65534)return null; if(i===65533)return ''; if(i>=strings.length)throw new Error('Invalid FairyGUI string index'); return strings[i]; };
  const refs = [];
  if (seek(0)) { const count=u16(); for(let i=0;i<count;i++){readS();const name=readS();if(name)refs.push({file:name+'.bin',prefix:false});} }
  if (seek(1)) {
    const count = u16();
    for (let i=0;i<count;i++) {
      const length=i32(), end=pos+length;
      if(length<9||end>data.length)throw new Error('Invalid FairyGUI item length');
      const type=u8();readS();readS();readS();const file=readS();
      if(file&&[2,4,7,9,10].includes(type))refs.push({file,prefix:[2,4,7].includes(type)});
      pos=end;
    }
  }
  return refs;
}

export function layaZipEntries(buffer) {
  if (buffer.length < 10) return [];
  const count = buffer.readUInt32LE(0);
  if (count <= 0 || count > 50000) return [];
  let off = 4;
  const names = [];
  for (let i = 0; i < count; i++) {
    if (off + 2 > buffer.length) return [];
    const nlen = buffer.readUInt16LE(off); off += 2;
    if (nlen <= 0 || nlen > 512 || off + nlen + 4 > buffer.length) return [];
    names.push(buffer.toString('utf8', off, off + nlen).replaceAll('\\', '/'));
    off += nlen;
    const clen = buffer.readUInt32LE(off);
    if (clen < 0 || off + 4 + clen > buffer.length) return [];
    off += 4 + clen;
  }
  return off === buffer.length ? names : [];
}

function legacyYygHeader(buffer, offset) {
  if (buffer.length < offset + 2) return null;
  const length = buffer.readUInt16LE(offset);
  if (length < 1 || length > 16 || offset + 2 + length + 4 > buffer.length) return null;
  const version = buffer.toString('utf8', offset + 2, offset + 2 + length);
  if (!['3.0.0', '2.0.2'].includes(version)) return null;
  return { offset: offset + 2 + length,
    key: version === '2.0.2' ? '53D8DBC5DIK3436A' : 'B3A8PBC5DIK9436A',
    iv: version === '2.0.2' ? 'KI5JL2SKE9883365' : 'IO1JL2SVH98833U5' };
}

function decryptYygText(buffer, offset, key, iv, kind) {
  if (offset + 4 > buffer.length) throw new Error(`Truncated YYG ${kind} package`);
  const len = buffer.readInt32LE(offset);
  if (len <= 0 || offset + 4 + len !== buffer.length) throw new Error(`Truncated YYG ${kind} package`);
  const decipher = createDecipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(iv));
  return decipher.update(buffer.toString('utf8', offset + 4), 'base64', 'utf8') + decipher.final('utf8');
}

function decryptYygJson(buffer, offset, key, iv) {
  return JSON.parse(decryptYygText(buffer, offset, key, iv, 'JSON'));
}

export function yygLegacyBundleManifest(buffer) {
  if (buffer.length < 15 || buffer.readUInt32LE(0) !== 3) return null;
  const header = legacyYygHeader(buffer, 4);
  if (!header) return null;
  const data = decryptYygJson(buffer, header.offset, header.key, header.iv);
  if (!data.manifest || typeof data.manifest !== 'object' || Array.isArray(data.manifest) || data.EXT !== '.bin') throw new Error('Invalid YYG bundle manifest');
  const packages = [...new Set([1000,1001,1003,1004].flatMap(type => data[type] || []).concat(Object.values(data.manifest)))];
  if (packages.some(name => typeof name !== 'string' || !/^[A-Za-z0-9_-]+$/.test(name))) throw new Error('Invalid YYG package name');
  return { virtualPaths: Object.keys(data.manifest), resources: packages.map(name => `raw-assets/${name}${data.EXT}`) };
}

export function yygBinJsonEntries(buffer) {
  if (buffer.length >= 6 && buffer.readUInt16LE(0) === 1004) {
    try { return decryptYygJson(buffer, 2, 'B3A8PBC5DIK9436A', 'IO1JL2SVH98833U5'); }
    catch {
      // Some releases retain the 1004 envelope with the newer JSON key.
      // Both paths validate packet length, padding and JSON before accepting it.
      return decryptYygJson(buffer, 2, '53D8DBC5DIK3436A', 'KI5JL2SKE9883365');
    }
  }
  if (buffer.length < 10 || buffer.readUInt16LE(0) !== 4 || buffer.toString('utf8', 2, 6) !== 'json') return null;
  try {
    return decryptYygJson(buffer, 6, '53D8DBC5DIK3436A', 'KI5JL2SKE9883365');
  } catch { return null; }
}

export function yygBinScript(buffer) {
  if (buffer.length < 4 || buffer.readUInt16LE(0) !== 1001) return null;
  const publisherLength = buffer.readUInt16LE(2);
  if (publisherLength !== 8 || buffer.toString('utf8', 4, 12) !== 'YYGGames') return null;
  const header = legacyYygHeader(buffer, 12);
  if (!header) return null;
  // SDK parseScript consumes two int32, two int16, and one uint8 before
  // the ciphertext length. Inspect the plaintext; never execute game code.
  return decryptYygText(buffer, header.offset + 13, header.key, header.iv, 'script');
}

export function decodeLegacyBase64StringTable(text) {
  if(!/\b(?:const|let|var)\s+_0x[\da-f]+\s*=\s*\[/i.test(text)||!text.includes('atob'))return text;
  let ast;try{ast=parse(text,{sourceType:'unambiguous',errorRecovery:true});}catch{return text;}
  const statements=ast.program.body;
  const tables=new Map(),decoders=new Map();
  for(const statement of statements)if(statement.type==='VariableDeclaration')for(const d of statement.declarations){
    if(d.id.type==='Identifier'&&d.init?.type==='ArrayExpression'&&d.init.elements.length&&d.init.elements.every(e=>e?.type==='StringLiteral'&&/^[A-Za-z0-9+/]*={0,2}$/.test(e.value)))tables.set(d.id.name,d.init.elements.map(e=>e.value));
    if(d.id.type!=='Identifier'||!['FunctionExpression','ArrowFunctionExpression'].includes(d.init?.type))continue;
    const f=d.init,p=f.params[0];if(p?.type!=='Identifier'||f.body.type!=='BlockStatement')continue;
    const a=f.body.body[0]?.expression,b=f.body.body[1]?.declarations?.[0],ret=f.body.body.at(-1);
    if(a?.type!=='AssignmentExpression'||a.left.name!==p.name||a.right.type!=='BinaryExpression'||a.right.operator!=='-'||a.right.left.name!==p.name||a.right.right.value!==0)continue;
    if(b?.init?.type!=='MemberExpression'||b.init.object.type!=='Identifier'||b.init.property.name!==p.name||ret?.argument?.name!==b.id.name)continue;
    const code=text.slice(f.start,f.end);
    if(!/\batob\s*\(/.test(code)||!code.includes('decodeURIComponent')||code.includes('^'))continue;
    if(tables.has(b.init.object.name))decoders.set(d.id.name,{table:b.init.object.name,values:tables.get(b.init.object.name)});
  }
  if(!decoders.size)return text;
  const uses=new Map(),calls=[],pending=[ast.program];
  while(pending.length){const node=pending.pop();if(!node||typeof node!=='object')continue;
    if(node.type==='Identifier'&&tables.has(node.name))uses.set(node.name,(uses.get(node.name)||0)+1);
    if(node.type==='CallExpression'&&node.callee.type==='Identifier'&&decoders.has(node.callee.name)&&node.arguments.length===1){
      const a=node.arguments[0],n=['StringLiteral','NumericLiteral'].includes(a.type)?Number(a.value):NaN,d=decoders.get(node.callee.name);
      if(Number.isSafeInteger(n)&&n>=0&&n<d.values.length){try{const value=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(d.values[n],'base64'));calls.push({start:node.start,end:node.end,value,table:d.table});}catch{}}
    }
    for(const [key,value]of Object.entries(node))if(!['loc','start','end','extra','errors','comments','tokens'].includes(key)){if(Array.isArray(value))pending.push(...value);else if(value&&typeof value==='object')pending.push(value);}
  }
  // Any extra array reference might rotate or mutate the table: leave it untouched.
  for(const c of calls.filter(c=>uses.get(c.table)===2).sort((a,b)=>b.start-a.start))text=text.slice(0,c.start)+JSON.stringify(c.value)+text.slice(c.end);
  return text;
}

export function deobfuscateJsStrings(text) {
  text=decodeLegacyBase64StringTable(text);
  let out = text;
  const fnMatch = out.match(/^function (_0x[0-9a-fA-F]+)\(/);
  const shufMatch = out.match(/\(_0x[0-9a-fA-F]+,0x[0-9a-fA-F]+\)/);
  if (fnMatch && shufMatch && shufMatch.index < 500000) {
    try {
      const end = shufMatch.index + shufMatch[0].length;
      const ctx = vm.createContext({});
      vm.runInContext(out.slice(0, end) + ');', ctx, { timeout: 1500 });
      const decode = ctx[fnMatch[1]];
      if (typeof decode === 'function') {
        const unhex = (_, h) => {
          const code = parseInt(h, 16);
          if (code === 0x22 || code === 0x27 || code === 0x5c) return '\\' + String.fromCharCode(code);
          if (code === 0x0a) return '\\n';
          if (code === 0x0d) return '\\r';
          return String.fromCharCode(code);
        };
        out = out.slice(end + 1)
          .replace(/\\x([0-9a-fA-F]{2})/g, unhex)
          .replace(/'((?:[^'\\]|\\.)*)'/g, (_, s) => '"' + s.replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"') + '"')
          .replace(/\b_0x[0-9a-fA-F]+\((0x[0-9a-fA-F]+)\)/g, (m, hex) => {
            try { const v = decode(parseInt(hex, 16)); return typeof v === 'string' ? JSON.stringify(v) : m; } catch { return m; }
          });
      }
    } catch {}
  } else {
    out = out.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  const strRe = /"(?:[^"\\]|\\.)*"/g;
  const tokens = [];
  let m;
  while ((m = strRe.exec(out)) !== null) {
    tokens.push({ start: m.index, end: m.index + m[0].length, val: m[0] });
  }
  if (tokens.length > 1) {
    let res = '';
    let lastIdx = 0;
    let i = 0;
    while (i < tokens.length) {
      res += out.slice(lastIdx, tokens[i].start);
      let merged = tokens[i].val.slice(0, -1);
      let endIdx = tokens[i].end;
      while (i + 1 < tokens.length && /^\s*\+\s*$/.test(out.slice(endIdx, tokens[i + 1].start))) {
        i++;
        merged += tokens[i].val.slice(1, -1);
        endIdx = tokens[i].end;
      }
      res += merged + '"';
      lastIdx = endIdx;
      i++;
    }
    res += out.slice(lastIdx);
    out = res;
  }
  return out;
}

// Laya Templet 1.6/1.7: publicExtData begins with texture count and
// a UTF string of alternating atlas-image and subtexture names.
export function layaSkeletonAssets(buffer){
 let offset=0;const utf=()=>{if(offset+2>buffer.length)throw Error('Truncated Laya skeleton');const n=buffer.readUInt16LE(offset);offset+=2;if(offset+n>buffer.length)throw Error('Truncated Laya skeleton');const s=buffer.toString('utf8',offset,offset+n);offset+=n;return s;};
 if(buffer.length<2)return [];
 const magic=utf();if(!/^LAYAANIMATION:1\.[67]\.0$/.test(magic))return [];
 const kind=utf();if(!['Dragon','Spine'].includes(kind))return [];utf();
 if(offset+9>buffer.length)throw Error('Truncated Laya skeleton header');
 const publicOffset=buffer.readUInt32LE(offset+5);if(!publicOffset)return [];
 if(publicOffset<offset+9||publicOffset+6>buffer.length)throw Error('Invalid Laya skeleton public offset');
 offset=publicOffset;const count=buffer.readInt32LE(offset);offset+=4;if(count<0||count>10000)throw Error('Invalid Laya skeleton texture count');
 const names=utf().split('\n');if(names.length<count*2||offset+count*32>buffer.length)throw Error('Truncated Laya skeleton texture table');
 const assets=[];for(let i=0;i<count;i++){const name=names[i*2];if(!name||! /\.(?:png|jpe?g|webp)(?:[?#]|$)/i.test(name))throw Error('Invalid Laya skeleton texture reference');assets.push(name);}
 return [...new Set(assets)];
}
