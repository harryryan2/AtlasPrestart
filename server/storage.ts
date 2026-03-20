import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { prestarts, type Prestart, type InsertPrestart } from "@shared/schema";
import { desc } from "drizzle-orm";
import path from "path";
import fs from "fs";

// ─── Database setup ───────────────────────────────────────────────────────────
// On Railway, use /data volume if available (persistent), else local file
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || "./data";
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "prestart.db");
console.log("📦 DB path:", dbPath);

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// ─── Run migrations (create table if not exists) ──────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS prestarts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_name TEXT NOT NULL,
    machine TEXT NOT NULL,
    hours INTEGER NOT NULL,
    service_due_hours INTEGER NOT NULL,
    service_due_date TEXT NOT NULL,
    inspection_date TEXT NOT NULL,
    corrective_items TEXT NOT NULL,
    do_not_operate_items TEXT NOT NULL,
    comments TEXT,
    has_faults INTEGER NOT NULL DEFAULT 0,
    has_critical_faults INTEGER NOT NULL DEFAULT 0,
    service_alert_sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )
`);

// ─── Storage interface ────────────────────────────────────────────────────────
export interface IStorage {
  createPrestart(data: InsertPrestart): Promise<Prestart>;
  getPrestarts(): Promise<Prestart[]>;
  getPrestart(id: number): Promise<Prestart | undefined>;
  deletePrestart(id: number): Promise<void>;
}

export class SqliteStorage implements IStorage {
  async createPrestart(data: InsertPrestart): Promise<Prestart> {
    const record = {
      ...data,
      createdAt: new Date().toISOString(),
      hasFaults: data.hasFaults ?? false,
      hasCriticalFaults: data.hasCriticalFaults ?? false,
      serviceAlertSent: data.serviceAlertSent ?? false,
      comments: data.comments ?? null,
      // Ensure JSON fields are strings
      correctiveItems: typeof data.correctiveItems === "string"
        ? data.correctiveItems
        : JSON.stringify(data.correctiveItems),
      doNotOperateItems: typeof data.doNotOperateItems === "string"
        ? data.doNotOperateItems
        : JSON.stringify(data.doNotOperateItems),
    };
    const result = db.insert(prestarts).values(record).returning().get();
    return this.parseRecord(result);
  }

  async getPrestarts(): Promise<Prestart[]> {
    const rows = db.select().from(prestarts).orderBy(desc(prestarts.id)).all();
    return rows.map(this.parseRecord);
  }

  async getPrestart(id: number): Promise<Prestart | undefined> {
    const row = db.select().from(prestarts).where(
      // @ts-ignore
      require("drizzle-orm").eq(prestarts.id, id)
    ).get();
    return row ? this.parseRecord(row) : undefined;
  }

  async deletePrestart(id: number): Promise<void> {
    const { eq } = require("drizzle-orm");
    db.delete(prestarts).where(eq(prestarts.id, id)).run();
  }

  private parseRecord(row: any): Prestart {
    return {
      ...row,
      correctiveItems: typeof row.correctiveItems === "string"
        ? JSON.parse(row.correctiveItems)
        : row.correctiveItems,
      doNotOperateItems: typeof row.doNotOperateItems === "string"
        ? JSON.parse(row.doNotOperateItems)
        : row.doNotOperateItems,
    };
  }
}

export const storage = new SqliteStorage();
