// Evaluated by Bun's transpiler at build/transform time via
// `import ... with { type: "macro" }`. The return value is serialized
// and inlined into the bundle, so the compiled binary doesn't need to
// read the `migrations/` folder at runtime.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type EmbeddedMigration = {
  tag: string;
  when: number;
  breakpoints: boolean;
  sql: string;
};

export function readEmbeddedMigrations(): EmbeddedMigration[] {
  const migrationsDir = join(import.meta.dir, "..", "migrations");
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, "meta", "_journal.json"), "utf8"),
  ) as {
    entries: Array<{
      idx: number;
      tag: string;
      when: number;
      breakpoints: boolean;
    }>;
  };
  return journal.entries.map((entry) => ({
    tag: entry.tag,
    when: entry.when,
    breakpoints: entry.breakpoints,
    sql: readFileSync(join(migrationsDir, `${entry.tag}.sql`), "utf8"),
  }));
}
