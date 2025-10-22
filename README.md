# Kintai Slack Bot

A Slack reminder bot for daily attendance notifications, deployed on AWS Lambda using AWS SAM.

## Features

- Sends daily reminder at 8:00 AM JST
- Interactive buttons for attendance tracking:
  - オフィス出勤 (Office Check-in)
  - リモート出勤 (Remote Check-in)
  - オフィス退勤 (Office Check-out)
  - リモート退勤 (Remote Check-out)
- Replies in the same thread when users click buttons
- Built with Slack Bolt SDK for AWS Lambda
- Deployed via AWS SAM

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- AWS SAM CLI installed
- Slack workspace with admin permissions

## Slack App Setup

1. Create a new Slack App at https://api.slack.com/apps
2. Enable the following OAuth Scopes under "OAuth & Permissions":
   - `chat:write` - Send messages
   - `chat:write.public` - Send messages to channels without joining
   - `commands` - Add slash commands
3. Enable Interactivity under "Interactivity & Shortcuts"
4. Install the app to your workspace
5. Copy the following credentials:
   - Bot User OAuth Token (starts with `xoxb-`)
   - Signing Secret (from "Basic Information")
6. Get the Channel ID where you want to post reminders

## Project Structure

```
.
├── app.js           # Main Lambda handler with Slack Bolt logic
├── template.yaml    # AWS SAM template
├── package.json     # Node.js dependencies
└── README.md        # This file
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd kintai-slackbot
```

2. Install dependencies:
```bash
npm install
```

## Deployment

1. Build the SAM application:
```bash
sam build
```

2. Deploy the application (first time):
```bash
sam deploy --guided
```

During the guided deployment, you'll be prompted to provide:
- Stack Name: e.g., `kintai-slackbot`
- AWS Region: e.g., `ap-northeast-1`
- SlackBotToken: Your Slack Bot User OAuth Token
- SlackSigningSecret: Your Slack App Signing Secret
- SlackChannelId: The channel ID where reminders will be posted

3. For subsequent deployments:
```bash
sam deploy
```

## Configuration

After deployment, you need to configure the Slack App's Request URL:

1. Get the Lambda Function URL from the SAM deployment outputs
2. In your Slack App settings, go to "Interactivity & Shortcuts"
3. Set the Request URL to: `<Lambda Function URL>/slack/events`
4. Save the changes

## Environment Variables

The Lambda function uses the following environment variables:

- `SLACK_BOT_TOKEN`: Your Slack Bot User OAuth Token
- `SLACK_SIGNING_SECRET`: Your Slack App Signing Secret
- `SLACK_CHANNEL_ID`: The channel ID where reminders will be posted

## How It Works

1. **Daily Reminder**: An EventBridge rule triggers the Lambda function daily at 8:00 AM JST (11:00 PM UTC the previous day)
2. **Message Posting**: The function posts a reminder message with 4 interactive buttons to the specified Slack channel
3. **Timestamp Storage**: The message timestamp (`ts`) is stored in AWS SSM Parameter Store
4. **Button Clicks**: When a user clicks a button, Slack sends an interaction payload to the Lambda function
5. **Thread Reply**: The function retrieves the stored timestamp and posts the user's response in the same thread

## AWS Resources Created

- Lambda Function: Handles Slack events and sends reminders
- EventBridge Rule: Schedules daily reminder at 8:00 AM JST
- Lambda Function URL: Endpoint for Slack to send events
- SSM Parameter: Stores the reminder message timestamp
- IAM Role: Grants Lambda permissions to access SSM

## Local Testing

To test the scheduled reminder locally:

```bash
sam local invoke KintaiSlackBotFunction --event events/scheduled-event.json
```

Create a test event file `events/scheduled-event.json`:
```json
{
  "source": "aws.events",
  "detail-type": "Scheduled Event",
  "time": "2025-10-21T23:00:00Z"
}
```

## Monitoring

View Lambda logs in CloudWatch:
```bash
sam logs -n KintaiSlackBotFunction --tail
```

## Cleanup

To delete the application:
```bash
sam delete
```

## Troubleshooting

### Reminders not being sent
- Check CloudWatch Logs for the Lambda function
- Verify the EventBridge rule is enabled
- Confirm the SLACK_CHANNEL_ID is correct

### Buttons not working
- Verify the Request URL is set correctly in Slack App settings
- Check that the Lambda Function URL is accessible
- Review CloudWatch Logs for error messages

### Thread replies not working
- Ensure the SSM Parameter Store has the correct permissions
- Check that the timestamp is being stored correctly
- Verify the bot has `chat:write` permissions

## License

ISC
