import {
  foreignKey,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const STATUSES = [
  "Backlog",
  "InProgress",
  "InReview",
  "Blocked",
  "Done",
  "Abandoned",
] as const;

export type Status = (typeof STATUSES)[number];

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  status: text("status").$type<Status>().notNull().default("Backlog"),
});

export const repos = sqliteTable(
  "repos",
  {
    orgName: text("orgName").notNull(),
    repoName: text("repoName").notNull(),
    defaultBranch: text("defaultBranch").notNull(),
    lastOpened: text("lastOpened").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgName, t.repoName] })],
);

export const branches = sqliteTable(
  "branches",
  {
    orgName: text("orgName").notNull(),
    repoName: text("repoName").notNull(),
    branchName: text("branchName").notNull(),
    lastOpened: text("lastOpened").notNull(),
    taskId: text("taskId").references(() => tasks.id),
  },
  (t) => [
    primaryKey({ columns: [t.orgName, t.repoName, t.branchName] }),
    foreignKey({
      columns: [t.orgName, t.repoName],
      foreignColumns: [repos.orgName, repos.repoName],
    }),
  ],
);
