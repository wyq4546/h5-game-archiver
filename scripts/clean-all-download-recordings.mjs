import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../', import.meta.url));
const downloadDir = path.join(rootDir, 'download');

let deletedFiles = 0;
let deletedBytes = 0;
const affectedGames = [];

function safeRemoveDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dirPath, ent.name);
      if (ent.isDirectory()) {
        safeRemoveDir(full);
        try { fs.rmdirSync(full); } catch {}
      } else {
        try {
          const st = fs.statSync(full);
          deletedBytes += st.size;
          deletedFiles++;
          fs.unlinkSync(full);
        } catch {}
      }
    }
  } catch (err) {
    console.warn(`Error scanning ${dirPath}:`, err.message);
  }
}

const games = fs.readdirSync(downloadDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

console.log(`开始清理 download/ 下所有游戏的已录制视频与录制缓存 (共 ${games.length} 个目录)...`);

for (const gameName of games) {
  const gameDir = path.join(downloadDir, gameName);
  const targets = [
    path.join(gameDir, 'scripts', 'video'),
    path.join(gameDir, 'video'),
    path.join(gameDir, 'scripts', 'recording-data'),
    path.join(gameDir, 'recording-data')
  ];

  let gameCleared = false;
  for (const t of targets) {
    if (fs.existsSync(t)) {
      const beforeCount = deletedFiles;
      safeRemoveDir(t);
      if (deletedFiles > beforeCount) {
        gameCleared = true;
      }
    }
  }

  if (gameCleared) {
    affectedGames.push(gameName);
  }
}

console.log(`\n============================================================`);
console.log(`清理完成！`);
console.log(`涉及游戏数量: ${affectedGames.length}`);
console.log(`删除文件总数: ${deletedFiles} 个`);
console.log(`释放磁盘空间: ${(deletedBytes / 1024 / 1024).toFixed(2)} MB (${(deletedBytes / 1024 / 1024 / 1024).toFixed(2)} GB)`);
console.log(`已清理的游戏列表:`);
for (const g of affectedGames) {
  console.log(`  - ${g}`);
}
console.log(`============================================================\n`);
