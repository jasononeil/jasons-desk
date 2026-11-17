import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import {
  addWorktree,
  cloneRepo,
  detectDefaultBranch,
  fetchRepo,
  getCurrentWorktreeInfo,
  listRemoteBranches,
  worktreeExists,
} from "./git.ts";
import { repoPath, worktreePath } from "./paths.ts";
import { makeBareRepo, pushCommitToRemote } from "./git.testutil.ts";

let tmpRoots: string[] = [];

function makeDeskHome(): string {
  const path = mkdtempSync(join(tmpdir(), "desk-home-"));
  tmpRoots.push(path);
  return path;
}

afterEach(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
  tmpRoots = [];
});

describe("cloneRepo", () => {
  test("clones as a bare repo at the expected path", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });

    await cloneRepo({ remoteUrl, destPath });

    // Bare repo: contents live directly at destPath (HEAD, refs/, objects/)
    // rather than under a .git subdir.
    expect(existsSync(destPath)).toBe(true);
    expect(existsSync(join(destPath, "HEAD"))).toBe(true);
    expect(existsSync(join(destPath, ".git"))).toBe(false);
  });

  test("throws a descriptive error on a non-existent repo", async () => {
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    const bogusUrl = join(deskHome, "does-not-exist.git");

    await expect(
      cloneRepo({ remoteUrl: bogusUrl, destPath }),
    ).rejects.toThrow(/Failed to clone/);
  });
});

describe("detectDefaultBranch", () => {
  test("returns 'main' when HEAD points to main", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo({ defaultBranch: "main" });
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    expect(await detectDefaultBranch({ repoPath: destPath })).toBe("main");
  });

  test("returns 'master' when HEAD points to master", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo({
      defaultBranch: "master",
    });
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    expect(await detectDefaultBranch({ repoPath: destPath })).toBe("master");
  });
});

describe("fetchRepo", () => {
  test("updates origin tracking refs with new commits from the remote", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    const beforeSha = (
      await simpleGit(destPath).raw([
        "rev-parse",
        `refs/remotes/origin/${defaultBranch}`,
      ])
    ).trim();

    await pushCommitToRemote({
      remoteUrl,
      branch: defaultBranch,
      fileName: "NEW.md",
      contents: "new\n",
      message: "add NEW",
    });

    await fetchRepo({ repoPath: destPath });

    const afterSha = (
      await simpleGit(destPath).raw([
        "rev-parse",
        `refs/remotes/origin/${defaultBranch}`,
      ])
    ).trim();
    expect(afterSha).not.toBe(beforeSha);
  });
});

describe("addWorktree", () => {
  test("creates the worktree directory at the expected path", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    const wt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: "topic",
    });
    await addWorktree({
      repoPath: destPath,
      worktreePath: wt,
      branchName: "topic",
      defaultBranch,
    });

    expect(existsSync(wt)).toBe(true);
    expect(existsSync(join(wt, ".git"))).toBe(true);
    expect(existsSync(join(wt, "README.md"))).toBe(true);
  });

  test("with a branch containing / sanitizes the path", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    const wt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: "feature/my-thing",
    });
    await addWorktree({
      repoPath: destPath,
      worktreePath: wt,
      branchName: "feature/my-thing",
      defaultBranch,
    });

    expect(wt.endsWith("/feature-my-thing")).toBe(true);
    expect(existsSync(wt)).toBe(true);
    // The nested path "feature/my-thing" should NOT have been created.
    expect(
      existsSync(
        worktreePath({
          deskHome,
          orgName: "org",
          repoName: "repo",
          branchName: "feature",
        }) + "/my-thing",
      ),
    ).toBe(false);
  });

  test("checks out an existing remote branch rather than creating a new one", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    // Push a branch with a unique file directly to the remote, then clone.
    const seedPath = mkdtempSync(join(tmpdir(), "desk-test-seed-"));
    tmpRoots.push(seedPath);
    const seed = simpleGit(seedPath);
    await seed.clone(remoteUrl, seedPath);
    await seed.addConfig("user.email", "test@example.com");
    await seed.addConfig("user.name", "Test");
    await seed.checkoutBranch("existing-branch", defaultBranch);
    await writeFile(join(seedPath, "ONLY-ON-BRANCH.md"), "hi\n");
    await seed.add("ONLY-ON-BRANCH.md");
    await seed.commit("on branch");
    await seed.push("origin", "existing-branch");

    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    const wt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: "existing-branch",
    });
    await addWorktree({
      repoPath: destPath,
      worktreePath: wt,
      branchName: "existing-branch",
      defaultBranch,
    });

    expect(existsSync(join(wt, "ONLY-ON-BRANCH.md"))).toBe(true);
  });

  test("checks out the default branch in a worktree", async () => {
    // Regression: when the base is non-bare and has the default branch
    // checked out, `git worktree add main main` fails. The base must be bare.
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    const wt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: defaultBranch,
    });
    await addWorktree({
      repoPath: destPath,
      worktreePath: wt,
      branchName: defaultBranch,
      defaultBranch,
    });

    expect(existsSync(join(wt, "README.md"))).toBe(true);
    const head = (
      await simpleGit(wt).raw(["branch", "--show-current"])
    ).trim();
    expect(head).toBe(defaultBranch);
  });

  test("checks out a branch that exists only on origin after a fetch", async () => {
    // After the initial bare clone, refs/heads/* mirrors what was on the
    // remote at clone time. If a new branch is pushed to origin *after*
    // we clone, only `refs/remotes/origin/<branch>` exists locally — and
    // `git worktree add` must DWIM from it.
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    // Push a brand-new branch directly to the remote (the helper can't,
    // since it tries to check out a branch that doesn't exist yet).
    const seedPath = mkdtempSync(join(tmpdir(), "desk-test-seed-"));
    tmpRoots.push(seedPath);
    const seed = simpleGit(seedPath);
    await seed.clone(remoteUrl, seedPath);
    await seed.addConfig("user.email", "test@example.com");
    await seed.addConfig("user.name", "Test");
    await seed.checkoutBranch("remote-only", defaultBranch);
    await writeFile(join(seedPath, "REMOTE-ONLY.md"), "remote only\n");
    await seed.add("REMOTE-ONLY.md");
    await seed.commit("remote-only branch");
    await seed.push("origin", "remote-only");

    await fetchRepo({ repoPath: destPath });

    const wt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: "remote-only",
    });
    await addWorktree({
      repoPath: destPath,
      worktreePath: wt,
      branchName: "remote-only",
      defaultBranch,
    });

    expect(existsSync(join(wt, "REMOTE-ONLY.md"))).toBe(true);
    const head = (
      await simpleGit(wt).raw(["branch", "--show-current"])
    ).trim();
    expect(head).toBe("remote-only");
  });

  test("creates a non-existent branch from the default branch", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    const wt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: "brand-new",
    });
    await addWorktree({
      repoPath: destPath,
      worktreePath: wt,
      branchName: "brand-new",
      defaultBranch,
    });

    const head = (
      await simpleGit(wt).raw(["branch", "--show-current"])
    ).trim();
    expect(head).toBe("brand-new");
    // Contents should match default branch (README.md present, no extra).
    expect(existsSync(join(wt, "README.md"))).toBe(true);
  });

  test("creates a new branch from the latest fetched default branch", async () => {
    // Regression: the local refs/heads/<default> is frozen at clone time, so
    // new branches must be based on origin/<default> to pick up fetches.
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    await pushCommitToRemote({
      remoteUrl,
      branch: defaultBranch,
      fileName: "AFTER-CLONE.md",
      contents: "new\n",
      message: "add AFTER-CLONE",
    });
    await fetchRepo({ repoPath: destPath });

    const wt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: "fresh",
    });
    await addWorktree({
      repoPath: destPath,
      worktreePath: wt,
      branchName: "fresh",
      defaultBranch,
    });

    expect(existsSync(join(wt, "AFTER-CLONE.md"))).toBe(true);
  });
});

