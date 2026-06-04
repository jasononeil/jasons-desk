import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { readEmbeddedMigrations } from "./migrations.macro.ts" with { type: "macro" };
import * as schema from "./schema.ts";

export function resolveDeskHome(): string {
  return process.env.DESK_HOME ?? join(homedir(), "desk");
}

export function dbPath(deskHome: string = resolveDeskHome()): string {
  return join(deskHome, "desk.db");
}

const cache = new Map<string, ReturnType<typeof openDb>>();

export function getDb(deskHome: string = resolveDeskHome()) {
  const path = dbPath(deskHome);
  const cached = cache.get(path);
  if (cached) return cached;
  const db = openDb(path);
  cache.set(path, db);
  return db;
}

function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const client = new Database(path);
  client.exec("PRAGMA foreign_keys = ON;");
  const db = drizzle({ client, schema });
  runMigrations(db);
  return db;
}

function runMigrations(db: ReturnType<typeof drizzle>) {
  const embedded = readEmbeddedMigrations();
  const migrations = embedded.map((m) => ({
    sql: m.sql.split("--> statement-breakpoint"),
    bps: m.breakpoints,
    folderMillis: m.when,
    hash: createHash("sha256").update(m.sql).digest("hex"),
  }));
  // @ts-expect-error dialect.migrate is not on the public types
  db.dialect.migrate(migrations, db.session);
}
