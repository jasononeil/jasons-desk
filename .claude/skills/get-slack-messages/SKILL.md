---
description: Get recent Slack messages from DevEx team channels and summarise them
user-invocable: true
---

## Channels

| Channel | ID |
|---------|-----|
| #wol_devex | C02NUQ65U2C |
| #help_devex | C05D8BD1CB1 |

## Steps

1. Get the Unix timestamp for the start of yesterday by running. Use this exact command:
   ```bash
   date -d "yesterday 00:00" +%s
   ```

2. For each channel above, call `slack_read_channel` with:
   - `channel_id`: the ID from the table
   - `oldest`: the timestamp from step 1
   - `limit`: 100
   - `response_format`: `concise`

3. Summarise the results as a bullet list per channel. Each bullet should be one line:
   - `**Author**: Short summary of the thread/message`
   - Include a Slack permalink using the format: `https://your-org.slack.com/archives/{channel_id}/p{message_ts_without_dot}`
   - Do I need a follow up response? (`[FollowUp]`)

4. If a channel has no messages in the time range, say so.
