import { defineCommand } from "citty";

const BASH_ZSH_SNIPPET = `desk() {
  if [ "\${1-}" = "open" ]; then
    local _desk_path
    _desk_path="$(desk-cli "$@")" || return $?
    if [ -n "$_desk_path" ]; then
      cd "$_desk_path"
    fi
  else
    desk-cli "$@"
  fi
}
`;

const FISH_SNIPPET = `function desk
    if test (count $argv) -gt 0; and test "$argv[1]" = "open"
        set -l _desk_path (desk-cli $argv)
        set -l _desk_status $status
        if test $_desk_status -ne 0
            return $_desk_status
        end
        if test -n "$_desk_path"
            cd "$_desk_path"
        end
    else
        desk-cli $argv
    end
end
`;

export const SHELLS = ["bash", "zsh", "fish"] as const;
export type Shell = (typeof SHELLS)[number];

export function shellSnippet(shell: Shell): string {
  switch (shell) {
    case "bash":
    case "zsh":
      return BASH_ZSH_SNIPPET;
    case "fish":
      return FISH_SNIPPET;
  }
}

export const shellInitCommand = defineCommand({
  meta: {
    name: "shell-init",
    description:
      "Print the shell wrapper that captures `desk open` output and cd's into it",
  },
  args: {
    shell: {
      type: "positional",
      description: "Target shell",
      required: true,
      valueHint: SHELLS.join("|"),
    },
  },
  run({ args }) {
    if (!(SHELLS as readonly string[]).includes(args.shell)) {
      throw new Error(
        `Unknown shell: ${args.shell}. Supported: ${SHELLS.join(", ")}`,
      );
    }
    process.stdout.write(shellSnippet(args.shell as Shell));
  },
});
