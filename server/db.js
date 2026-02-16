import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DB_PATH } from "./config.js";

let dbInstance = null;

function ensureDbDir() {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
}

function runMigrations(db) {
  db.exec(`
    create table if not exists _migrations (
      id integer primary key autoincrement,
      file_name text not null unique,
      applied_at text not null default (datetime('now'))
    );
  `);

  const migrationDir = path.join(process.cwd(), "server", "migrations");
  const files = fs
    .readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const alreadyApplied = db
      .prepare("select 1 from _migrations where file_name = ? limit 1")
      .get(file);
    if (alreadyApplied) continue;

    const sql = fs.readFileSync(path.join(migrationDir, file), "utf8");
    const transaction = db.transaction(() => {
      db.exec(sql);
      db.prepare("insert into _migrations (file_name) values (?)").run(file);
    });
    transaction();
  }
}

export function getDb() {
  if (dbInstance) return dbInstance;
  ensureDbDir();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  dbInstance = db;
  return dbInstance;
}

export function resetDbForTests() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  if (fs.existsSync(DB_PATH)) {
    fs.rmSync(DB_PATH, { force: true });
  }
}
