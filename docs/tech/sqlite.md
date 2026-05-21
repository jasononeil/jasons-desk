# SQLite

## Database access

We use `import { SQL } from "bun"` with a SQLite connection:

```ts
import { SQL } from "bun";

const db = new SQL(`sqlite://${deskHome}/desk.db`);
```

The database path is derived from `DESK_HOME` (defaults to `~/desk/`). This makes it easy to point tests at a temp directory.

## Migrations

Schema changes are managed with hand-rolled migrations: numbered `.sql` files in `migrations/`, applied in order at startup.

A `_migrations` table tracks which files have been applied:

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  filename TEXT PRIMARY KEY,
  appliedAt TEXT NOT NULL
);
```

### Migration files

Files are named `0001-description.sql`, `0002-description.sql`, etc. Each file contains one or more SQL statements for a single logical change.

Example: `migrations/0001-initial-schema.sql`

```sql
CREATE TABLE repos (
  orgName      TEXT NOT NULL,
  repoName     TEXT NOT NULL,
  defaultBranch TEXT NOT NULL,
  lastOpened   TEXT NOT NULL,
  PRIMARY KEY (orgName, repoName)
);

CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'Backlog'
);

CREATE TABLE branches (
  repoSlug   TEXT NOT NULL,
  branchName TEXT NOT NULL,
  lastOpened TEXT NOT NULL,
  taskId     TEXT REFERENCES tasks(id),
  PRIMARY KEY (repoSlug, branchName)
);
```

### Bootstrap function

At startup, `model/migrate.ts` runs all unapplied migrations in order:

```ts
import { SQL } from "bun";
import { readdirSync } from "node:fs";
import { join } from "node:path";

export async function migrate(db: SQL, migrationsDir: string) {
  await db`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename  TEXT PRIMARY KEY,
      appliedAt TEXT NOT NULL
    )
  `;

  const applied = new Set(
    (await db`SELECT filename FROM _migrations`).map((r: any) => r.filename)
  );

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    if (applied.has(filename)) continue;

    const sql = await Bun.file(join(migrationsDir, filename)).text();
    await db.unsafe(sql).simple();
    await db`
      INSERT INTO _migrations (filename, appliedAt)
      VALUES (${filename}, ${new Date().toISOString()})
    `;
  }
}
```

### Rules

- Never edit an existing migration file — add a new one instead.
- Each migration should be idempotent where possible (e.g. `CREATE TABLE IF NOT EXISTS`).
- Keep migrations small and focused on a single change.
- Migration files are committed to the repo alongside the code that depends on them.
