#!/usr/bin/env bash
while grep -qe '- \[ \]' PROGRESS.md; do
    claude --print --verbose --output-format "stream-json" --settings '{"sandbox":{"enabled":true,"failIfUnavailable":true,"allowUnsandboxedCommands":false,"autoAllowBashIfSandboxed":true}}' --dangerously-skip-permissions "Continue with the next item in PROGRESS.md" | jq
done
