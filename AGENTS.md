# Agent instructions

- Read @README.md for project context
- There are more markdown files in `docs/`
- Current plans (point-in-time snapshots) are in `docs/plans/`
- Product specs (evolve over time) live in `docs/product/`. Keep these up-to-date as you implement changes in functionality.
  - See `docs/product/cli.md` for the CLI.

## Tech choices

- We use Bun instead of Node.js. See `docs/tech/bun.md`
- We use Devbox for installing tooling. See `devbox.json`
- We can use MCP tools in scripts using MCPorter. See `docs/tech/mcporter.md`
- We use SQLite via `import { SQL } from "bun"` with hand-rolled migrations. See `docs/tech/sqlite.md`
- Data model (tables, enums, relationships) is documented in `docs/tech/data-model.md`
- CLI parsing uses `citty`
- Interactive prompts use `@inquirer/prompts`
- Terminal color uses `node:util` `styleText` (no third-party color library)

## Data model

- Data model (tables, enums, relationships) is documented in `docs/tech/data-model.md`
