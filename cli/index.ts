#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { listCommand } from "./list.ts";
import { openCommand } from "./open.ts";
import { shellInitCommand } from "./shell-init.ts";
import { taskCommand } from "./task.ts";

export const main = defineCommand({
  meta: {
    name: "desk-cli",
    description: "Personal workspace manager for git-based work",
  },
  subCommands: {
    open: openCommand,
    task: taskCommand,
    list: listCommand,
    "shell-init": shellInitCommand,
  },
});

if (import.meta.main) {
  runMain(main);
}
