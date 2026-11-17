# CLI product spec

## Purpose

`desk` is a personal CLI tool for managing git-based work. It reduces the friction of switching between repos and branches, tracks work in progress, and ensures you always start from a clean, up-to-date state.

## Core interactions

### Opening a worktree

```
desk open <repoSlug> <branch>
```

The primary interaction. Given a repo and branch, `desk` ensures the repo is cloned and up to date, sets up a git worktree, and drops you directly into it. If either argument is missing, you're prompted to choose or create one.

**Key behaviours:**
- Always pulls latest before setting up
- Creates the branch from the freshly fetched `origin/<default>` if it doesn't exist yet (with no upstream set, so it won't track the default branch)
- Idempotent — re-running takes you back to an existing worktree
- Notifies you when you're leaving an existing worktree
- Runs `direnv allow` on the worktree path if direnv is installed, so the shell doesn't prompt on entry

### Tracking tasks

```
desk task <taskId>
```

Associates a unit of work (e.g. a Jira ticket) with the current context. Sets the task to in-progress. Branches can be linked to tasks at open time (`desk open <repoSlug> <branch> --task=<taskId>`) or after the fact (`desk task <taskId> --this-branch`).

### Seeing what's on

```
desk list tasks
desk list repos
desk list branches
```

Visualises current work across repos, branches, and tasks. Branches without a task are surfaced as orphaned — a nudge to either link them or clean them up.

### Shell integration

```
desk-cli shell-init [bash|zsh|fish]
```

The real binary is `desk-cli`; a shell function named `desk` wraps it so that
`desk open` can `cd` into the resulting worktree (the parent process can't
change the caller's directory, so the wrapper captures stdout and `cd`s itself).
Other subcommands pass straight through.

Install once by sourcing the output from your shell rc file (see README).

## Values

- **Visible WIP** - makes it easy to see what's in flight and what's been forgotten
- **Get your workspace ready** - does all the work to get it ready so you can begin working immediately
- **Allow garbage collection** - should be easy to clear up disk space based on completed tasks and what's not needed
- **Low ceremony** - you can open a branch without a task, add a task later
