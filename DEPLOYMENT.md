# Deployment Guide

This guide walks you through deploying the Kintai Slack Bot to AWS.

## Prerequisites

Before deploying, ensure you have:

1. ✅ AWS CLI installed and configured
2. ✅ AWS SAM CLI installed
3. ✅ Node.js 20.x or later
4. ✅ A Slack workspace with admin permissions
5. ✅ AWS account with permissions to create Lambda, EventBridge, and SSM resources

## Step 1: Set up Slack App

### 1.1 Create a Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App"
3. Choose "From scratch"
4. Enter App Name: "Kintai Bot"
5. Select your workspace

### 1.2 Configure OAuth Scopes

1. In your app settings, go to "OAuth & Permissions"
2. Under "Scopes" → "Bot Token Scopes", add:
   - `chat:write` - To send messages
   - `chat:write.public` - To send messages to channels without joining

### 1.3 Install App to Workspace

1. In "OAuth & Permissions", click "Install to Workspace"
2. Authorize the app
3. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

### 1.4 Get Signing Secret

1. Go to "Basic Information"
2. Under "App Credentials", copy the "Signing Secret"

### 1.5 Get Channel ID

1. Open Slack
2. Right-click on the channel where you want reminders
3. Click "View channel details"
4. Copy the Channel ID from the bottom of the details panel

## Step 2: Deploy to AWS

### 2.1 Build the Application

```bash
cd kintai-slackbot
npm install
sam build
```

### 2.2 Deploy (First Time)

```bash
sam deploy --guided
```

You'll be prompted for:

- **Stack Name**: `kintai-slackbot` (or your preferred name)
- **AWS Region**: `ap-northeast-1` (or your preferred region)
- **Parameter SlackBotToken**: Paste your Bot User OAuth Token (xoxb-...)
- **Parameter SlackSigningSecret**: Paste your Signing Secret
- **Parameter SlackChannelId**: Paste your Channel ID
- **Confirm changes before deploy**: Y
- **Allow SAM CLI IAM role creation**: Y
- **Disable rollback**: N
- **Save arguments to configuration file**: Y
- **SAM configuration file**: Press Enter (default)
- **SAM configuration environment**: Press Enter (default)

### 2.3 Note the Output

After deployment completes, note the output values:
- `KintaiSlackBotFunctionUrl` - You'll need this for Slack

Example output:
```
Key                 KintaiSlackBotFunctionUrl
Description         Lambda Function URL for Slack Events
Value               https://abcd1234.lambda-url.ap-northeast-1.on.aws/
```

## Step 3: Configure Slack Interactivity

### 3.1 Set Request URL

1. Go back to your Slack App settings at https://api.slack.com/apps
2. Go to "Interactivity & Shortcuts"
3. Turn on "Interactivity"
4. Set the Request URL to: `<KintaiSlackBotFunctionUrl>/slack/events`
   - Example: `https://abcd1234.lambda-url.ap-northeast-1.on.aws/slack/events`
5. Click "Save Changes"
6. Slack will verify the URL (you should see a green checkmark)

## Step 4: Test the Bot

### 4.1 Test Scheduled Reminder (Optional)

Test the reminder manually using AWS CLI:

```bash
aws lambda invoke \
  --function-name kintai-slackbot-KintaiSlackBotFunction-XXXXX \
  --payload '{"source":"aws.events","detail-type":"Scheduled Event"}' \
  response.json
```

Or using SAM:

```bash
sam local invoke KintaiSlackBotFunction --event events/scheduled-event.json
```

### 4.2 Wait for Scheduled Reminder

The reminder will automatically be sent at 8:00 AM JST (11:00 PM UTC previous day) every day.

### 4.3 Test Button Interactions

1. When the reminder is posted, click one of the buttons
2. Verify that a message appears in the thread mentioning you
3. Check that the format is: `<@user> HH:ii に[action]します。`

## Step 5: Monitor

### View Logs

```bash
sam logs -n KintaiSlackBotFunction --tail
```

Or in AWS Console:
1. Go to CloudWatch
2. Navigate to Log Groups
3. Find `/aws/lambda/kintai-slackbot-KintaiSlackBotFunction-XXXXX`

### Check EventBridge Rule

1. Go to AWS Console → EventBridge
2. Navigate to Rules
3. Find the rule named similar to `kintai-slackbot-KintaiSlackBotFunction-DailyReminder-XXXXX`
4. Verify it's enabled and scheduled for `cron(0 23 * * ? *)`

## Subsequent Deployments

After initial setup, you can deploy updates with:

```bash
sam build
sam deploy
```

## Updating Configuration

To update environment variables (tokens, secrets, channel):

```bash
sam deploy --parameter-overrides \
  SlackBotToken=xoxb-new-token \
  SlackSigningSecret=new-secret \
  SlackChannelId=C0123456789
```

## Cleanup

To remove all AWS resources:

```bash
sam delete
```

Then manually:
1. Delete the SSM Parameter `/kintai-slackbot/reminder-ts` if it exists
2. Remove or disable your Slack App

## Troubleshooting

### Reminder not being sent

**Issue**: No message appears at 8:00 AM JST

**Solutions**:
1. Check CloudWatch Logs for errors
2. Verify EventBridge rule is enabled
3. Confirm the channel ID is correct
4. Check Lambda function has proper permissions

### Buttons don't respond

**Issue**: Clicking buttons does nothing

**Solutions**:
1. Verify Request URL in Slack settings matches the Function URL
2. Check CloudWatch Logs for interaction errors
3. Ensure Lambda Function URL is publicly accessible
4. Verify Signing Secret is correct

### Thread replies not working

**Issue**: Button clicks work but replies don't appear in thread

**Solutions**:
1. Check SSM Parameter Store for `/kintai-slackbot/reminder-ts`
2. Verify Lambda has SSM permissions
3. Check CloudWatch Logs for SSM errors
4. Ensure the bot has `chat:write` scope

### Wrong time zone

**Issue**: Reminder sent at wrong time

**Solution**: The cron expression `cron(0 23 * * ? *)` is for 11:00 PM UTC (8:00 AM JST next day). Adjust if needed for your time zone.

### Slack URL verification fails

**Issue**: Slack cannot verify the Request URL

**Solutions**:
1. Ensure Lambda Function URL is deployed and accessible
2. Check that SLACK_SIGNING_SECRET is set correctly
3. Try redeploying: `sam build && sam deploy`
4. Check CloudWatch Logs for verification request errors

## Cost Estimation

Approximate AWS costs (us-east-1 pricing):

- **Lambda**: ~$0.20/month (assuming 1 invocation/day + button clicks)
- **EventBridge**: $1.00/month (730 events)
- **SSM Parameter Store**: Free (Standard parameters)
- **Lambda Function URL**: Free

**Total**: ~$1.20/month

Note: Costs may vary by region and usage patterns.

## Security Considerations

1. **Secrets Management**: Bot token and signing secret are stored as CloudFormation parameters (encrypted at rest)
2. **Function URL**: Publicly accessible but protected by Slack signature verification
3. **IAM Permissions**: Lambda has minimal permissions (only SSM for one parameter path)
4. **No VPC**: Function runs in AWS default network (no additional networking costs)

## Support

For issues or questions:
1. Check CloudWatch Logs first
2. Review this troubleshooting guide
3. Consult AWS SAM documentation
4. Check Slack API documentation
