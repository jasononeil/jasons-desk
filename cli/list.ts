import { defineCommand } from "citty";
import { listBranches, listRepos, listTasks } from "../api/list.ts";
import { resolveDeskHome } from "../model/db.ts";
import {
  bold,
  branchName as styleBranch,
  dim,
  orphan,
  repoSlug as styleRepo,
  status as styleStatus,
  taskId as styleTaskId,
  tree,
} from "./format.ts";

const tasksCommand = defineCommand({
  meta: { name: "tasks", description: "List tasks with their branches" },
  run() {
    const deskHome = resolveDeskHome();
    const tasks = listTasks(deskHome);
    if (tasks.length === 0) {
      console.log(dim("No tasks yet."));
      return;
    }
    for (const task of tasks) {
      const title = task.title ? `  ${task.title}` : "";
      console.log(
        `${bold(styleTaskId(task.id))} ${styleStatus(task.status)}${title}`,
      );
      task.branches.forEach((branch, i) => {
        const last = i === task.branches.length - 1;
        console.log(
          `${last ? tree.last : tree.branch} ${styleRepo(branch.orgName, branch.repoName)} ${styleBranch(branch.branchName)}`,
        );
      });
    }
  },
});

const reposCommand = defineCommand({
  meta: { name: "repos", description: "List repos with their branches" },
  run() {
    const deskHome = resolveDeskHome();
    const repos = listRepos(deskHome);
    if (repos.length === 0) {
      console.log(dim("No repos yet."));
      return;
    }
    for (const repo of repos) {
      console.log(
        `${bold(styleRepo(repo.orgName, repo.repoName))} ${dim(`(default: ${repo.defaultBranch})`)}`,
      );
      repo.branches.forEach((branch, i) => {
        const last = i === repo.branches.length - 1;
        const taskLabel = branch.taskId
          ? `  ${styleTaskId(branch.taskId)}`
          : `  ${orphan("(orphaned)")}`;
        console.log(
          `${last ? tree.last : tree.branch} ${styleBranch(branch.branchName)}${taskLabel}`,
        );
      });
    }
  },
});

const branchesCommand = defineCommand({
  meta: { name: "branches", description: "List branches, grouped by task" },
  args: {
    orphaned: {
      type: "boolean",
      description: "Only show branches with no task",
    },
  },
  run({ args }) {
    const deskHome = resolveDeskHome();
    const groups = listBranches(deskHome, { orphaned: args.orphaned });
    if (groups.every((g) => g.branches.length === 0)) {
      console.log(dim("No branches yet."));
      return;
    }
    for (const group of groups) {
      if (group.task) {
        const title = group.task.title ? `  ${group.task.title}` : "";
        console.log(
          `${bold(styleTaskId(group.task.id))} ${styleStatus(group.task.status)}${title}`,
        );
      } else {
        console.log(orphan("(orphaned)"));
      }
      group.branches.forEach((branch, i) => {
        const last = i === group.branches.length - 1;
        console.log(
          `${last ? tree.last : tree.branch} ${styleRepo(branch.orgName, branch.repoName)} ${styleBranch(branch.branchName)}`,
        );
      });
    }
  },
});

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List tasks, repos, or branches",
  },
  subCommands: {
    tasks: tasksCommand,
    repos: reposCommand,
    branches: branchesCommand,
  },
});
