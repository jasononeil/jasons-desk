#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

export const main = defineCommand({
  meta: {
    name: "desk-cli",
    description: "Personal workspace manager for git-based work",
  },
  subCommands: {},
});

if (import.meta.main) {
  runMain(main);
}
