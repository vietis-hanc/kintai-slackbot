# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS CLOUD                                   │
│                                                                     │
│  ┌──────────────────┐        ┌──────────────────────────────────┐ │
│  │  EventBridge     │        │      Lambda Function             │ │
│  │  Schedule Rule   │───────>│   (KintaiSlackBotFunction)       │ │
│  │                  │        │                                  │ │
│  │  cron(0 23 * *?)│        │  • Node.js 20.x                  │ │
│  │  Daily 8AM JST   │        │  • Slack Bolt SDK                │ │
│  └──────────────────┘        │  • 128MB RAM, 30s timeout        │ │
│                               │                                  │ │
│                               │  Handler: app.handler            │ │
│                               └────────┬─────────────────────────┘ │
│                                        │                           │
│                                        │                           │
│                               ┌────────▼─────────────────────────┐ │
│                               │    SSM Parameter Store           │ │
│                               │                                  │ │
│                               │  /kintai-slackbot/reminder-ts   │ │
│                               │  (stores message timestamp)      │ │
│                               └──────────────────────────────────┘ │
│                                        │                           │
│  ┌─────────────────────────────────────┘                           │
│  │                                                                 │
│  │  ┌────────────────────────────────────────────────────────┐    │
│  │  │       Lambda Function URL                              │    │
│  │  │  https://xyz.lambda-url.region.on.aws/slack/events     │    │
│  │  │  (Public endpoint for Slack webhook)                   │    │
│  │  └────────────────────────────────────────────────────────┘    │
│  │                                                                 │
└──┼─────────────────────────────────────────────────────────────────┘
   │
   │  HTTPS POST (interactions)
   │
┌──▼──────────────────────────────────────────────────────────────────┐
│                         SLACK API                                   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Slack Channel                                               │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │ 🤖 Kintai Bot                                          │ │  │
│  │  │                                                        │ │  │
│  │  │ Reminder: 今日勤怠連絡をお願いします。                │ │  │
│  │  │                                                        │ │  │
│  │  │ [オフィス出勤] [リモート出勤]                          │ │  │
│  │  │ [オフィス退勤] [リモート退勤]                          │ │  │
│  │  │                                                        │ │  │
│  │  │   └─ 💬 Thread Reply:                                 │ │  │
│  │  │       @user 09:30にオフィス勤務を開始します。         │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Daily Reminder Flow

```
EventBridge (8:00 AM JST)
    │
    ├─> Trigger Lambda Function
    │
    ├─> Lambda: sendDailyReminder()
    │   │
    │   ├─> Slack API: chat.postMessage
    │   │   └─> Post reminder with buttons
    │   │
    │   ├─> Get message timestamp (ts)
    │   │
    │   └─> SSM: putParameter
    │       └─> Store timestamp for threading
    │
    └─> Slack Channel receives message
```

### 2. Button Click Flow

```
User clicks button (e.g., "オフィス出勤")
    │
    ├─> Slack sends interaction payload
    │
    ├─> Lambda Function URL receives request
    │
    ├─> Lambda: Verify Slack signature
    │
    ├─> Lambda: app.action('office_checkin')
    │   │
    │   ├─> ack() - Acknowledge interaction
    │   │
    │   ├─> getCurrentTimeJST() - Get current time
    │   │
    │   ├─> SSM: getParameter
    │   │   └─> Retrieve stored timestamp
    │   │
    │   └─> Slack API: chat.postMessage
    │       └─> Post reply in thread using thread_ts
    │
    └─> User sees reply in thread
```

## Component Details

### Lambda Function

**Runtime**: Node.js 20.x  
**Memory**: 128 MB  
**Timeout**: 30 seconds  
**Handler**: `app.handler`

**Environment Variables**:
- `SLACK_BOT_TOKEN` - Bot OAuth token
- `SLACK_SIGNING_SECRET` - Request verification
- `SLACK_CHANNEL_ID` - Target channel

**Permissions**:
- `ssm:GetParameter` - Read timestamp
- `ssm:PutParameter` - Store timestamp

### EventBridge Rule

**Schedule**: `cron(0 23 * * ? *)`  
**Description**: Trigger daily reminder at 8:00 AM JST  
**Status**: Enabled  
**Target**: KintaiSlackBotFunction

### Lambda Function URL

**Authentication**: NONE (protected by Slack signature)  
**Endpoint**: `/slack/events`  
**Method**: POST  
**Purpose**: Receive Slack interaction payloads

### SSM Parameter

