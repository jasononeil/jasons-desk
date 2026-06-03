import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, migrateDb } from "../model/db.ts";
import { branches, repos, tasks } from "../model/schema.ts";
import { listBranches, listRepos, listTasks } from "./list.ts";

let tmpRoots: string[] = [];

function makeDeskHome(): string {
  const path = mkdtempSync(join(tmpdir(), "desk-home-"));
  tmpRoots.push(path);
  migrateDb(path);
  return path;
}

const ISO = "2026-06-04T00:00:00.000Z";

function seed(deskHome: string) {
  const db = getDb(deskHome);
  db.insert(tasks)
    .values([
      { id: "CA-1", title: "First", status: "InProgress" },
      { id: "CA-2", title: "Second", status: "Backlog" },
      { id: "CA-3", title: "Unbranched", status: "Backlog" },
    ])
    .run();
  db.insert(repos)
    .values([
      {
        orgName: "acme",
        repoName: "alpha",
        defaultBranch: "main",
        lastOpened: ISO,
      },
      {
        orgName: "acme",
        repoName: "beta",
        defaultBranch: "main",
        lastOpened: ISO,
      },
    ])
    .run();
  db.insert(branches)
    .values([
      {
        orgName: "acme",
        repoName: "alpha",
        branchName: "feature/a",
        lastOpened: ISO,
        taskId: "CA-1",
      },
      {
        orgName: "acme",
        repoName: "alpha",
        branchName: "feature/b",
        lastOpened: ISO,
        taskId: "CA-1",
      },
      {
        orgName: "acme",
        repoName: "beta",
        branchName: "fix/x",
        lastOpened: ISO,
        taskId: "CA-2",
      },
      {
        orgName: "acme",
        repoName: "beta",
        branchName: "experiment",
        lastOpened: ISO,
        taskId: null,
      },
    ])
    .run();
}

afterEach(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
  tmpRoots = [];
});

describe("listTasks", () => {
  test("returns tasks with nested branches", () => {
    const deskHome = makeDeskHome();
    seed(deskHome);

    const result = listTasks(deskHome);
    const byId = Object.fromEntries(result.map((t) => [t.id, t]));

    expect(byId["CA-1"]?.branches.map((b) => b.branchName).sort()).toEqual([
      "feature/a",
      "feature/b",
    ]);
    expect(byId["CA-2"]?.branches.map((b) => b.branchName)).toEqual(["fix/x"]);
    expect(byId["CA-3"]?.branches).toEqual([]);
  });

  test("returns an empty array on an empty database", () => {
    const deskHome = makeDeskHome();
    expect(listTasks(deskHome)).toEqual([]);
  });
});

describe("listRepos", () => {
  test("returns repos with nested branches annotated with taskId", () => {
    const deskHome = makeDeskHome();
    seed(deskHome);

    const result = listRepos(deskHome);
    const byRepo = Object.fromEntries(
      result.map((r) => [`${r.orgName}/${r.repoName}`, r]),
    );

    const alphaBranches = byRepo["acme/alpha"]?.branches ?? [];
    expect(alphaBranches.map((b) => b.branchName).sort()).toEqual([
      "feature/a",
      "feature/b",
    ]);
    expect(alphaBranches.every((b) => b.taskId === "CA-1")).toBe(true);

    const betaBranches = byRepo["acme/beta"]?.branches ?? [];
    const betaByName = Object.fromEntries(
      betaBranches.map((b) => [b.branchName, b]),
    );
    expect(betaByName["fix/x"]?.taskId).toBe("CA-2");
    expect(betaByName["experiment"]?.taskId).toBeNull();
  });

  test("returns an empty array on an empty database", () => {
    const deskHome = makeDeskHome();
    expect(listRepos(deskHome)).toEqual([]);
  });
});

describe("listBranches", () => {
  test("groups branches by task and includes an orphaned group", () => {
    const deskHome = makeDeskHome();
    seed(deskHome);

    const result = listBranches(deskHome);
    const groupByKey = (g: { task: { id: string } | null }) =>
      g.task ? g.task.id : "__orphaned__";
    const byKey = Object.fromEntries(result.map((g) => [groupByKey(g), g]));

    expect(byKey["CA-1"]?.branches.map((b) => b.branchName).sort()).toEqual([
      "feature/a",
      "feature/b",
    ]);
    expect(byKey["CA-2"]?.branches.map((b) => b.branchName)).toEqual(["fix/x"]);
    expect(byKey["__orphaned__"]?.branches.map((b) => b.branchName)).toEqual([
      "experiment",
    ]);
    // Tasks with no branches (CA-3) are not included in the branch listing.
    expect(byKey["CA-3"]).toBeUndefined();
  });

  test("orphaned: true returns only branches with no task", () => {
    const deskHome = makeDeskHome();
    seed(deskHome);

    const result = listBranches(deskHome, { orphaned: true });
    expect(result).toHaveLength(1);
    expect(result[0]?.task).toBeNull();
    expect(result[0]?.branches.map((b) => b.branchName)).toEqual([
      "experiment",
    ]);
  });

  test("returns an empty array on an empty database", () => {
    const deskHome = makeDeskHome();
    expect(listBranches(deskHome)).toEqual([]);
  });

  test("orphaned: true on an empty database returns a single empty group", () => {
    const deskHome = makeDeskHome();
    const result = listBranches(deskHome, { orphaned: true });
    expect(result).toEqual([{ task: null, branches: [] }]);
  });
});
