import { afterEach, beforeEach, describe, expect, test } from "bun:test";
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
  getCurrentWorktreeInfo,
  hasUncommittedChanges,
  listRemoteBranches,
  pullRepo,
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
  test("clones to the expected path", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });

    await cloneRepo({ remoteUrl, destPath });

    expect(existsSync(destPath)).toBe(true);
    expect(existsSync(join(destPath, ".git"))).toBe(true);
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

describe("pullRepo", () => {
  test("fetches latest commits from origin", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    await pushCommitToRemote({
      remoteUrl,
      branch: defaultBranch,
      fileName: "NEW.md",
      contents: "new\n",
      message: "add NEW",
    });

    await pullRepo({ repoPath: destPath });

    expect(existsSync(join(destPath, "NEW.md"))).toBe(true);
  });

  test("throws if the working directory has uncommitted changes", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    await writeFile(join(destPath, "README.md"), "modified\n");

    await expect(pullRepo({ repoPath: destPath })).rejects.toThrow(
      /uncommitted changes/,
    );
  });
});

describe("hasUncommittedChanges", () => {
  test("returns true for unstaged changes", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    await writeFile(join(destPath, "README.md"), "dirty\n");

    expect(await hasUncommittedChanges({ repoPath: destPath })).toBe(true);
  });

  test("returns true for staged changes", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    await writeFile(join(destPath, "STAGED.md"), "staged\n");
    await simpleGit(destPath).add("STAGED.md");

    expect(await hasUncommittedChanges({ repoPath: destPath })).toBe(true);
  });

  test("returns false on a clean repo", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();
    const destPath = repoPath({ deskHome, orgName: "org", repoName: "repo" });
    await cloneRepo({ remoteUrl, destPath });

    expect(await hasUncommittedChanges({ repoPath: destPath })).toBe(false);
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