**Name**: `/kintai-slackbot/reminder-ts`  
**Type**: String  
**Purpose**: Store message timestamp for thread replies  
**Lifecycle**: Created on first reminder, updated daily

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Security Layer                                             │
│                                                             │
│  1. Slack Signature Verification                           │
│     └─> Validates requests from Slack using signing secret │
│                                                             │
│  2. CloudFormation Parameter Encryption                    │
│     └─> NoEcho parameters for secrets                      │
│                                                             │
│  3. IAM Least Privilege                                    │
│     └─> Only SSM access to specific parameter path         │
│                                                             │
│  4. No Hardcoded Credentials                               │
│     └─> All secrets via environment variables              │
│                                                             │
│  5. Lambda Function URL                                    │
│     └─> No auth required (Slack signature is sufficient)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Scalability Considerations

### Current Design
- **Single reminder per day**: Adequate for current use case
- **In-memory timestamp**: SSM Parameter Store (1 timestamp)
- **No persistence**: User responses not tracked

### Scale Considerations
- Lambda can handle thousands of concurrent requests
- SSM has 40 requests/second limit (more than sufficient)
- Slack API rate limits apply (varies by method)

### Potential Bottlenecks
1. **SSM Parameter Store**: If multiple reminders/day needed
2. **Slack API rate limits**: For large teams (100+ users)
3. **Lambda cold starts**: First request may be slower (1-2s)

## High Availability

### AWS Services Used
- **Lambda**: Multi-AZ by default
- **EventBridge**: Regional service, highly available
- **SSM**: Multi-AZ replication
- **Lambda Function URL**: Regional, HA endpoint

### Failure Scenarios

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| Lambda timeout | Reminder not sent | CloudWatch alarm + retry logic |
| SSM unavailable | Thread reply uses message ts | Fallback implemented |
| Slack API error | Message not posted | Logged in CloudWatch |
| EventBridge miss | Reminder skipped | Next day continues normally |

## Monitoring Points

### CloudWatch Logs
- Lambda execution logs
- Slack API responses
- SSM parameter operations
- Error stack traces

### CloudWatch Metrics
- Lambda invocations
- Lambda errors
- Lambda duration
- EventBridge rule invocations

### Recommended Alarms
1. Lambda error rate > 5%
2. Lambda duration > 25 seconds
3. EventBridge rule missed trigger

## Cost Breakdown

### Monthly Estimates (Tokyo region)

| Service | Usage | Cost |
|---------|-------|------|
| Lambda | 30 invocations/month (1/day) + 120 interactions | $0.20 |
| EventBridge | 30 events/month | $0.00 (Free tier) |
| SSM Parameter Store | Standard parameter | $0.00 |
| Lambda Function URL | All requests | $0.00 |
| Data Transfer | Minimal | $0.00 |
| **Total** | | **~$0.20/month** |

*Note: Costs may vary based on actual usage and region*

## Deployment Workflow

```
Developer Machine                    AWS Cloud
─────────────────                    ─────────
      │
      │  sam build
      ├──────────────> Package Lambda function
      │                (node_modules included)
      │
      │  sam deploy
      ├──────────────> Create/Update CloudFormation Stack
      │                │
      │                ├─> Create Lambda Function
      │                ├─> Create EventBridge Rule
      │                ├─> Create Function URL
      │                ├─> Create IAM Role
      │                └─> Set Environment Variables
      │
      │                CloudFormation Outputs:
      │<──────────────── - Function ARN
                         - Function URL
                         - IAM Role ARN
```

## Integration Points

### Slack → AWS
- **Interactivity Endpoint**: Lambda Function URL
- **Authentication**: Slack signature verification
- **Payload**: JSON with interaction details

### AWS → Slack
- **API Method**: `chat.postMessage`
- **Authentication**: Bot OAuth token
- **Rate Limits**: Tier varies by workspace

## Time Zone Handling

```
User Request: "Send at 8:00 AM JST"
                    │
                    ▼
          Convert to UTC
          8:00 AM JST = 11:00 PM UTC (previous day)
                    │
                    ▼
    EventBridge Cron: cron(0 23 * * ? *)
                    │
                    ▼
          Lambda Triggered
                    │
                    ▼
    getCurrentTimeJST() converts UTC → JST for display
                    │
                    ▼
    Reply shows: "09:30にオフィス勤務を開始します。"
```

## Dependencies

### NPM Packages
- `@slack/bolt`: ^3.17.1 - Slack Bolt SDK
- `aws-sdk`: ^2.1543.0 - AWS SDK for Node.js

### AWS Services
- AWS Lambda
- Amazon EventBridge
- AWS Systems Manager (Parameter Store)
- AWS IAM

### External Services
- Slack API
- Slack OAuth

## References

- [Slack Bolt SDK Documentation](https://slack.dev/bolt-js/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [EventBridge Cron Expressions](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