describe("worktreeExists", () => {
  test("returns true when the path is already set up", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    const wt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: "topic",
    });
    await addWorktree({
      repoPath: destPath,
      worktreePath: wt,
      branchName: "topic",
      defaultBranch,
    });

    expect(await worktreeExists({ worktreePath: wt })).toBe(true);
  });

  test("returns false when no worktree has been created yet", async () => {
    const deskHome = makeDeskHome();
    const wt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: "topic",
    });
    expect(await worktreeExists({ worktreePath: wt })).toBe(false);
  });

  test("returns false for a plain clone (no worktree marker)", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    expect(await worktreeExists({ worktreePath: destPath })).toBe(false);
  });
});

describe("listRemoteBranches", () => {
  test("returns all remote branch names", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);

    // Create two extra branches on the remote.
    const seedPath = mkdtempSync(join(tmpdir(), "desk-test-seed-"));
    tmpRoots.push(seedPath);
    const seed = simpleGit(seedPath);
    await seed.clone(remoteUrl, seedPath);
    await seed.addConfig("user.email", "test@example.com");
    await seed.addConfig("user.name", "Test");
    for (const name of ["feature-a", "feature-b"]) {
      await seed.checkoutBranch(name, defaultBranch);
      await writeFile(join(seedPath, `${name}.md`), name);
      await seed.add(`${name}.md`);
      await seed.commit(name);
      await seed.push("origin", name);
    }

    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    const branches = await listRemoteBranches({ repoPath: destPath });
    expect(branches.sort()).toEqual(
      [defaultBranch, "feature-a", "feature-b"].sort(),
    );
  });
});

describe("getCurrentWorktreeInfo", () => {
  test("returns null when not inside a desk-managed worktree", async () => {
    const deskHome = makeDeskHome();
    const elsewhere = mkdtempSync(join(tmpdir(), "desk-test-other-"));
    tmpRoots.push(elsewhere);
    expect(
      await getCurrentWorktreeInfo({ deskHome, cwd: elsewhere }),
    ).toBeNull();
  });

  test("returns { orgName, repoName, branchName } from inside a worktree", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });
    const wt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: "feature/foo",
    });
    await addWorktree({
      repoPath: destPath,
      worktreePath: wt,
      branchName: "feature/foo",
      defaultBranch,
    });

    expect(await getCurrentWorktreeInfo({ deskHome, cwd: wt })).toEqual({
      orgName: "org",
      repoName: "repo",
      branchName: "feature/foo",
    });
  });

  test("returns info from a subdirectory inside a worktree", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });
    const wt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: "topic",
    });
    await addWorktree({
      repoPath: destPath,
      worktreePath: wt,
      branchName: "topic",
      defaultBranch,
    });
    const sub = join(wt, "src");
    await mkdir(sub, { recursive: true });

    expect(await getCurrentWorktreeInfo({ deskHome, cwd: sub })).toEqual({
      orgName: "org",
      repoName: "repo",
      branchName: "topic",
    });
  });
});
