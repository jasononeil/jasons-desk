import { join } from "node:path";

export function sanitizeBranchName(branchName: string): string {
  return branchName.replaceAll("/", "-");
}

export function repoPath(args: {
  deskHome: string;
  orgName: string;
  repoName: string;
}): string {
  return join(args.deskHome, "repos", args.orgName, args.repoName);
}

export function worktreePath(args: {
  deskHome: string;
  orgName: string;
  repoName: string;
  branchName: string;
}): string {
  return join(
    args.deskHome,
    "worktrees",
    args.orgName,
    args.repoName,
    sanitizeBranchName(args.branchName),
  );
}

export function parseRepoSlug(slug: string): {
  orgName: string;
  repoName: string;
} {
  const parts = slug.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid repo slug "${slug}": expected format "orgName/repoName"`,
    );
  }
  return { orgName: parts[0], repoName: parts[1] };
}
