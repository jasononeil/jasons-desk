import { defineCommand } from "citty";
import { open } from "../api/open.ts";
import { parseRepoSlug } from "../api/paths.ts";
import { resolveDeskHome } from "../model/db.ts";
import { promptBranchName, promptRepoSlug } from "./prompts.ts";

export const openCommand = defineCommand({
  meta: {
    name: "open",
    description: "Clone or update a repo, set up a worktree, and cd into it",
  },
  args: {
    repoSlug: {
      type: "positional",
      description: "Repo as org/repo (omit to choose interactively)",
      required: false,
    },
    branch: {
      type: "positional",
      description: "Branch name (omit to choose interactively)",
      required: false,
    },
    task: {
      type: "string",
      description: "Link the branch to this task ID (creates the task if missing)",
    },
  },
  async run({ args }) {
    const deskHome = resolveDeskHome();
    const repoSlug = args.repoSlug ?? (await promptRepoSlug(deskHome));
    const { orgName, repoName } = parseRepoSlug(repoSlug);
    const branchName =
      args.branch ??
      (await promptBranchName({ deskHome, orgName, repoName }));

    const result = await open({
      deskHome,
      repoSlug,
      branchName,
      taskId: args.task,
    });

    for (const notice of result.notices) {
      console.error(notice);
    }
    // stdout = the path the shell wrapper will `cd` into.
    console.log(result.worktreePath);
  },
});
