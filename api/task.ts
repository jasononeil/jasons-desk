import { and, eq } from "drizzle-orm";
import { getDb } from "../model/db.ts";
import { branches, STATUSES, type Status, tasks } from "../model/schema.ts";
import { getCurrentWorktreeInfo } from "./git.ts";

export type Task = typeof tasks.$inferSelect;

export type OpenTaskOptions = {
  deskHome: string;
  taskId: string;
  title?: string;
  description?: string;
  status?: string;
  thisBranch?: boolean;
  cwd?: string;
};

function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}

/**
 * Create a task (if missing) or update it. When no `status` is given, a new
 * task is created as `InProgress`, and an existing `Backlog` task is
 * transitioned to `InProgress`; other statuses are left alone.
 *
 * `thisBranch` links the worktree at `cwd` (defaults to `process.cwd()`) to
 * the task; it requires `cwd` to be inside a desk-managed worktree.
 */
export async function openTask(opts: OpenTaskOptions): Promise<Task> {
  if (!opts.taskId) {
    throw new Error("taskId is required");
  }

  let desiredStatus: Status | undefined;
  if (opts.status !== undefined) {
    if (!isStatus(opts.status)) {
      throw new Error(
        `Invalid status "${opts.status}": expected one of ${STATUSES.join(", ")}`,
      );
    }
    desiredStatus = opts.status;
  }

  const db = getDb(opts.deskHome);

  const existing = db
    .select()
    .from(tasks)
    .where(eq(tasks.id, opts.taskId))
    .get();

  if (!existing) {
    db.insert(tasks)
      .values({
        id: opts.taskId,
        title: opts.title ?? "",
        description: opts.description ?? "",
        status: desiredStatus ?? "InProgress",
      })
      .run();
  } else {
    const update: Partial<typeof tasks.$inferInsert> = {};
    if (opts.title !== undefined) update.title = opts.title;
    if (opts.description !== undefined) update.description = opts.description;
    if (desiredStatus !== undefined) {
      update.status = desiredStatus;
    } else if (existing.status === "Backlog") {
      update.status = "InProgress";
    }
    if (Object.keys(update).length > 0) {
      db.update(tasks).set(update).where(eq(tasks.id, opts.taskId)).run();
    }
  }

  if (opts.thisBranch) {
    const cwd = opts.cwd ?? process.cwd();
    const info = await getCurrentWorktreeInfo({
      deskHome: opts.deskHome,
      cwd,
    });
    if (!info) {
      throw new Error(
        `--this-branch requires being inside a desk-managed worktree (cwd: ${cwd})`,
      );
    }
    const branchWhere = and(
      eq(branches.orgName, info.orgName),
      eq(branches.repoName, info.repoName),
      eq(branches.branchName, info.branchName),
    );
    const branchRow = db.select().from(branches).where(branchWhere).get();
    if (!branchRow) {
      throw new Error(
        `No branch row for ${info.orgName}/${info.repoName} '${info.branchName}' — has it been opened with \`desk open\`?`,
      );
    }
    db.update(branches).set({ taskId: opts.taskId }).where(branchWhere).run();
  }

  const result = db
    .select()
    .from(tasks)
    .where(eq(tasks.id, opts.taskId))
    .get();
  if (!result) {
    throw new Error(`Task ${opts.taskId} disappeared after upsert`);
  }
  return result;
}
