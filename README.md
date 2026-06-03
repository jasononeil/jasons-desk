# Jason's Desk

A set of scripts, tools and UI to help with my organisation.

## `desk` workspace manager

`desk` is a personal CLI for managing git-based work — it clones/fetches repos
(as bare clones), sets up worktrees per branch, and tracks tasks. See
`docs/product/cli.md`.

### Install (local development)

The real binary is `desk-cli`. A thin shell wrapper named `desk` captures the
output of `desk open` and `cd`s into the resulting worktree.

```sh
# Inside the repo
bun install
bun link              # exposes `desk-cli` globally via the `bin` field in package.json
```

Then add the shell wrapper to your shell config (full instructions land with
step 10 of the plan — `desk-cli shell-init [zsh|fish|bash]`).

### Scripts

- `bun test` — run unit/integration tests via `bun:test`
- `bun run verify` — typecheck (`bun tsc`) and test (also exposed as `devbox run verify`)
- `bun run db:generate` — generate a new Drizzle migration from `model/schema.ts`
