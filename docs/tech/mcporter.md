# MCPorter

Sometimes we want to create scripts that use MCP integrations.

MCPorter is the tool for the job - it allows CLI usage or a Typescript API.

We configure allowed MCP servers in `mcporter.json`.

## Bash commands

- List servers `bun run mcporter list`
- List tools on a server `bun run mcporter list atlassian --brief`
- Run a tool `bun run mcporter call atlassian.atlassian.getJiraIssue cloudId:https://your-org.atlassian.net/ issueIdOrKey:PROJ-23`

## Full README, including Typescript SDK docs

node_modules/mcporter/README.md


## Common commands

Getting a list of all my tickets

 ```bash
bun run mcporter call atlassian.searchJiraIssuesUsingJql \
    --args '{"cloudId":"https://your-org.atlassian.net/","jql":"assignee = currentUser() AND statusCategory != Done AND status != Backlog"}' \
    | jq '[.issues[] | {
        key: .key,
        summary: .fields.summary,
        issue_type: .fields.issuetype.name,
        status: .fields.status.name,
        priority: .fields.priority.name,
        parent: {
        key: .fields.parent.key,
        summary: .fields.parent.fields.summary
        }
    }]'
 ```

Reading a Jira ticket

```bash
bun run mcporter call atlassian.getJiraIssue \
    cloudId:https://your-org.atlassian.net/ \
    issueIdOrKey:FEF-2772 \
    | jq '{
    key: .key,
    summary: .fields.summary,
    issue_type: .fields.issuetype.name,
    status: .fields.status.name,
    assignee: .fields.assignee.displayName,
    description: .fields.description,
    parent: {
      key: .fields.parent.key,
      summary: .fields.parent.fields.summary
    }
  }'
```
