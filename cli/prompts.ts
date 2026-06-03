import { existsSync } from "node:fs";
import { input, select } from "@inquirer/prompts";
import { listRemoteBranches } from "../api/git.ts";
import { listRepos } from "../api/list.ts";
import { repoPath } from "../api/paths.ts";

const NEW_REPO = Symbol("new-repo");
const NEW_BRANCH = Symbol("new-branch");

/**
 * Resolve a repo slug interactively. Lists previously-used repos from the
 * database plus a "new repo" option.
 */
export async function promptRepoSlug(deskHome: string): Promise<string> {
  const known = listRepos(deskHome);
  if (known.length === 0) {
    return input({ message: "Repo (org/repo):" });
  }
  const choice = await select<string | typeof NEW_REPO>({
    message: "Repo:",
    choices: [
      ...known.map((r) => ({
        name: `${r.orgName}/${r.repoName}`,
        value: `${r.orgName}/${r.repoName}`,
      })),
      { name: "New repo…", value: NEW_REPO },
    ],
  });
  if (choice === NEW_REPO) {
    return input({ message: "Repo (org/repo):" });
  }
  return choice;
}

/**
 * Resolve a branch name interactively. If the base repo is cloned locally,
 * lists remote branches as choices. Otherwise falls back to free text input.
 */
export async function promptBranchName(args: {
  deskHome: string;
  orgName: string;
  repoName: string;
}): Promise<string> {
  const base = repoPath(args);
  if (!existsSync(base)) {
    return input({ message: "Branch:" });
  }
  const remoteBranches = await listRemoteBranches({ repoPath: base });
  if (remoteBranches.length === 0) {
    return input({ message: "Branch:" });
  }
  const choice = await select<string | typeof NEW_BRANCH>({
    message: "Branch:",
    choices: [
      ...remoteBranches.map((b) => ({ name: b, value: b })),
      { name: "New branch…", value: NEW_BRANCH },
    ],
  });
  if (choice === NEW_BRANCH) {
    return input({ message: "Branch name:" });
  }
  return choice;
}
