// Read release declarations without executing Haxe-generated game code.
export function openflBuildDependencies(text) {
  const applications = [...text.matchAll(/\blime\.embed\s*\(\s*["']([\w-]+)["']/g)].map(match => match[1]);
  const scripts = [];
  if (applications.length && /\b__loadWithProgress\s*\(/.test(text)) {
    for (const match of text.matchAll(/["']([^"'\r\n]+\.js)["']\s*:\s*\{\s*total\s*:\s*\d+/g)) scripts.push(match[1]);
  }
  const packs = [...text.matchAll(/["']libraryArgs["']\s*:\s*\[\s*["']([^"'\r\n]+\.pak)["']\s*,\s*["'](gzip|zip|deflate|none)["']/g)]
    .map(match => ({url:match[1],compression:match[2]}));
  return {applications:[...new Set(applications)], scripts:[...new Set(scripts)], packs};
}
