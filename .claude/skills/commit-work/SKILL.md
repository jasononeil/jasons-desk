---
description: Tasks to do when you think you're done and are ready to commit
user-invocable: true
---

# Commit workflow

## Ensure tests pass

Run `devbox run verify`.

## Quick subagent review

Spawn a subagent. Tell it the goal of the current piece of work - what you are trying to achieve. Don't give it too much context about decisions you've made, we don't want to bias it. Tell it to use `git status` and `git diff` to review the diff against the stated goal.

Assess its feedback and make changes if it makes sense. If changes required are significant, request another review.

## Update docs

Read the list of docs
- Read README.md
- Read AGENTS.md
- List docs in `docs/product` and `docs/tech`, read those that might be relevant to this PR

Make updates as required.

## Make the commit

Ensure nothing unexpected is staged for commit (eg "TODO" comments or log files).

Then write a commit message:

- First line: summary
- Include the why - what goal were you trying to achieve
- Include any decisions or trade-offs made

Try to have one commit per task - if multiple unrelated changes were made, commit them separately.
