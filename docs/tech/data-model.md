# Data model

All data is stored in SQLite at `$DESK_HOME/desk.db` (default: `~/desk/desk.db`). See `docs/tech/drizzle.md` for the migration approach.

Schema is defined in `model/schema.ts`.

## Tables

### `repos`

Tracks every git repository that has been opened with `desk open`.

```ts
export const repos = sqliteTable("repos", {
  orgName: text("orgName").notNull(),
  repoName: text("repoName").notNull(),
  defaultBranch: text("defaultBranch").notNull(),
  lastOpened: text("lastOpened").notNull(), // ISO 8601, updated on each `desk open`
}, t => [primaryKey({ columns: [t.orgName, t.repoName] })]);
```

The combined `orgName/repoName` string is referred to as a **`repoSlug`** in CLI-facing code and user-visible output, but is always stored as two separate columns.

---

### `branches`

Tracks every worktree that has been set up. One row per `(orgName, repoName, branchName)`.

```ts
export const branches = sqliteTable("branches", {
  orgName: text("orgName").notNull(),
  repoName: text("repoName").notNull(),
  branchName: text("branchName").notNull(),
  lastOpened: text("lastOpened").notNull(), // ISO 8601, updated on each `desk open`
  taskId: text("taskId").references(() => tasks.id), // nullable
}, t => [
  primaryKey({ columns: [t.orgName, t.repoName, t.branchName] }),
  foreignKey({ columns: [t.orgName, t.repoName], foreignColumns: [repos.orgName, repos.repoName] }),
]);
```

Branches without a `taskId` are considered **orphaned** and surfaced separately in `desk list branches --orphaned`.

Worktree path on disk: `$DESK_HOME/worktrees/[org]/[repo]/[sanitized-branch]/`
where slashes in `branchName` are replaced with `-` (e.g. `feature/my-thing` → `feature-my-thing`).

---

### `tasks`

Tracks units of work, typically corresponding to a Jira ticket or similar external issue.

```ts
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),            // user-provided, e.g. "CA-1234"
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("Backlog"), // see Status enum
});
```

A task can span multiple branches across multiple repos.

---

## Enums

### `Status`

Stored as a TEXT column on `tasks`. Validated in application code.

| Value        | Meaning                                   |
| ------------ | ----------------------------------------- |
| `Backlog`    | Not yet started                           |
| `InProgress` | Actively being worked on                  |
| `InReview`   | Work done, waiting on review or feedback  |
| `Blocked`    | Cannot proceed, waiting on something else |
| `Done`       | Completed                                 |
| `Abandoned`  | No longer being pursued                   |

---

## Relationships

```
repos (1) ──< branches (many)
tasks (1) ──< branches (many)   [optional — branches.taskId is nullable]
```

A branch belongs to exactly one repo and optionally one task. A task can have branches across multiple repos.
