import { mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";

/**
 * Creates an isolated temp directory and a bare git repo with a single
 * commit on the given default branch. Returns the URL git can clone from
 * (the bare repo's filesystem path) plus the temp root for cleanup.
 */
export async function makeBareRepo(opts?: {
  defaultBranch?: string;
}): Promise<{ remoteUrl: string; tmpRoot: string; defaultBranch: string }> {
  const defaultBranch = opts?.defaultBranch ?? "main";
  const tmpRoot = mkdtempSync(join(tmpdir(), "desk-test-"));
  const barePath = join(tmpRoot, "remote.git");
  const seedPath = join(tmpRoot, "seed");

  await mkdir(barePath, { recursive: true });
  await simpleGit().raw(["init", "--bare", "-b", defaultBranch, barePath]);

  await mkdir(seedPath, { recursive: true });
  const seed = simpleGit(seedPath);
  await seed.init(["-b", defaultBranch]);
  await seed.addConfig("user.email", "test@example.com");
  await seed.addConfig("user.name", "Test");
  await writeFile(join(seedPath, "README.md"), "seed\n");
  await seed.add("README.md");
  await seed.commit("initial");
  await seed.addRemote("origin", barePath);
  await seed.push("origin", defaultBranch);

  return { remoteUrl: barePath, tmpRoot, defaultBranch };
}

/**
 * Push a new commit to the given bare repo on the given branch. Used to
 * verify `fetchRepo` picks up remote changes.
 */
export async function pushCommitToRemote(args: {
  remoteUrl: string;
  branch: string;
  fileName: string;
  contents: string;
  message: string;
}): Promise<void> {
  const workPath = mkdtempSync(join(tmpdir(), "desk-test-push-"));
  const work = simpleGit(workPath);
  await work.clone(args.remoteUrl, workPath);
  await work.addConfig("user.email", "test@example.com");
  await work.addConfig("user.name", "Test");
  await work.checkout(args.branch);
  await writeFile(join(workPath, args.fileName), args.contents);
  await work.add(args.fileName);
  await work.commit(args.message);
  await work.push("origin", args.branch);
}
