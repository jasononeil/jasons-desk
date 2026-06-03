#!/usr/bin/env bash
while grep -qe '- \[ \]' PROGRESS.md; do
    claude --settings '{"sandbox":{"enabled":true,"failIfUnavailable":true,"allowUnsandboxedCommands":false,"autoAllowBashIfSandboxed":true}}' "Continue with the next item in PROGRESS.md"
done
