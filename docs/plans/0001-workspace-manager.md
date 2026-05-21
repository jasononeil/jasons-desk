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

### `desk open <repo> <branch>`

- repo is `[orgName]/[repoName]`
- if repo is missing, offer a selectable list of repos I've used before, or allow me to create one
- if branch is missing, offer a selectable list of branches on this repo, or allow me to type in a new one
- it: clones or pulls the repo to `~/desk/repos/[org]/[repo]`
- sets up a worktree in `~/desk/worktrees/[repo]/[branch]/` for that branch
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

- Create a task, and/or update it's status to "InProgress"
- If `<taskId>` is missing and you're in a worktree, allow typing, with `[branchName]` as the suggested default.
- `--title` update title
- `--description` update description
- `--this-branch` add this branch to the task
- `--status` set the status

### Sqlite

`repos`

- orgName: string
- repoName: string
- lastOpened: date
- branches: Branch[]

`branches`

- repo: Repo [orgName / repoName]
- branchName: string
- lastOpened: date
- task: Task

`tasks`

- id: string
- title: string
- description: string
- branches: Branch[]
- status: Status

`status`

- id: string
- title: string
- tasks: Task[]

### Architecture

- `cli/` - modules related to CLI command parsing and interactions
- `api/` - business logic in separate API classes. We may support web or native UI one day.
- `model/` - utilities for interacting with our Sqlite database
