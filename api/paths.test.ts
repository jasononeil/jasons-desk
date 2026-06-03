import { describe, test, expect } from "bun:test";
import {
  parseRepoSlug,
  repoPath,
  sanitizeBranchName,
  worktreePath,
} from "./paths.ts";

describe("sanitizeBranchName", () => {
  test("replaces / with -", () => {
    expect(sanitizeBranchName("feature/my-thing")).toBe("feature-my-thing");
  });

  test("handles multiple slashes", () => {
    expect(sanitizeBranchName("a/b/c")).toBe("a-b-c");
  });

  test("is a no-op for names without slashes", () => {
    expect(sanitizeBranchName("main")).toBe("main");
  });
});

describe("worktreePath", () => {
  test("constructs the correct absolute path with sanitization", () => {
    expect(
      worktreePath({
        deskHome: "/tmp/desk",
        orgName: "org",
        repoName: "repo",
        branchName: "feature/foo",
      }),
    ).toBe("/tmp/desk/worktrees/org/repo/feature-foo");
  });
});

describe("repoPath", () => {
  test("constructs the correct absolute path", () => {
    expect(
      repoPath({
        deskHome: "/tmp/desk",
        orgName: "org",
        repoName: "repo",
      }),
    ).toBe("/tmp/desk/repos/org/repo");
  });
});

describe("parseRepoSlug", () => {
  test("splits org/repo into { orgName, repoName }", () => {
    expect(parseRepoSlug("org/repo")).toEqual({
      orgName: "org",
      repoName: "repo",
    });
  });

  test("throws on a slug with no /", () => {
    expect(() => parseRepoSlug("myrepo")).toThrow(/Invalid repo slug/);
  });

  test("throws on a slug with more than one /", () => {
    expect(() => parseRepoSlug("org/repo/extra")).toThrow(/Invalid repo slug/);
  });
});
