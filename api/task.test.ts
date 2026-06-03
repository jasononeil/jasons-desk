import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb, migrateDb } from "../model/db.ts";
import { branches, repos, tasks } from "../model/schema.ts";
import { cloneRepo, addWorktree } from "./git.ts";
import { makeBareRepo } from "./git.testutil.ts";
import { repoPath, worktreePath } from "./paths.ts";
import { openTask } from "./task.ts";

let tmpRoots: string[] = [];

function makeDeskHome(): string {
  const path = mkdtempSync(join(tmpdir(), "desk-home-"));
  tmpRoots.push(path);
  migrateDb(path);
  return path;
}

afterEach(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
  tmpRoots = [];
});

describe("openTask", () => {
  test("creating a new task sets status to InProgress", async () => {
    const deskHome = makeDeskHome();
    await openTask({ deskHome, taskId: "CA-1234" });

    const row = getDb(deskHome)
      .select()
      .from(tasks)
      .where(eq(tasks.id, "CA-1234"))
      .get();
    expect(row).toMatchObject({
      id: "CA-1234",
      title: "",
      description: "",
      status: "InProgress",
    });
  });

  test("opening an existing Backlog task transitions it to InProgress", async () => {
    const deskHome = makeDeskHome();
    getDb(deskHome)
      .insert(tasks)
      .values({ id: "CA-1", status: "Backlog" })
      .run();

    await openTask({ deskHome, taskId: "CA-1" });

    const row = getDb(deskHome)
      .select()
      .from(tasks)
      .where(eq(tasks.id, "CA-1"))
      .get();
    expect(row?.status).toBe("InProgress");
  });

  test("opening an already InProgress task is a no-op on status", async () => {
    const deskHome = makeDeskHome();
    getDb(deskHome)
      .insert(tasks)
      .values({ id: "CA-1", status: "InProgress" })
      .run();

    await openTask({ deskHome, taskId: "CA-1" });

    const row = getDb(deskHome)
      .select()
      .from(tasks)
      .where(eq(tasks.id, "CA-1"))
      .get();
    expect(row?.status).toBe("InProgress");
  });

  test("opening a task in a non-Backlog terminal status does not change status", async () => {
    const deskHome = makeDeskHome();
    getDb(deskHome)
      .insert(tasks)
      .values({ id: "CA-1", status: "Done" })
      .run();

    await openTask({ deskHome, taskId: "CA-1" });

    const row = getDb(deskHome)
      .select()
      .from(tasks)
      .where(eq(tasks.id, "CA-1"))
      .get();
    expect(row?.status).toBe("Done");
  });

  test("title updates the task's title", async () => {
    const deskHome = makeDeskHome();
    await openTask({ deskHome, taskId: "CA-1", title: "Fix the thing" });

    const row = getDb(deskHome)
      .select()
      .from(tasks)
      .where(eq(tasks.id, "CA-1"))
      .get();
    expect(row?.title).toBe("Fix the thing");

    await openTask({ deskHome, taskId: "CA-1", title: "Updated title" });
    const row2 = getDb(deskHome)
      .select()
      .from(tasks)
      .where(eq(tasks.id, "CA-1"))
      .get();
    expect(row2?.title).toBe("Updated title");
  });

  test("description updates the task's description", async () => {
    const deskHome = makeDeskHome();
    await openTask({
      deskHome,
      taskId: "CA-1",
      description: "Some details",
    });

    const row = getDb(deskHome)
      .select()
      .from(tasks)
      .where(eq(tasks.id, "CA-1"))
      .get();
    expect(row?.description).toBe("Some details");
  });

  test("status sets the task to any valid Status value", async () => {
    const deskHome = makeDeskHome();
    const allStatuses = [
      "Backlog",
      "InProgress",
      "InReview",
      "Blocked",
      "Done",
      "Abandoned",
    ] as const;

    for (const status of allStatuses) {
      await openTask({ deskHome, taskId: "CA-1", status });
      const row = getDb(deskHome)
        .select()
        .from(tasks)
        .where(eq(tasks.id, "CA-1"))
        .get();
      expect(row?.status).toBe(status);
    }
  });

  test("status with an invalid value throws and does not write", async () => {
    const deskHome = makeDeskHome();

    await expect(
      openTask({ deskHome, taskId: "CA-1", status: "Bogus" }),
    ).rejects.toThrow(/Invalid status/);

    const row = getDb(deskHome)
      .select()
      .from(tasks)
      .where(eq(tasks.id, "CA-1"))
      .get();
    expect(row).toBeUndefined();
  });

  test("taskId is required — omitting it throws", async () => {
    const deskHome = makeDeskHome();
    await expect(
      openTask({ deskHome, taskId: "" }),
    ).rejects.toThrow(/taskId is required/);
  });

  test("thisBranch links the current branch to the task", async () => {
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

    const db = getDb(deskHome);
    db.insert(repos)
      .values({
        orgName: "org",
        repoName: "repo",
        defaultBranch,
        lastOpened: "2026-06-04T00:00:00.000Z",
      })
      .run();
    db.insert(branches)
      .values({
        orgName: "org",
        repoName: "repo",
        branchName: "feature/foo",
        lastOpened: "2026-06-04T00:00:00.000Z",
      })
      .run();

    await openTask({
      deskHome,
      taskId: "CA-1",
      thisBranch: true,
      cwd: wt,
    });

    const branch = db
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
    expect(branch?.taskId).toBe("CA-1");
  });

  test("thisBranch outside a managed worktree throws", async () => {
    const deskHome = makeDeskHome();
    const elsewhere = mkdtempSync(join(tmpdir(), "desk-test-other-"));
    tmpRoots.push(elsewhere);

    await expect(
      openTask({
        deskHome,
        taskId: "CA-1",
        thisBranch: true,
        cwd: elsewhere,
      }),
    ).rejects.toThrow(/desk-managed worktree/);
  });

  test("thisBranch with no matching branch row throws", async () => {
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

    await expect(
      openTask({
        deskHome,
        taskId: "CA-1",
        thisBranch: true,
        cwd: wt,
      }),
    ).rejects.toThrow(/No branch row/);
  });

  test("returns the resulting task", async () => {
    const deskHome = makeDeskHome();
    const task = await openTask({
      deskHome,
      taskId: "CA-1",
      title: "Hello",
    });
    expect(task).toMatchObject({
      id: "CA-1",
      title: "Hello",
      status: "InProgress",
    });
  });
});
