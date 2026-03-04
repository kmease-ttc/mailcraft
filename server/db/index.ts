import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import path from "path";
import fs from "fs";

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "mailcraft.db");

// Ensure data/ directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

/** Create tables if they don't exist (called on startup) */
export function initializeDatabase(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS fetch_runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      status          TEXT NOT NULL DEFAULT 'success',
      query_ids       TEXT NOT NULL,
      results_json    TEXT NOT NULL,
      total_rows      INTEGER NOT NULL DEFAULT 0,
      error_count     INTEGER NOT NULL DEFAULT 0,
      triggered_by    TEXT NOT NULL DEFAULT 'manual',
      schedule_id     INTEGER,
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      fetch_run_id    INTEGER NOT NULL REFERENCES fetch_runs(id),
      subject         TEXT NOT NULL,
      body_html       TEXT NOT NULL,
      report_meta     TEXT,
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id       INTEGER NOT NULL REFERENCES reports(id),
      recipient       TEXT NOT NULL,
      status          TEXT NOT NULL,
      resend_id       TEXT,
      error           TEXT,
      sent_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT NOT NULL,
      cron_expr         TEXT NOT NULL,
      recipients        TEXT NOT NULL,
      subject           TEXT,
      query_ids         TEXT,
      enabled           INTEGER NOT NULL DEFAULT 1,
      last_run_at       TEXT,
      last_run_status   TEXT,
      next_run_at       TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );
  `);
  console.log(`Database initialized at ${DB_PATH}`);
}
