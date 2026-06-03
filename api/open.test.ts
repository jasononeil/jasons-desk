import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb } from "../model/db.ts";
import { branches, repos, tasks } from "../model/schema.ts";
import { makeBareRepo, pushCommitToRemote } from "./git.testutil.ts";
import { open } from "./open.ts";
import { worktreePath } from "./paths.ts";

let tmpRoots: string[] = [];

function makeDeskHome(): string {
  const path = mkdtempSync(join(tmpdir(), "desk-home-"));
  tmpRoots.push(path);
  getDb(path);
  return path;
}

afterEach(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
  tmpRoots = [];
});

describe("open", () => {
  test("full happy path: new repo, new branch", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();

    const result = await open({
      deskHome,
      repoSlug: "org/repo",
      branchName: "feature/foo",
      remoteUrl,
      cwd: tmpRoot,
    });

    const expectedWt = worktreePath({
      deskHome,
      orgName: "org",
      repoName: "repo",
      branchName: "feature/foo",
    });
    expect(result.worktreePath).toBe(expectedWt);
    expect(existsSync(expectedWt)).toBe(true);
    expect(existsSync(join(expectedWt, "README.md"))).toBe(true);

    const db = getDb(deskHome);
    const repoRow = db
      .select()
      .from(repos)
      .where(and(eq(repos.orgName, "org"), eq(repos.repoName, "repo")))
      .get();
    expect(repoRow).toMatchObject({
      orgName: "org",
      repoName: "repo",
      defaultBranch,
    });
    expect(repoRow?.lastOpened).toBeTruthy();

    const branchRow = db
      .select()
      .from(branches)
      .where(
        and(
          eq(branches.orgName, "org"),
          eq(branches.repoName, "repo"),
          eq(branches.branchName, "feature/foo"),
        ),
      )
      .get();
    expect(branchRow).toMatchObject({
      orgName: "org",
      repoName: "repo",
      branchName: "feature/foo",
      taskId: null,
    });
  });

  test("re-opening an existing worktree returns the same path and updates lastOpened", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();

    const first = await open({
      deskHome,
      repoSlug: "org/repo",
      branchName: "topic",
      remoteUrl,
      cwd: tmpRoot,
    });

    const db = getDb(deskHome);
    const initialRepo = db
      .select()
      .from(repos)
      .where(and(eq(repos.orgName, "org"), eq(repos.repoName, "repo")))
      .get();
    const initialBranch = db
      .select()
      .from(branches)
      .where(
        and(
          eq(branches.orgName, "org"),
          eq(branches.repoName, "repo"),
          eq(branches.branchName, "topic"),
        ),
      )
      .get();

    // Wait a tiny bit so the lastOpened timestamps will differ.
    await new Promise((r) => setTimeout(r, 10));

    const second = await open({
      deskHome,
      repoSlug: "org/repo",
      branchName: "topic",
      remoteUrl,
      cwd: tmpRoot,
    });

    expect(second.worktreePath).toBe(first.worktreePath);
    expect(
      second.notices.some((n) => n.includes("Worktree already exists")),
    ).toBe(true);

    const updatedRepo = db
      .select()
      .from(repos)
      .where(and(eq(repos.orgName, "org"), eq(repos.repoName, "repo")))
      .get();
    const updatedBranch = db
      .select()
      .from(branches)
      .where(
        and(
          eq(branches.orgName, "org"),
          eq(branches.repoName, "repo"),
          eq(branches.branchName, "topic"),
        ),
      )
      .get();
    expect(updatedRepo!.lastOpened > initialRepo!.lastOpened).toBe(true);
    expect(updatedBranch!.lastOpened > initialBranch!.lastOpened).toBe(true);
  });

  test("--task flag links the branch to the task", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();

    await open({
      deskHome,
      repoSlug: "org/repo",
      branchName: "topic",
      taskId: "CA-1234",
      remoteUrl,
      cwd: tmpRoot,
    });

    const db = getDb(deskHome);
    const branchRow = db
      .select()
      .from(branches)
      .where(
        and(
          eq(branches.orgName, "org"),
          eq(branches.repoName, "repo"),
          eq(branches.branchName, "topic"),
        ),
      )
      .get();
    expect(branchRow?.taskId).toBe("CA-1234");
  });

  test("--task flag creates the task with Backlog status if it does not exist", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();

    await open({
      deskHome,
      repoSlug: "org/repo",
      branchName: "topic",
      taskId: "CA-NEW",
      remoteUrl,
      cwd: tmpRoot,
    });

    const taskRow = getDb(deskHome)
      .select()
      .from(tasks)
      .where(eq(tasks.id, "CA-NEW"))
      .get();
    expect(taskRow).toMatchObject({
      id: "CA-NEW",
      status: "Backlog",
    });
  });

  test("--task flag does not overwrite an existing task's status", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();

    getDb(deskHome)
      .insert(tasks)
      .values({ id: "CA-OLD", status: "InProgress", title: "T" })
      .run();

    await open({
      deskHome,
      repoSlug: "org/repo",
      branchName: "topic",
      taskId: "CA-OLD",
      remoteUrl,
      cwd: tmpRoot,
    });

    const taskRow = getDb(deskHome)
      .select()
      .from(tasks)
      .where(eq(tasks.id, "CA-OLD"))
      .get();
    expect(taskRow).toMatchObject({
      id: "CA-OLD",
      title: "T",
      status: "InProgress",
    });
  });

  test("prints 'Leaving worktree' notice when called from inside a worktree", async () => {
    const { remoteUrl, tmpRoot } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();

    const first = await open({
      deskHome,
      repoSlug: "org/repo",
      branchName: "feature/foo",
      remoteUrl,
      cwd: tmpRoot,
    });

    const second = await open({
      deskHome,
      repoSlug: "org/repo",
      branchName: "feature/bar",
      remoteUrl,
      cwd: first.worktreePath,
    });

    expect(
      second.notices.some(
        (n) => n.includes("Leaving worktree") && n.includes("feature/foo"),
      ),
    ).toBe(true);
  });

  test("opens the default branch into a worktree", async () => {
    // Regression: the most common case — opening the default branch — used
    // to fail because the base clone had it checked out.
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);
    const deskHome = makeDeskHome();

    const result = await open({
      deskHome,
      repoSlug: "org/repo",
      branchName: defaultBranch,
      remoteUrl,
      cwd: tmpRoot,
    });

    expect(existsSync(join(result.worktreePath, "README.md"))).toBe(true);
  });

  test("non-existent branch is created from the default branch", async () => {
    const { remoteUrl, tmpRoot, defaultBranch } = await makeBareRepo();
    tmpRoots.push(tmpRoot);

    // Push a commit on the default branch so we can verify the new branch
    // starts from its tip.
    await pushCommitToRemote({
      remoteUrl,
      branch: defaultBranch,
      fileName: "ON-DEFAULT.md",
      contents: "default\n",
      message: "add on-default",
    });

    const deskHome = makeDeskHome();

    const result = await open({
      deskHome,
      repoSlug: "org/repo",
      branchName: "brand-new",
      remoteUrl,
      cwd: tmpRoot,
    });

    expect(existsSync(join(result.worktreePath, "README.md"))).toBe(true);
    expect(existsSync(join(result.worktreePath, "ON-DEFAULT.md"))).toBe(true);
  });

  test("two repos with same repoName but different orgName are stored at distinct paths", async () => {
    const a = await makeBareRepo();
    tmpRoots.push(a.tmpRoot);
    const b = await makeBareRepo();
    tmpRoots.push(b.tmpRoot);
    const deskHome = makeDeskHome();

    const resA = await open({
      deskHome,
      repoSlug: "acme/myapp",
      branchName: "topic",
      remoteUrl: a.remoteUrl,
      cwd: a.tmpRoot,
    });
    const resB = await open({
      deskHome,
      repoSlug: "other/myapp",
      branchName: "topic",
      remoteUrl: b.remoteUrl,
      cwd: b.tmpRoot,
    });

    expect(resA.worktreePath).not.toBe(resB.worktreePath);
    expect(existsSync(resA.worktreePath)).toBe(true);
    expect(existsSync(resB.worktreePath)).toBe(true);

    const db = getDb(deskHome);
    const allRepos = db.select().from(repos).all();
    expect(allRepos.length).toBe(2);
  });
});
