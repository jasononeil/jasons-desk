import { existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, relative, sep } from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";

/**
 * Clone a remote into `destPath`. Creates parent directories as needed.
 * Throws a descriptive error if the clone fails (e.g. repo doesn't exist).
 */
export async function cloneRepo(args: {
  remoteUrl: string;
  destPath: string;
}): Promise<void> {
  await mkdir(dirname(args.destPath), { recursive: true });
  try {
    await simpleGit().clone(args.remoteUrl, args.destPath);
  } catch (err) {
    throw new Error(
      `Failed to clone ${args.remoteUrl} into ${args.destPath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/**
 * Pull the latest commits in `repoPath`. Throws if the working tree has
 * uncommitted changes.
 */
export async function pullRepo(args: { repoPath: string }): Promise<void> {
  if (await hasUncommittedChanges({ repoPath: args.repoPath })) {
    throw new Error(
      `Cannot pull: ${args.repoPath} has uncommitted changes`,
    );
  }
  await simpleGit(args.repoPath).pull();
}

/** True if the working tree at `repoPath` has staged or unstaged changes. */
export async function hasUncommittedChanges(args: {
  repoPath: string;
}): Promise<boolean> {
  const status = await simpleGit(args.repoPath).status();
  return !status.isClean();
}

/**
 * Detect the default branch of the repo at `repoPath` by inspecting the
 * symbolic ref of `origin/HEAD`.
 */
export async function detectDefaultBranch(args: {
  repoPath: string;
}): Promise<string> {
  const out = await simpleGit(args.repoPath).raw([
    "ls-remote",
    "--symref",
    "origin",
    "HEAD",
  ]);
  const match = out.match(/^ref:\s+refs\/heads\/(\S+)\s+HEAD/m);
  if (!match) {
    throw new Error(
      `Could not detect default branch from origin in ${args.repoPath}`,
    );
  }
  return match[1]!;
}

/**
 * Create a worktree at `worktreePath` for `branchName`. If the branch
 * already exists locally or on the remote, it is checked out. Otherwise
 * a new branch is created from `defaultBranch`.
 */
export async function addWorktree(args: {
  repoPath: string;
  worktreePath: string;
  branchName: string;
  defaultBranch: string;
}): Promise<void> {
  await mkdir(dirname(args.worktreePath), { recursive: true });
  const git = simpleGit(args.repoPath);
  if (await branchExistsAnywhere(git, args.branchName)) {
    await git.raw(["worktree", "add", args.worktreePath, args.branchName]);
  } else {
    await git.raw([
      "worktree",
      "add",
      "-b",
      args.branchName,
      args.worktreePath,
      args.defaultBranch,
    ]);
  }
}

async function branchExistsAnywhere(
  git: SimpleGit,
  branchName: string,
): Promise<boolean> {
  const out = await git.raw([
    "for-each-ref",
    "--format=%(refname)",
    `refs/heads/${branchName}`,
    `refs/remotes/origin/${branchName}`,
  ]);
  return out.trim().length > 0;
}

/** True if `worktreePath` is already set up as a git worktree. */
export async function worktreeExists(args: {
  worktreePath: string;
}): Promise<boolean> {
  // A worktree's root contains a `.git` *file* pointing at the main repo;
  // a regular clone has `.git` as a directory. Require the file form so we
  // don't mistake a clone for a worktree.
  const dotGit = `${args.worktreePath}/.git`;
  if (!existsSync(dotGit)) return false;
  return statSync(dotGit).isFile();
}

/**
 * List all branches on `origin` for the repo at `repoPath`. Returns branch
 * names without the `refs/heads/` prefix.
 */
export async function listRemoteBranches(args: {
  repoPath: string;
}): Promise<string[]> {
  const out = await simpleGit(args.repoPath).raw([
    "ls-remote",
    "--heads",
    "origin",
  ]);
  const branches: string[] = [];
  for (const line of out.split("\n")) {
    const match = line.match(/^\S+\s+refs\/heads\/(.+)$/);
    if (match) branches.push(match[1]!);
  }
  return branches;
}

/**
 * If `cwd` is inside a desk-managed worktree, returns the parsed components
 * (with the branch name resolved via git, since the on-disk name is sanitized).
 * Returns `null` otherwise.
 */
export async function getCurrentWorktreeInfo(args: {
  deskHome: string;
  cwd: string;
}): Promise<
  { orgName: string; repoName: string; branchName: string } | null
> {
  const worktreesRoot = `${args.deskHome}${sep}worktrees`;
  const rel = relative(worktreesRoot, args.cwd);
  if (rel.startsWith("..") || rel === "" || rel.startsWith(sep)) {
    return null;
  }
  const parts = rel.split(sep);
  if (parts.length < 3) return null;
  const [orgName, repoName] = parts;
  if (!orgName || !repoName) return null;
  const worktreeRoot = `${worktreesRoot}${sep}${orgName}${sep}${repoName}${sep}${parts[2]}`;
  if (!(await worktreeExists({ worktreePath: worktreeRoot }))) return null;
  const branchName = (
    await simpleGit(worktreeRoot).raw(["branch", "--show-current"])
  ).trim();
  if (!branchName) return null;
  return { orgName, repoName, branchName };
}
