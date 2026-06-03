import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrateDb } from "./db.ts";
import { branches, repos, tasks } from "./schema.ts";

let deskHome: string;

beforeEach(() => {
  deskHome = mkdtempSync(join(tmpdir(), "desk-test-"));
});

afterEach(() => {
  rmSync(deskHome, { recursive: true, force: true });
});

test("migrate + insert/select round-trips rows across all tables", () => {
  const db = migrateDb(deskHome);

  db.insert(tasks)
    .values({ id: "CA-1", title: "Test task" })
    .run();
  db.insert(repos)
    .values({
      orgName: "acme",
      repoName: "widgets",
      defaultBranch: "main",
      lastOpened: "2026-06-04T00:00:00.000Z",
    })
    .run();
  db.insert(branches)
    .values({
      orgName: "acme",
      repoName: "widgets",
      branchName: "feature/x",
      lastOpened: "2026-06-04T00:00:00.000Z",
      taskId: "CA-1",
    })
    .run();

  const task = db.select().from(tasks).where(eq(tasks.id, "CA-1")).get();
  expect(task).toMatchObject({
    id: "CA-1",
    title: "Test task",
    description: "",
    status: "Backlog",
  });

  const repo = db.select().from(repos).get();
  expect(repo).toMatchObject({
    orgName: "acme",
    repoName: "widgets",
    defaultBranch: "main",
  });

  const branch = db.select().from(branches).get();
  expect(branch).toMatchObject({
    orgName: "acme",
    repoName: "widgets",
    branchName: "feature/x",
    taskId: "CA-1",
  });
});

test("branches.taskId foreign key is enforced", () => {
  const db = migrateDb(deskHome);

  db.insert(repos)
    .values({
      orgName: "acme",
      repoName: "widgets",
      defaultBranch: "main",
      lastOpened: "2026-06-04T00:00:00.000Z",
    })
    .run();

  expect(() =>
    db
      .insert(branches)
      .values({
        orgName: "acme",
        repoName: "widgets",
        branchName: "main",
        lastOpened: "2026-06-04T00:00:00.000Z",
        taskId: "does-not-exist",
      })
      .run(),
  ).toThrow();
});
