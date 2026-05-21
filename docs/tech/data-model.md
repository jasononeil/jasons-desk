# Data model

All data is stored in SQLite at `$DESK_HOME/desk.db` (default: `~/desk/desk.db`). See `docs/tech/sqlite.md` for the migration approach.

## Tables

### `repos`

Tracks every git repository that has been opened with `desk open`.

| Column          | Type | Notes                                              |
| --------------- | ---- | -------------------------------------------------- |
| `orgName`       | TEXT | GitHub org or user (e.g. `my-org`)             |
| `repoName`      | TEXT | Repository name (e.g. `my-app`)                    |
| `defaultBranch` | TEXT | Detected via `git ls-remote --symref origin HEAD`  |
| `lastOpened`    | TEXT | ISO 8601 timestamp, updated on each `desk open`    |

Primary key: `(orgName, repoName)`

The combination `orgName/repoName` is referred to as a **`repoSlug`** throughout the codebase.

---

### `branches`

Tracks every worktree that has been set up. One row per `(repoSlug, branchName)`.

| Column       | Type | Notes                                                        |
| ------------ | ---- | ------------------------------------------------------------ |
| `repoSlug`   | TEXT | Foreign key → `repos(orgName, repoName)` as `org/repo`       |
| `branchName` | TEXT | Git branch name (e.g. `feature/my-thing`)                    |
| `lastOpened` | TEXT | ISO 8601 timestamp, updated on each `desk open`              |
| `taskId`     | TEXT | Nullable. Foreign key → `tasks(id)`. Set via `--task` flag or `desk task --this-branch` |

Primary key: `(repoSlug, branchName)`

Branches without a `taskId` are considered **orphaned** and surfaced separately in `desk list branches --orphaned`.

Worktree path on disk: `$DESK_HOME/worktrees/[org]/[repo]/[sanitized-branch]/`
where slashes in `branchName` are replaced with `-` (e.g. `feature/my-thing` → `feature-my-thing`).

---

### `tasks`

Tracks units of work, typically corresponding to a Jira ticket or similar external issue.

| Column        | Type | Notes                                             |
| ------------- | ---- | ------------------------------------------------- |
| `id`          | TEXT | User-provided, required (e.g. `CA-1234`)          |
| `title`       | TEXT | Short description                                 |
| `description` | TEXT | Longer notes                                      |
| `status`      | TEXT | One of the `Status` enum values (see below)       |

Primary key: `id`

A task can span multiple branches across multiple repos.

---

## Enums

### `Status`

Stored as a TEXT column on `tasks`. Validated in application code.

| Value        | Meaning                                      |
| ------------ | -------------------------------------------- |
| `Backlog`    | Not yet started                              |
| `InProgress` | Actively being worked on                     |
| `InReview`   | Work done, waiting on review or feedback     |
| `Blocked`    | Cannot proceed, waiting on something else    |
| `Done`       | Completed                                    |
| `Abandoned`  | No longer being pursued                      |

---

## Relationships

```
repos (1) ──< branches (many)
tasks (1) ──< branches (many)   [optional — branches.taskId is nullable]
```

A branch belongs to exactly one repo and optionally one task. A task can have branches across multiple repos.
