# Workspace manager

This plan describes setting up a workspace manager in this "Jason's Desk" project.

As the plan is implemented it will no doubt need to evolve. Please update this document as needed throughout implementation.

## What we're doing

### The status quo

At the moment, I have dozens of repos in `~/workspace` and `~/workspace`.

When I want to do work in these, I need to:
- `cd ~/workspace/[dir]/`
- `git status`, maybe reset/stash/commit, and then `git switch main`
- `git pull`
- Ensure devbox, pnpm etc are installed

- Start `claude`, `opencode` or `pi` etc

Problems:
- Those steps take a while
- I easily lose track of work sessions that I start but don't finish.
- It doesn't allow for parallelizing work

### What I'm suggesting

I have a CLI tool called `desk`.

It takes care of:
- cloning / resetting / pulling a repo
- setting up a worktree for each piece of work
- tracking my work in progress (WIP) and helping me visualise it and stay on top of it
- and keeping track of what is regularly used in case we need to garbage collect and save disk space
- helping me start processes in the relevant directory:
  - a shell
  - an editor
  - an agent
  - an agent in a sandbox

## The first slice

A CLI tool written in Bun that has these commands:

### `desk open <repoSlug> <branch>`

- `repoSlug` is `[orgName]/[repoName]`
- if `repoSlug` is missing, offer a selectable list of repos I've used before, or allow me to type a new one
- if branch is missing, offer a selectable list of remote branches on this repo, or allow me to type in a new one
- it: clones or pulls the repo to `~/desk/repos/[org]/[repo]`
- sets up a worktree in `~/desk/worktrees/[org]/[repo]/[branch]/` for that branch
- Opens my current shell into the worktree directory
- Tracks this in `repos`, `branches` in database.
- `--task=<taskId>` links it to `tasks` in database.

### `desk list tasks`

- List all current tasks (with repos and branches nested)

### `desk list repos`

- List all current repos (with branches nested, tasks listed next to branch)

### `desk list branches`

- List branches, grouped by task
- Include branches not attached to tasks as a group ("orphaned")
- `--orphaned` lists just orphaned branches

### `desk task <taskId>`

- Create a task, and/or update its status to "InProgress"
- `<taskId>` is required (e.g. a Jira ticket ID like `CA-1234`)
- If you're in a worktree, `[branchName]` is offered as the suggested default when typing
- `--title` update title
- `--description` update description
- `--this-branch` add this branch to the task
- `--status` set the status

### SQLite (via Drizzle)

Schema is defined in `model/schema.ts` using Drizzle's schema API and applied via `drizzle-kit`. The Drizzle client is initialised with Bun SQL:

```ts
import { drizzle } from "drizzle-orm/bun-sql";
import { SQL } from "bun";

const client = new SQL(`sqlite://${deskHome}/desk.db`);
export const db = drizzle({ client });
```

`repos`

- orgName: string
- repoName: string
- defaultBranch: string
- lastOpened: date

`branches`

- orgName: string
- repoName: string
- branchName: string
- lastOpened: date
- taskId: string (nullable)

`tasks`

- id: string (user-provided, e.g. Jira ticket ID)
- title: string
- description: string
- status: Status (enum)

`Status` enum: `Backlog | InProgress | InReview | Blocked | Done | Abandoned`

### Architecture

- `cli/` - modules related to CLI command parsing and interactions (kept thin, minimal tests)
- `api/` - business logic as function modules. We may support web or native UI one day.
- `model/` - Drizzle schema definitions and db instance (used by `api/`)
- `migrations/` - Drizzle-generated migration files (`drizzle-kit generate`)

## Implementation details

### Shell integration

The real binary is called `desk-cli`. A shell function named `desk` wraps it, captures the output path from `desk open`, and `cd`s into it. Other commands pass through directly.

Install via `desk-cli shell-init [zsh|fish|bash]` which prints the shell snippet to stdout. Add the appropriate `eval` line to your shell config once.

`desk-cli` itself is exposed via the `bin` field in `package.json` pointing at `cli/index.ts` (shebang `#!/usr/bin/env bun`). `bun link` symlinks it onto PATH for local dev — no `bun build` step, since Bun runs `.ts` directly. Revisit if we ever want a standalone binary (`bun build --compile`).

See README for the exact symlink and shell setup instructions.

### Paths and configuration

All data lives under `~/desk/` by default:

- Repos: `~/desk/repos/[org]/[repo]`
- Worktrees: `~/desk/worktrees/[org]/[repo]/[branch]/`
- Database: `~/desk/desk.db`

Override the base path with the `DESK_HOME` environment variable (useful for tests).

Slashes in branch names are replaced with `-` in filesystem paths (e.g. `feature/my-thing` → `feature-my-thing`).

