# Agent instructions

- Read @README.md for project context
- There are more markdown files in `docs/`
- Product specs (evolve over time) live in `docs/product/`.
  - Read relevant specs whenever working on that part of the product.
  - Keep product specs up-to-date as you implement changes in functionality.
  - See `docs/product/cli.md` for the CLI.
- Current plans (point-in-time snapshots) are in `docs/plans/`
  - Read only if that's the plan you're implementing, or you need to understand historic decisions. Otherwise check product spec instead.
- After finishing work always get a subagent to check if docs need updating based on the current branch diff (README.md, AGENTS.md).

## Tech choices

- We use Bun instead of Node.js. See `docs/tech/bun.md`
- We use Devbox for installing tooling. See `devbox.json`
- We can use MCP tools in scripts using MCPorter. See `docs/tech/mcporter.md`
- We use SQLite via Drizzle ORM (with Bun SQL). See `docs/tech/drizzle.md`
- Data model (tables, enums, relationships) is documented in `docs/tech/data-model.md`
- CLI parsing uses `citty`
- Interactive prompts use `@inquirer/prompts`
- Terminal color uses `node:util` `styleText` (no third-party color library)

## Data model

- Data model (tables, enums, relationships) is documented in `docs/tech/data-model.md`

### Architecture

Repo layout:

- `cli/` - modules related to CLI command parsing and interactions (kept thin, minimal tests)
- `api/` - business logic as function modules. (Used in CLI. We may support web or native UI one day.)
- `model/` - Drizzle schema definitions and db instance (used by `api/`)
- `migrations/` - Drizzle-generated migration files (`drizzle-kit generate`)

## Tests

Use `devbox run verify` to run all local verification steps including `bun:test`.

Tests are written using `bun:test`.

- `cli/` — kept thin, no tests needed
- `api/` — unit tests for pure logic, integration tests for anything touching SQLite or the filesystem
- Tests use `DESK_HOME` pointed at a temp directory for isolation

## Running locally

To try local changes without recompiling, run `devbox run cli <args>` from the repo.

The `desk-cli` on the path is a compiled version and may not be up-to-date with the current source code.
