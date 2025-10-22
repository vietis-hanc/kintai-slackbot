# Quick Start Guide

Get the Kintai Slack Bot up and running in 15 minutes.

## Prerequisites Checklist

- [ ] AWS CLI installed and configured
- [ ] AWS SAM CLI installed
- [ ] Node.js 20.x or later installed
- [ ] Slack workspace admin access

## Step 1: Create Slack App (5 minutes)

1. Go to https://api.slack.com/apps → "Create New App" → "From scratch"
2. Name it "Kintai Bot", select your workspace
3. Go to "OAuth & Permissions" → Add scopes:
   - `chat:write`
   - `chat:write.public`
4. Click "Install to Workspace" → Copy the **Bot User OAuth Token** (xoxb-...)
5. Go to "Basic Information" → Copy the **Signing Secret**
6. In Slack, right-click your target channel → "View channel details" → Copy **Channel ID**

## Step 2: Deploy to AWS (5 minutes)

```bash
# Clone and setup
git clone <repo-url>
cd kintai-slackbot
npm install

# Build and deploy
sam build
sam deploy --guided
```

When prompted, enter:
- Stack name: `kintai-slackbot`
- Region: `ap-northeast-1` (or your preference)
- SlackBotToken: `xoxb-...` (from Step 1)
- SlackSigningSecret: `...` (from Step 1)
- SlackChannelId: `C...` (from Step 1)
- Accept all other defaults: `Y`

**Copy the Function URL** from the output!

## Step 3: Configure Slack Webhook (2 minutes)

1. Back in Slack App settings at https://api.slack.com/apps
2. Go to "Interactivity & Shortcuts"
3. Toggle "Interactivity" **ON**
4. Set Request URL: `<Function URL>/slack/events`
   - Example: `https://abc123.lambda-url.ap-northeast-1.on.aws/slack/events`
5. Click "Save Changes"

## Step 4: Test (3 minutes)

### Test Scheduled Reminder (Optional)

```bash
aws lambda invoke \
  --function-name kintai-slackbot-KintaiSlackBotFunction-XXXXX \
  --payload '{"source":"aws.events","detail-type":"Scheduled Event"}' \
  response.json
```

### Test in Slack

1. Wait for 8:00 AM JST tomorrow, or trigger manually (above)
2. You should see a message in your channel with 4 buttons
3. Click "オフィス出勤" → Should see reply in thread: `<@you> 14:23にオフィス勤務を開始します。`

## Common Issues

### "URL verification failed"
- Double-check Function URL is correct
- Ensure `/slack/events` is appended
- Check Signing Secret is correct

### "Reminder not appearing"
- Check CloudWatch Logs: `sam logs -n KintaiSlackBotFunction --tail`
- Verify Channel ID is correct
- Ensure bot is in the channel (or has `chat:write.public` scope)

### "Buttons don't respond"
- Verify Request URL in Slack is set correctly
- Check Lambda Function URL is accessible
- Review CloudWatch Logs for errors

## Monitoring

```bash
# View logs
sam logs -n KintaiSlackBotFunction --tail

# Check EventBridge rule
aws events describe-rule --name <rule-name>
```

## Update Configuration

To change tokens or channel:

```bash
sam deploy --parameter-overrides \
  SlackBotToken=xoxb-new-token \
  SlackSigningSecret=new-secret \
  SlackChannelId=C0123456789
```

## Cleanup

To remove everything:

```bash
sam delete
```

## Next Steps

- Review [README.md](README.md) for full documentation
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment guide
- See [CRON_REFERENCE.md](CRON_REFERENCE.md) to change schedule
- Read [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for technical details

## Schedule Reference

Current schedule: **8:00 AM JST daily**

To change the time, edit `template.yaml`:

```yaml
Schedule: 'cron(0 23 * * ? *)'  # 8:00 AM JST
```

Common times:
- 9:00 AM JST: `cron(0 0 * * ? *)`
- 10:00 AM JST: `cron(0 1 * * ? *)`
- Weekdays only: `cron(0 23 ? * MON-FRI *)`

Then redeploy: `sam build && sam deploy`

## Support

- AWS Logs: CloudWatch → `/aws/lambda/kintai-slackbot-KintaiSlackBotFunction-XXX`
- Slack App: https://api.slack.com/apps
- Issues: See [DEPLOYMENT.md](DEPLOYMENT.md) troubleshooting section
