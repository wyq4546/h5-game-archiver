// Cocos Creator 2.4 bundle manifests and compressed import packs.
// Texture serialization format 0 is PNG; other formats require their own
// declared decoder and are deliberately not guessed here.
export function decodeCocosUuid(value) {
  if (typeof value !== 'string') return null;
  if (/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)) return value;
  if (!/^[a-f\d]{2}[A-Za-z\d+/]{20}$/i.test(value)) return null;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let hex = value.slice(0, 2);
  for (let i = 2; i < 22; i += 2) {
    const a = alphabet.indexOf(value[i]), b = alphabet.indexOf(value[i + 1]);
    hex += (a >> 2).toString(16) + (((a & 3) << 2) | (b >> 4)).toString(16) + (b & 15).toString(16);
  }
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function cocosBundleImports(config, configUrl) {
  if (!Array.isArray(config?.uuids) || !Array.isArray(config?.versions?.import) ||
      !config.packs || typeof config.packs !== 'object') return [];
  const imports = [];
  const packed = new Set(Object.values(config.packs).flat().map(String));
  for (let i = 0; i + 1 < config.versions.import.length; i += 2) {
    const id = config.versions.import[i], version = config.versions.import[i + 1];
    if (typeof id === 'number' && packed.has(String(id))) continue;
    const uuid = typeof id === 'number' ? decodeCocosUuid(config.uuids[id]) : id;
    if (typeof uuid !== 'string' || !/^[a-f\d-]+$/i.test(uuid) || !/^[a-z\d]+$/i.test(version)) continue;
    const base = new URL((config.importBase || 'import').replace(/\/$/, '') + '/', configUrl);
    const extension = Object.entries(config.extensionMap || {}).find(([, ids]) => ids.includes(id))?.[0] || '.json';
    imports.push({id: String(id), url: new URL(`${uuid.slice(0,2)}/${uuid}.${version}${extension}`, base).href});
  }
  return imports;
}

export function cocosPackedNativeAssets(config, packId, pack, configUrl) {
  const ids = config?.packs?.[packId];
  if (!Array.isArray(ids) || pack?.[0] !== 1 || !Array.isArray(pack[3]) ||
      !Array.isArray(pack[5]) || ids.length !== pack[5].length || !Array.isArray(config.versions?.native)) return [];
  const versions = new Map();
  for (let i = 0; i + 1 < config.versions.native.length; i += 2) versions.set(String(config.versions.native[i]), config.versions.native[i + 1]);
  const urls = [];
  for (let index = 0; index < ids.length; index++) {
    const id = ids[index], version = versions.get(String(id));
    const uuid = decodeCocosUuid(typeof id === 'number' ? config.uuids[id] : id);
    if (!uuid || typeof version !== 'string' || !/^[a-z\d]+$/i.test(version)) continue;
    const asset = pack[5][index], extensions = new Set();
    const visit = value => {
      if (typeof value === 'string' && /^\.(?:png|jpe?g|webp|wav|mp3|ogg|m4a|ttf|woff2?|bin|plist|fnt|json)$/i.test(value)) extensions.add(value);
      else if (Array.isArray(value)) for (const child of value) visit(child);
    };
    visit(asset);
    if (pack[3][asset?.[1]?.[0]] === 'cc.Texture2D' && typeof asset?.[0]?.[0] === 'string' && asset[0][0].startsWith('0,')) extensions.add('.png');
    if (extensions.size !== 1) continue;
    const base = new URL((config.nativeBase || 'native').replace(/\/$/, '') + '/', configUrl);
    urls.push(new URL(`${uuid.slice(0,2)}/${uuid}.${version}${[...extensions][0]}`, base).href);
  }
  return urls;
}

// Creator 3 standalone imports carry _native extensions outside shared packs.
export function cocosStandaloneNativeAssets(config, id, asset, configUrl) {
  if(config?.packs?.[id]||!Array.isArray(config?.uuids)||asset?.[0]!==1||!Array.isArray(asset[5]))return [];
  const uuid=decodeCocosUuid(config.uuids[Number(id)]);
  if(!uuid)return [];
  const versions=config.versions?.native||[];
  let version;
  for(let i=0;i+1<versions.length;i+=2)if(String(versions[i])===String(id))version=versions[i+1];
  if(typeof version!=='string'||!/^[a-z\d]+$/i.test(version))return [];
  const extensions=new Set();
  const visit=v=>{if(typeof v==='string'&&/^\.(?:png|jpe?g|webp|wav|mp3|ogg|m4a|ttf|woff2?|bin|plist|fnt|json)$/i.test(v))extensions.add(v);else if(Array.isArray(v))v.forEach(visit);};
  visit(asset[5]);
  if(extensions.size!==1)return [];
  const base=new URL((config.nativeBase||'native').replace(/\/$/,'')+'/',configUrl);
  return [new URL(uuid.slice(0,2)+'/'+uuid+'.'+version+[...extensions][0],base).href];
}

