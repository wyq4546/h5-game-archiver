import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const MIME_EXTENSIONS = new Map([
  ["text/html", ".html"],
  ["text/css", ".css"],
  ["application/javascript", ".js"],
  ["text/javascript", ".js"],
  ["application/json", ".json"],
  ["application/wasm", ".wasm"],
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["audio/mpeg", ".mp3"],
  ["audio/ogg", ".ogg"],
  ["video/mp4", ".mp4"],
  ["font/woff2", ".woff2"]
]);

export async function ensureDir(directory) {
  await mkdir(directory, { recursive: true });
}

export function safeSlug(value) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "capture";
}

export function toTitleCaseSlug(value) {
  const parts = String(value || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9\s._-]/g, " ")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(word => {
      if (/^\d+d$/i.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  return parts.join("-").slice(0, 80).replace(/-+$/, "") || "Capture";
}

// 供文件夹和文件名使用的电脑本地时间。不要使用 toISOString()，
// 因为它会转换为 UTC，导致名称与 Windows 任务栏显示的时间不一致。
// 格式严格统一为 [YYYYMMDD-HHmmss]。
export function localFileTimestamp(date = new Date()) {
  const pad = (value, width = 2) => String(value).padStart(width, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// Keep disk names usable by Explorer while the manifest retains original URLs.
// A hash prevents a normalized name (folder.) from colliding with folder.
export function portableResourcePath(outputRoot, relativePath) {
  const original = relativePath.replaceAll("\\", "/");
  const segments = original.split("/").filter(Boolean).map(segment => {
    let name = segment.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "");
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
    if (name === segment) return name;
    const extension = path.posix.extname(name);
    const stem = extension ? name.slice(0, -extension.length) : name;
    return `${stem || "resource"}-${sha256(segment).slice(0, 10)}${extension}`;
  });
  const destination = path.join(outputRoot, ...segments);
  if (path.resolve(destination).length <= 240) return destination;
  const filename = segments.at(-1);
  const extension = filename.match(/(?:\.(?:framework|loader)\.js|\.(?:wasm|data|js|unityweb|bundle|pak))(?:\.(?:br|gz))?$/i)?.[0]
    || path.posix.extname(filename);
  const stem = extension ? filename.slice(0, -extension.length) : filename;
  const directory = path.join(outputRoot, segments[0], "_compact");
  const budget = Math.min(70, 240 - path.resolve(directory).length - 1 - 17 - extension.length);
  if (budget < 1) throw new Error("Archive output directory is too long for portable resource paths");
  return path.join(directory, `${stem.slice(0, budget)}-${sha256(original).slice(0, 16)}${extension}`);
}

export function resourcePath(outputRoot, resourceUrl, contentType = "", discriminator = "", resourceDirectory = "resources") {
  const parsed = new URL(resourceUrl);
  let pathname = decodeURIComponent(parsed.pathname || "/");
  if (pathname.endsWith("/")) pathname += "index.html";
  let extension = path.extname(pathname);
  if (!extension) extension = MIME_EXTENSIONS.get(contentType.split(";", 1)[0]) || ".bin";
  const basename = safeSlug(path.basename(pathname, path.extname(pathname))) + extension;
  const directories = pathname
    .split("/")
    .slice(0, -1)
    .filter(Boolean)
    .map(safeSlug);
  const querySuffix = parsed.search ? `-${sha256(parsed.search).slice(0, 10)}` : "";
  const requestSuffix = discriminator ? `-${safeSlug(discriminator).slice(0, 24)}` : "";
  const finalName = querySuffix
    ? `${path.basename(basename, extension)}${querySuffix}${requestSuffix}${extension}`
    : `${path.basename(basename, extension)}${requestSuffix}${extension}`;
  const authority = parsed.port ? `${parsed.hostname}-${parsed.port}` : parsed.hostname;
  return portableResourcePath(outputRoot, path.join(resourceDirectory, safeSlug(authority), ...directories, finalName));
}

export function requestIdentity(request) {
  const body = request.postDataBuffer?.();
  const bodyHash = body?.length ? ` ${sha256(body).slice(0, 16)}` : "";
  return `${request.method()} ${request.url()}${bodyHash}`;
}

export function parseArgs(argv) {
  const options = {
    command: "capture",
    duration: 45,
    output: path.resolve("output"),
    headless: false,
    acknowledgeRights: false,
    // 默认与游戏交互一次：等点击的游戏不产生网络流量，不交互就会在游戏真正
    // 开始之前判定「网络空闲」而停止，丢掉开始按钮之后加载的全部资源。
    interact: true,
    interactClicks: 3
  };
  if (["capture", "replay", "verify", "complete"].includes(argv[0])) options.command = argv.shift();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--url") options.url = argv[++index];
    else if (arg === "--output") options.output = path.resolve(argv[++index]);
    else if (arg === "--duration") options.duration = Number(argv[++index]);
    else if (arg === "--archive") options.archive = path.resolve(argv[++index]);
    else if (arg === "--port") options.port = Number(argv[++index]);
    else if (arg === "--headless") options.headless = true;
    else if (arg === "--acknowledge-rights") options.acknowledgeRights = true;
    else if (arg === "--no-interact") options.interact = false;
    else if (arg === "--interact-clicks") options.interactClicks = Number(argv[++index]);
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

// 游戏身份校验（Make-Fries 归档实测教训：落地页标题叫 Make Fries，构建文件却是
// Potato-Rush，归档按标题命名后用户启动才发现抓错游戏）。只有描述性构建名才能
// 与页面标题比对；内容哈希、内存配置等技术标识不能证明游戏身份。
const IDENTITY_STOPWORDS = new Set([
  "web", "games", "game", "yandex", "playhop", "html5", "online", "play", "free",
  "mobile", "desktop", "compressed", "data", "wasm", "framework", "loader",
  "unity", "webgl", "build", "cdn", "www", "com", "ru", "for", "on", "the", "and", "of", "app",
  "text", "yg", "portal", "sdk", "api", "wrapper", "client", "launcher", "main", "bundle",
  "release", "prod", "production", "dist", "assets", "gameplay", "engine", "sample", "test", "demo"
]);

export function identityTokens(text) {
  return String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 2 && !IDENTITY_STOPWORDS.has(token));
}

export function buildNameFromResourceFilename(filename) {
  let base = String(filename || "").split(/[?#]/)[0].split("/").pop() || "";
  try { base = decodeURIComponent(base); } catch {}
  for (;;) {
    const next = base.replace(/\.(data|wasm|unityweb|framework\.js|loader\.js|js|gz|br|zip)$/i, "");
    if (next === base) break;
    base = next;
  }
  return base;
}

export function compareGameIdentity(title, buildFilenames) {
  const titleTokens = identityTokens(title);
  const builds = [...new Set((buildFilenames || []).map(buildNameFromResourceFilename).filter(Boolean))];
  const comparableBuilds = builds.filter(name => {
    const descriptive = descriptiveBuildName(name);
    return identityTokens(descriptive).length > 0 &&
      !/^(?:build[_ -]*)?fullscreen(?:[_ -]*\d+)?$/i.test(descriptive);
  });
  if (!titleTokens.length || !comparableBuilds.length) {
    return { match: null, titleTokens, builds };
  }
  const matched = comparableBuilds.filter(name => {
    const tokens = identityTokens(descriptiveBuildName(name));
    return tokens.some(token => titleTokens.includes(token) ||
      titleTokens.some(titleToken => titleToken.length >= 4 &&
        (token.includes(titleToken) || titleToken.includes(token))));
  });
  return { match: matched.length > 0, matchedBuilds: matched, titleTokens, builds };
}

// Preserve a real title prefix (Potato-Rush_<hash>), while discarding Unity
// content hashes and memory variants such as max_512mb_<hash>.
export function descriptiveBuildName(filename) {
  return buildNameFromResourceFilename(filename)
    .replace(/(?:^|[\s_.-])(?:max[\s_.-]*)?\d+(?:kb|mb|gb)(?=$|[\s_.-])/gi, ' ')
    .replace(/(?:^|[\s_.-])(?:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}|[a-f\d]{16,})(?=$|[\s_.-])/gi, ' ')
    .replace(/^[\s_.-]+|[\s_.-]+$/g, '').trim();
}

// 把构建名词元还原成可读显示名："Potato-Rush_Web_YandexGames" → "Potato Rush"。
// 通用词（web/yandex/games 等）已在 identityTokens 里剔除。
export function displayNameFromTokens(tokens) {
  return (tokens || [])
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}
