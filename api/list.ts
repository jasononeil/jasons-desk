import { getDb } from "../model/db.ts";
import { branches, repos, tasks } from "../model/schema.ts";

export type Task = typeof tasks.$inferSelect;
export type Repo = typeof repos.$inferSelect;
export type Branch = typeof branches.$inferSelect;

export type TaskWithBranches = Task & {
  branches: Branch[];
};

export type RepoWithBranches = Repo & {
  branches: Branch[];
};

/** A `task` of `null` represents the "orphaned" group of branches with no task. */
export type BranchGroup = {
  task: Task | null;
  branches: Branch[];
};

export function listTasks(deskHome: string): TaskWithBranches[] {
  const db = getDb(deskHome);
  const allTasks = db.select().from(tasks).all();
  const allBranches = db.select().from(branches).all();
  return allTasks.map((task) => ({
    ...task,
    branches: allBranches.filter((b) => b.taskId === task.id),
  }));
}

export function listRepos(deskHome: string): RepoWithBranches[] {
  const db = getDb(deskHome);
  const allRepos = db.select().from(repos).all();
  const allBranches = db.select().from(branches).all();
  return allRepos.map((repo) => ({
    ...repo,
    branches: allBranches.filter(
      (b) => b.orgName === repo.orgName && b.repoName === repo.repoName,
    ),
  }));
}

export type ListBranchesOptions = {
  /** When true, return only the orphaned (task-less) branches. */
  orphaned?: boolean;
};

/**
 * Returns branches grouped by task. Tasks with no branches are omitted —
 * this is a branch listing, not a task listing. The orphaned group (branches
 * with no `taskId`) is included only when it has members.
 *
 * With `orphaned: true`, returns just the orphaned group (always, even if
 * empty) so callers get a consistent shape.
 */
export function listBranches(
  deskHome: string,
  opts: ListBranchesOptions = {},
): BranchGroup[] {
  const db = getDb(deskHome);
  const allBranches = db.select().from(branches).all();
  const orphaned = allBranches.filter((b) => b.taskId === null);

  if (opts.orphaned) {
    return [{ task: null, branches: orphaned }];
  }

  const allTasks = db.select().from(tasks).all();
  const taskGroups: BranchGroup[] = allTasks
    .map<BranchGroup>((task) => ({
      task,
      branches: allBranches.filter((b) => b.taskId === task.id),
    }))
    .filter((g) => g.branches.length > 0);

  if (orphaned.length === 0) return taskGroups;
  return [...taskGroups, { task: null, branches: orphaned }];
}
