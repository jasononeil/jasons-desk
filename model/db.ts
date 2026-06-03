import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
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
  return drizzle({ client, schema });
}

export function migrateDb(deskHome: string = resolveDeskHome()) {
  const db = getDb(deskHome);
  migrate(db, { migrationsFolder: join(import.meta.dir, "..", "migrations") });
  return db;
}
