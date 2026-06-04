import { existsSync } from "node:fs";
import { input, search } from "@inquirer/prompts";
import { listRemoteBranches } from "../api/git.ts";
import { listRepos } from "../api/list.ts";
import { repoPath } from "../api/paths.ts";

// `desk open` is invoked via a shell wrapper that captures stdout to `cd` into
// the resulting path, so prompts must render on stderr to remain visible.
const PROMPT_CONTEXT = { output: process.stderr } as const;

/**
 * Resolve a repo slug interactively. Defaults to free-text input with
 * autocomplete from previously-used repos.
 */
export async function promptRepoSlug(deskHome: string): Promise<string> {
  const known = listRepos(deskHome).map(
    (r) => `${r.orgName}/${r.repoName}`,
  );
  if (known.length === 0) {
    return input({ message: "Repo (org/repo):" }, PROMPT_CONTEXT);
  }
  return search<string>(
    {
      message: "Repo (org/repo):",
      source: (term) => {
        const lower = term?.toLowerCase();
        const suggestions = lower
          ? known.filter((r) => r.toLowerCase().includes(lower))
          : known;
        const choices = suggestions.map((r) => ({ value: r }));
        // Always surface the literal input so the user can enter a new repo.
        if (term && !known.includes(term)) {
          choices.unshift({ value: term });
        }
        return Promise.resolve(choices);
      },
    },
    PROMPT_CONTEXT,
  );
}

/**
 * Resolve a branch name interactively. If the base repo is cloned locally,
 * offers autocomplete from remote branches while still allowing free-text
 * input for new branches. Falls back to plain input when no branches exist.
 */
export async function promptBranchName(args: {
  deskHome: string;
  orgName: string;
  repoName: string;
}): Promise<string> {
  const base = repoPath(args);
  if (!existsSync(base)) {
    return input({ message: "Branch:" }, PROMPT_CONTEXT);
  }
  const remoteBranches = await listRemoteBranches({ repoPath: base });
  if (remoteBranches.length === 0) {
    return input({ message: "Branch:" }, PROMPT_CONTEXT);
  }
  return search<string>(
    {
      message: "Branch:",
      source: (term) => {
        const lower = term?.toLowerCase();
        const suggestions = lower
          ? remoteBranches.filter((b) => b.toLowerCase().includes(lower))
          : remoteBranches;
        const choices = suggestions.map((b) => ({ value: b }));
        // Always surface the literal input so the user can create a new branch.
        if (term && !remoteBranches.includes(term)) {
          choices.unshift({ value: term });
        }
        return Promise.resolve(choices);
      },
    },
    PROMPT_CONTEXT,
  );
}
