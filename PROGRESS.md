# Progress

We are currently implementing @docs/plans/0001-workspace-manager.md

- Implement one checklist item at a time - starting with the first unticked item
- Run a separate subagent to review the current task goal and the diff, and provide feedback
- Iterate based on that feedback
- Tick off the item in this checklist and commit changes

## Checklist

Build order, foundations up to user-visible surface. Tick off as we go; update this list if the plan evolves.

After completing a checklist item:
- run a separate subagent to review

Commit changes as you tick off each checklist item.

- [x] **1. Project scaffolding & dependencies** — `bun init`, install `drizzle-orm`, `drizzle-kit`, `simple-git`, `citty`, `@inquirer/prompts`. Add scripts (`verify`, `test`, `db:generate`). Decide binary entrypoint (`desk-cli`) and how `bun build` / symlinking will work, since the shell wrapper depends on it. Get `bun test` runnable.
- [x] **2. Pure helpers — `api/paths.ts`** — `sanitizeBranchName`, `worktreePath`, `repoPath`, `parseRepoSlug`. Unit tests per the test cases above. Establishes the test feedback loop before anything with I/O.
- [x] **3. Database — `model/schema.ts` + first migration** — Define `repos`, `branches`, `tasks` + `Status` enum. Wire up `drizzle({ client: new SQL(...) })` with `DESK_HOME` resolution. Generate first migration via `drizzle-kit`. Smoke test: insert/select in a temp dir.
- [x] **4. Git wrapper — `api/git.ts`** — Biggest unknown, so do it next. Smoke-test `simple-git` under Bun first. Build the local-bare-repo test helper here (reused by `open.ts`). Implement clone, pull, default-branch detection, worktree add, branch listing, `getCurrentWorktreeInfo`.
- [x] **5. `api/task.ts`** — Smaller surface than `open.ts` and only touches the DB. Good warm-up for combining schema + business logic.
- [x] **6. `api/open.ts`** — The orchestrator. Pulls together paths + git + db + tasks. After git and task because it composes them.
- [x] **7. `api/list.ts`** — Read-only queries over the data the previous steps produce.
- [ ] **8. CLI layer — `cli/`** — Wire `citty` commands to the api functions, add `@inquirer/prompts` for interactive selectors. Kept thin.
- [ ] **9. Test it** - actually run the CLI commands and ensure they work. You can test with repos `jasononeil/jasons-desk` and `jasononeil/perth-web-devs-meetup`. Make sure it works correctly. Add new steps to iterate if needed.
- [ ] **10. Shell integration** — `desk-cli shell-init [zsh|fish|bash]` printing the wrapper snippet, plus README install instructions. Last because it only matters once `desk open` actually returns a path to `cd` into.
