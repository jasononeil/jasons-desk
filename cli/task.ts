import { defineCommand } from "citty";
import { openTask } from "../api/task.ts";
import { STATUSES } from "../model/schema.ts";
import { resolveDeskHome } from "../model/db.ts";
import { bold, status as styleStatus, taskId as styleTaskId } from "./format.ts";

export const taskCommand = defineCommand({
  meta: {
    name: "task",
    description: "Create or update a task (defaults to InProgress)",
  },
  args: {
    taskId: {
      type: "positional",
      description: "Task identifier (e.g. CA-1234)",
      required: true,
    },
    title: {
      type: "string",
      description: "Set the task title",
    },
    description: {
      type: "string",
      description: "Set the task description",
    },
    "this-branch": {
      type: "boolean",
      description: "Link the current worktree's branch to this task",
    },
    status: {
      type: "enum",
      description: "Set the task status",
      options: [...STATUSES],
    },
  },
  async run({ args }) {
    const task = await openTask({
      deskHome: resolveDeskHome(),
      taskId: args.taskId,
      title: args.title,
      description: args.description,
      thisBranch: args["this-branch"],
      status: args.status,
    });

    console.log(
      `${bold(styleTaskId(task.id))} ${styleStatus(task.status)}` +
        (task.title ? `  ${task.title}` : ""),
    );
    if (task.description) {
      console.log(task.description);
    }
  },
});
