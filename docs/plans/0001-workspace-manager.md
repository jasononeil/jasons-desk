# Workspace manager

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

### SQLite

`repos`

- orgName: string
- repoName: string
- defaultBranch: string
- lastOpened: date

`branches`

- repoSlug: string [orgName/repoName]
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
- `model/` - utilities for interacting with our SQLite database
- `migrations/` - numbered `.sql` migration files (see `docs/tech/sqlite.md`)

## Implementation details

### Shell integration

The real binary is called `desk-cli`. A shell function named `desk` wraps it, captures the output path from `desk open`, and `cd`s into it. Other commands pass through directly.

Install via `desk-cli shell-init [zsh|fish|bash]` which prints the shell snippet to stdout. Add the appropriate `eval` line to your shell config once.

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

All git commands are run via `Bun.spawn` (shell out to system git), wrapped behind a stable interface in `api/git.ts`. This keeps callers insulated from the implementation — if a GUI or alternative git backend is added later, only `api/git.ts` changes.

### Testing

- `cli/` — kept thin, not heavily tested
- `api/` — unit tests for pure logic, integration tests for anything touching SQLite or the filesystem
- Tests use `DESK_HOME` pointed at a temp directory for isolation

### Deferred to later slices

- Garbage collection (`desk gc`) based on `lastOpened`
- Launching processes (shell, editor, agent, agent-in-sandbox) from a worktree