### `desk open` flow

1. If currently inside a worktree, print a notice: "Leaving worktree `[org]/[repo]/[branch]`"
2. Resolve `repoSlug` and `branch` — prompt interactively if missing
3. Check base repo at `~/desk/repos/[org]/[repo]`:
   - If not cloned: clone via SSH (`git@github.com:[org]/[repo].git`), detect default branch via `git ls-remote --symref origin HEAD`, store in `repos.defaultBranch`
   - If already cloned: error if uncommitted changes exist; otherwise switch to default branch and `git pull`
4. Resolve worktree path: `~/desk/worktrees/[org]/[repo]/[sanitized-branch]/`
5. If worktree already exists: print notice "Worktree already exists, opening existing" and `cd` in
6. If branch doesn't exist on remote: create it automatically from the default branch
7. If branch is already checked out in another worktree: `cd` into that worktree with a notice (path is deterministic, no need to query git)
8. Otherwise: `git worktree add` and `cd` in
9. Update `repos.lastOpened` and `branches.lastOpened` in the database
10. If `--task` flag provided, link branch to task in database

### Interactive prompts

Uses `@inquirer/prompts` for selectable lists and text input.

- Repo selector: lists previously used repos from the database, plus a "new repo" option to type a `repoSlug`
- Branch selector: lists remote branches via `git ls-remote`, plus a "new branch" option to type a name

### CLI parsing

Uses `citty` for command and flag parsing.

### Terminal output

Uses `node:util` `styleText` for terminal colors. No third-party color library. If Bun compatibility issues arise, evaluate `kleur` or `picocolors` as alternatives.

List commands render output as a tree (`├──` / `└──` style) with color to reflect hierarchy.

### Git operations

All git commands go through a stable interface in `api/git.ts` so callers are insulated from the implementation — if a GUI or alternative git backend is added later, only `api/git.ts` changes.

Default implementation: `simple-git`. It wraps the system `git` binary with a typed, promise-based API, which removes a lot of stdout-parsing and exit-code-classifying boilerplate we'd otherwise write by hand. Operations without first-class methods (notably `git worktree ...` and `git ls-remote --symref origin HEAD` for default-branch detection) drop down to `.raw([...])`.

If `simple-git` turns out to have Bun compatibility issues or doesn't cover something we need, falling back to `Bun.spawn` is a contained change behind the same interface.

### Testing

- `model/` - kept thin, rely on Drizzle for queries, not heavily tested
- `cli/` — kept thin, not heavily tested
- `api/` — unit tests for pure logic, integration tests for anything touching SQLite or the filesystem
- Tests use `DESK_HOME` pointed at a temp directory for isolation

### Deferred to later slices

- Garbage collection (`desk gc`) based on `lastOpened`
- Launching processes (shell, editor, agent, agent-in-sandbox) from a worktree

---

## Test Cases

### Path / utility helpers (e.g. `api/paths.ts`)

- **`sanitizeBranchName` replaces `/` with `-`** — `"feature/my-thing"` → `"feature-my-thing"`.
- **`sanitizeBranchName` handles multiple slashes** — `"a/b/c"` → `"a-b-c"`.
- **`sanitizeBranchName` is a no-op for names without slashes** — `"main"` → `"main"`.
- **`worktreePath` constructs the correct absolute path** — Given `{ deskHome, orgName, repoName, branchName: "feature/foo" }`, returns `$DESK_HOME/worktrees/org/repo/feature-foo`.
- **`repoPath` constructs the correct absolute path** — Given `{ deskHome, orgName, repoName }`, returns `$DESK_HOME/repos/org/repo`.
- **`parseRepoSlug` splits `"org/repo"` into `{ orgName, repoName }`** — Correct parsing of the standard format.
- **`parseRepoSlug` throws on a slug with no `/`** — A bare string like `"myrepo"` is rejected with a clear error.
- **`parseRepoSlug` throws on a slug with more than one `/`** — `"org/repo/extra"` is rejected.

### `api/git.ts`

