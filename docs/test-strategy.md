# Testing strategy

In priority order:

- Types: **always** use typescript. `pnpm typecheck`
- Components: **usually** use a separate storybook story for each state. Visual regressions can be tested with Chromatic in PRs.
- Interaction: **sometimes** use a storybook interaction test, if there's some complex state in the component we need to manage. `pnpm storybook:test`
- Unit tests: **only** if for business logic. Try avoid mocking, prefer dependency injection. Use vitest. `pnpm test:ci`
- End to end tests: **not supported yet** If there's a particular risk to a feature, where a regression isn't tested by types, storybook or vitest - an end-to-end test with Playwright might make sense. Note potential end-to-end tests, and the regressions you are concerned about below.

## Potential end-to-end tests

- (Add here)
