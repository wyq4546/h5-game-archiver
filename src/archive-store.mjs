import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// SQLite owns the management index/history; manifests and game assets stay portable.
export class ArchiveStore {
  constructor(filename) {
    mkdirSync(path.dirname(filename), {recursive:true});
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS archives (
        name TEXT PRIMARY KEY, source_url TEXT, started_at TEXT, finished_at TEXT,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, status TEXT NOT NULL, source_url TEXT, started_at TEXT,
        finished_at TEXT, data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS minigames (
        id TEXT PRIMARY KEY, platform TEXT, source_url TEXT, created_at TEXT,
        updated_at TEXT, data TEXT NOT NULL
      );`);
    for (const row of this.db.prepare("SELECT data FROM jobs WHERE status IN ('running','stopping')").all()) {
      this.saveJob({...JSON.parse(row.data),status:'interrupted',error:'服务已重启，原任务未继续执行',interruptedAt:new Date().toISOString()});
    }
  }
  syncArchives(records, directoryNames) {
    const names = new Set(directoryNames);
    const put = this.db.prepare(`INSERT INTO archives VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET source_url=excluded.source_url,
      started_at=excluded.started_at, finished_at=excluded.finished_at, data=excluded.data`);
    this.db.exec('BEGIN');
    try {
      for (const record of records) put.run(record.name,record.sourceUrl??null,record.startedAt??null,record.capturedAt??null,JSON.stringify(record));
      for (const row of this.db.prepare('SELECT name FROM archives').all()) {
        if (!names.has(row.name)) this.removeArchive(row.name);
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  listArchives() {
    return this.db.prepare('SELECT data FROM archives ORDER BY finished_at DESC, name').all().map(row=>JSON.parse(row.data));
  }
  removeArchive(name) { this.db.prepare('DELETE FROM archives WHERE name=?').run(name); }
  saveJob(job) {
    this.db.prepare(`INSERT INTO jobs VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status, source_url=excluded.source_url,
      started_at=excluded.started_at, finished_at=excluded.finished_at, data=excluded.data`)
      .run(job.id,job.status,job.url??null,job.startedAt??null,job.finishedAt??null,JSON.stringify(job));
  }
  loadJobs() { return this.db.prepare('SELECT data FROM jobs ORDER BY started_at DESC').all().map(row=>JSON.parse(row.data)); }
  // Mini-game sources are registered, not downloaded: they keep their own table so
  // a record survives even when no runnable build has been imported yet.
  listMinigames() { return this.db.prepare('SELECT data FROM minigames ORDER BY created_at DESC').all().map(row=>JSON.parse(row.data)); }
  saveMinigame(record) {
    this.db.prepare(`INSERT INTO minigames VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET platform=excluded.platform, source_url=excluded.source_url,
      created_at=excluded.created_at, updated_at=excluded.updated_at, data=excluded.data`)
      .run(record.id,record.platform??null,record.sourceUrl??null,record.createdAt??null,record.updatedAt??null,JSON.stringify(record));
  }
  removeMinigame(id) { this.db.prepare('DELETE FROM minigames WHERE id=?').run(id); }
  close() { this.db?.close(); this.db=null; }
}
