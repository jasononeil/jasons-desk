import { existsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { getDb } from "../model/db.ts";
import { branches, repos, tasks } from "../model/schema.ts";
import {
  addWorktree,
  cloneRepo,
  detectDefaultBranch,
  fetchRepo,
  getCurrentWorktreeInfo,
  type GitProgressEvent,
  worktreeExists,
} from "./git.ts";
import { parseRepoSlug, repoPath, worktreePath } from "./paths.ts";

export type ProgressEvent =
  | { kind: "step-start"; label: string }
  | { kind: "step-done"; label: string }
  | { kind: "notice"; message: string }
  | ({ kind: "git" } & GitProgressEvent);

export type ProgressCallback = (event: ProgressEvent) => void;

export type OpenOptions = {
  deskHome: string;
  repoSlug: string;
  branchName: string;
  taskId?: string;
  /** Overrides the remote URL. Defaults to `git@github.com:org/repo.git`. */
  remoteUrl?: string;
  /** Used to detect whether we're leaving an existing worktree. */
  cwd?: string;
  /** Receives live progress events; notices are also returned in the result. */
  onProgress?: ProgressCallback;
};

export type OpenResult = {
  worktreePath: string;
  notices: string[];
};

function defaultRemoteUrl(orgName: string, repoName: string): string {
  return `git@github.com:${orgName}/${repoName}.git`;
}

/**
 * Clone or refresh the base repo, set up (or reuse) a worktree for
 * `branchName`, and record the activity in the database. Returns the worktree
 * path the caller should `cd` into, plus any user-facing notices.
 */
export async function open(opts: OpenOptions): Promise<OpenResult> {
  const { orgName, repoName } = parseRepoSlug(opts.repoSlug);
  const notices: string[] = [];
  const slug = `${orgName}/${repoName}`;

  const notify = (message: string) => {
    notices.push(message);
    opts.onProgress?.({ kind: "notice", message });
  };
  const stepStart = (label: string) =>
    opts.onProgress?.({ kind: "step-start", label });
  const stepDone = (label: string) =>
    opts.onProgress?.({ kind: "step-done", label });
  const forwardGit = opts.onProgress
    ? (e: GitProgressEvent) => opts.onProgress!({ kind: "git", ...e })
    : undefined;

  const cwd = opts.cwd ?? process.cwd();
  const currentInfo = await getCurrentWorktreeInfo({
    deskHome: opts.deskHome,
    cwd,
  });
  if (currentInfo) {
    notify(
      `Leaving worktree ${currentInfo.orgName}/${currentInfo.repoName}/${currentInfo.branchName}`,
    );
  }

  const basePath = repoPath({ deskHome: opts.deskHome, orgName, repoName });
  const remoteUrl = opts.remoteUrl ?? defaultRemoteUrl(orgName, repoName);

  if (!existsSync(basePath)) {
    stepStart(`Cloning ${slug}`);
    await cloneRepo({
      remoteUrl,
      destPath: basePath,
      onProgress: forwardGit,
    });
    stepDone(`Cloned ${slug}`);
  } else {
    stepStart(`Fetching ${slug}`);
    await fetchRepo({ repoPath: basePath, onProgress: forwardGit });
    stepDone(`Fetched ${slug}`);
  }
  const defaultBranch = await detectDefaultBranch({ repoPath: basePath });

  const wt = worktreePath({
    deskHome: opts.deskHome,
    orgName,
    repoName,
    branchName: opts.branchName,
  });

  // The worktree path is deterministic per (org, repo, branch), so "branch
  // already checked out in another worktree" collapses into the same check:
  // if the path exists, we just reuse it.
  if (await worktreeExists({ worktreePath: wt })) {
    notify(
      `Worktree already exists, opening existing: ${slug}/${opts.branchName}`,
    );
  } else {
    stepStart(`Setting up worktree ${opts.branchName}`);
    await addWorktree({
      repoPath: basePath,
      worktreePath: wt,
      branchName: opts.branchName,
      defaultBranch,
    });
    stepDone(`Worktree ready: ${opts.branchName}`);
  }

  const db = getDb(opts.deskHome);
  const now = new Date().toISOString();

  const repoWhere = and(
    eq(repos.orgName, orgName),
    eq(repos.repoName, repoName),
  );
  const existingRepo = db.select().from(repos).where(repoWhere).get();
  if (existingRepo) {
    db.update(repos)
      .set({ lastOpened: now, defaultBranch })
      .where(repoWhere)
      .run();
  } else {
    db.insert(repos)
      .values({ orgName, repoName, defaultBranch, lastOpened: now })
      .run();
  }

  if (opts.taskId) {
    const existingTask = db
      .select()
      .from(tasks)
      .where(eq(tasks.id, opts.taskId))
      .get();
    if (!existingTask) {
      db.insert(tasks)
        .values({
          id: opts.taskId,
          title: "",
          description: "",
          status: "Backlog",
        })
        .run();
    }
  }

  const branchWhere = and(
    eq(branches.orgName, orgName),
    eq(branches.repoName, repoName),
    eq(branches.branchName, opts.branchName),
  );
  const existingBranch = db.select().from(branches).where(branchWhere).get();
  if (existingBranch) {
    const update: Partial<typeof branches.$inferInsert> = { lastOpened: now };
    if (opts.taskId) update.taskId = opts.taskId;
    db.update(branches).set(update).where(branchWhere).run();
  } else {
    db.insert(branches)
      .values({
        orgName,
        repoName,
        branchName: opts.branchName,
        lastOpened: now,
        taskId: opts.taskId ?? null,
      })
      .run();
  }

  return { worktreePath: wt, notices };
}
