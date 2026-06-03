import { styleText } from "node:util";

export const tree = {
  branch: "├──",
  last: "└──",
  pipe: "│  ",
  space: "   ",
} as const;

export function dim(text: string): string {
  return styleText("gray", text);
}

export function bold(text: string): string {
  return styleText("bold", text);
}

export function status(text: string): string {
  switch (text) {
    case "InProgress":
      return styleText("cyan", text);
    case "InReview":
      return styleText("yellow", text);
    case "Blocked":
      return styleText("red", text);
    case "Done":
      return styleText("green", text);
    case "Abandoned":
      return styleText("gray", text);
    default:
      return text;
  }
}

export function orphan(text: string): string {
  return styleText("yellow", text);
}

export function repoSlug(orgName: string, repoName: string): string {
  return styleText("magenta", `${orgName}/${repoName}`);
}

export function branchName(text: string): string {
  return styleText("cyan", text);
}

export function taskId(text: string): string {
  return styleText("blue", text);
}
