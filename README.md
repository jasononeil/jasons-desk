# Jason's Desk

A set of scripts, tools and UI to help with my organisation.

## `desk` workspace manager

`desk` is a personal CLI for managing git-based work — it clones/fetches repos
(as bare clones), sets up worktrees per branch, and tracks tasks. See
`docs/product/cli.md`.

### Install (local development)

The real binary is `desk-cli`. A thin shell wrapper named `desk` captures the
output of `desk open` and `cd`s into the resulting worktree; everything else
passes through unchanged.

```sh
# Inside the repo
bun install
bun link              # exposes `desk-cli` globally via the `bin` field in package.json
```

Then add the wrapper to your shell config so plain `desk` works:

```sh
# zsh (~/.zshrc)
eval "$(desk-cli shell-init zsh)"

# bash (~/.bashrc)
eval "$(desk-cli shell-init bash)"
```

```fish
# fish (~/.config/fish/config.fish)
desk-cli shell-init fish | source
```

Reload your shell (or `source` the config file) and `desk open <org>/<repo> <branch>`
will leave you in the worktree.

### Scripts

- `bun test` — run unit/integration tests via `bun:test`
- `bun run verify` — typecheck (`bun tsc`) and test (also exposed as `devbox run verify`)
- `bun run db:generate` — generate a new Drizzle migration from `model/schema.ts`