Integration tests using a local bare git repo to avoid network calls.
If private utility functions are needed for setting up the local git repo to avoid excessive boilerplate in test cases, do it. (Once boilerplate exists 3+ times, make a utility function for it. Doesn't need to be exported or separately tested).

- **`cloneRepo` clones to the expected path** — Given `orgName/repoName`, the repo ends up at `$DESK_HOME/repos/[org]/[repo]` and is a valid git repository.
- **`cloneRepo` throws a descriptive error on a non-existent repo** — SSH clone failure surfaces a clear error rather than crashing silently.
- **`detectDefaultBranch` returns the correct branch name** — Given a local test repo with HEAD pointing to `main`, returns `"main"`.
- **`detectDefaultBranch` returns the correct branch name** — Given a local test repo with HEAD pointing to `master`, returns `"master"`.
- **`pullRepo` fetches latest commits** — After a commit is added to the remote, `pullRepo` makes it locally visible.
- **`pullRepo` throws if the working directory has uncommitted changes** — Dirty working tree results in a clear error.
- **`hasUncommittedChanges` returns `true` for staged and unstaged changes** — Covers both scenarios independently.
- **`hasUncommittedChanges` returns `false` on a clean repo** — No false positives on a freshly cloned, unmodified repo.
- **`addWorktree` creates the worktree directory at the expected path** — `$DESK_HOME/worktrees/[org]/[repo]/[sanitized-branch]/` exists and is a valid git worktree.
- **`addWorktree` with a branch containing `/` sanitizes the path** — `feature/my-thing` produces directory `feature-my-thing`, not a nested subdirectory.
- **`addWorktree` for an existing remote branch checks it out correctly** — An already-present branch is checked out rather than creating a new one.
- **`addWorktree` for a non-existent branch creates it from the default branch** — New branch is created locally and the worktree is set up from it.
- **`worktreeExists` returns `true` when the path is already set up** — Correctly detects an existing worktree directory.
- **`worktreeExists` returns `false` when no worktree has been created yet** — No false positives.
- **`listRemoteBranches` returns all remote branch names** — Used to populate the interactive branch selector.
- **`getCurrentWorktreeInfo` returns `null` when not inside a desk-managed worktree** — Called from an unrelated directory, does not throw.
- **`getCurrentWorktreeInfo` returns `{ orgName, repoName, branchName }` from inside a worktree** — Correctly parses path components when `$PWD` is a managed worktree path.

### `api/open.ts`

Integration tests using a temp `DESK_HOME` and a local bare git repo.

- **Full happy path: new repo, new branch** — Calling `open("org/repo", "feature/foo")` clones the repo, creates the worktree, inserts rows in `repos` and `branches`, and returns the expected worktree path.
- **Re-opening an existing worktree** — Calling `open` again for the same `(repoSlug, branch)` returns the same path without error, and updates `lastOpened` in both `repos` and `branches`.
- **`--task` flag links the branch to the task** — After `open("org/repo", "branch", { taskId: "CA-1234" })`, the `branches` row has `taskId = "CA-1234"`.
- **`--task` flag creates the task if it does not yet exist** — Row is created in `tasks` with `Backlog` status without requiring a prior `desk task` call.
- **Dirty working directory on re-open throws** — Uncommitted changes in the base repo clone surfaces a clear error and does not proceed.
- **Prints "Leaving worktree" notice when called from inside a worktree** — When `$PWD` is a managed worktree path, the notice message is included in output.
- **Branch already checked out in another worktree** — Prints a notice and returns the existing worktree path rather than attempting a second `git worktree add`.
- **Non-existent branch is created from default branch** — Worktree is set up from the default branch head.
- **Two repos with same `repoName` but different `orgName` stored at distinct paths** — No collision between `acme/myapp` and `other/myapp`.

### `api/task.ts`

- **Creating a new task sets status to `"InProgress"`** — Calling `openTask("CA-1234")` inserts a new task with `status: "InProgress"`.
- **Opening an existing `Backlog` task transitions it to `"InProgress"`** — Pre-existing task in `Backlog` status is updated.
- **Opening an already `InProgress` task is a no-op on status** — Does not error; status remains `"InProgress"`.
- **`--title` updates the task's title** — Correctly persists the new title.
- **`--description` updates the task's description** — Correctly persists the new description.
- **`--this-branch` links the current branch to the task** — When `$PWD` resolves to a managed worktree, the corresponding `branches` row is updated with the `taskId`.
- **`--this-branch` outside a managed worktree returns a clear error** — Does not silently fail or create a dangling link.
- **`--status` sets the task to any valid `Status` value** — All six enum values can be set.
- **`--status` with an invalid value returns a validation error** — Unrecognized strings are rejected before any database write.
- **`taskId` is required — omitting it errors** — Returns a useful message when no ID is provided.

### `api/list.ts`

- **`listTasks` returns tasks with nested branches** — Each task entry includes its associated `branches` array; tasks with no branches show an empty array.
- **`listRepos` returns repos with nested branches** — Each repo entry includes branches, each annotated with `taskId` (or `null`).
- **`listBranches` groups branches by task** — Branches with the same `taskId` appear under that task's group.
- **`listBranches` includes an "orphaned" group for `taskId: null` branches** — Correctly separated from task-linked branches.
- **`listBranches --orphaned` returns only branches with no task** — Branches with a task are excluded.
- **All list functions return empty structures gracefully on an empty database** — No throws, no crashes.
