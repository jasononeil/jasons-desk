CREATE TABLE `branches` (
	`orgName` text NOT NULL,
	`repoName` text NOT NULL,
	`branchName` text NOT NULL,
	`lastOpened` text NOT NULL,
	`taskId` text,
	PRIMARY KEY(`orgName`, `repoName`, `branchName`),
	FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`orgName`,`repoName`) REFERENCES `repos`(`orgName`,`repoName`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `repos` (
	`orgName` text NOT NULL,
	`repoName` text NOT NULL,
	`defaultBranch` text NOT NULL,
	`lastOpened` text NOT NULL,
	PRIMARY KEY(`orgName`, `repoName`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Backlog' NOT NULL
);
