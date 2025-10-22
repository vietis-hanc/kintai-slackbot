# Cron Schedule Reference

## Current Schedule

The bot is configured to send reminders at **8:00 AM JST** daily.

```yaml
Schedule: 'cron(0 23 * * ? *)'
```

## Cron Expression Format

EventBridge uses a 6-field cron format:

```
cron(Minutes Hours Day-of-month Month Day-of-week Year)
```

Fields:
- **Minutes**: 0-59
- **Hours**: 0-23 (UTC time)
- **Day-of-month**: 1-31
- **Month**: 1-12 or JAN-DEC
- **Day-of-week**: 1-7 or SUN-SAT (1 = Sunday)
- **Year**: 1970-2199

## Time Zone Conversion

EventBridge uses **UTC time only**. To schedule for JST:

- JST = UTC + 9 hours
- 8:00 AM JST = 11:00 PM UTC (previous day)
- Therefore: `cron(0 23 * * ? *)`

## Common Schedule Examples

### Different Times (JST → UTC)

| JST Time | UTC Time | Cron Expression |
|----------|----------|-----------------|
| 8:00 AM  | 11:00 PM (prev day) | `cron(0 23 * * ? *)` |
| 9:00 AM  | 12:00 AM | `cron(0 0 * * ? *)` |
| 10:00 AM | 1:00 AM  | `cron(0 1 * * ? *)` |
| 6:00 PM  | 9:00 AM  | `cron(0 9 * * ? *)` |

### Weekdays Only (Mon-Fri)

```yaml
# 8:00 AM JST, Monday to Friday
Schedule: 'cron(0 23 ? * MON-FRI *)'
```

### Multiple Times Per Day

```yaml
# 8:00 AM and 6:00 PM JST
Schedule: 'cron(0 23,9 * * ? *)'
```

### Specific Day of Month

```yaml
# 8:00 AM JST on the 1st of every month
Schedule: 'cron(0 23 1 * ? *)'
```

## How to Change Schedule

### Option 1: Update template.yaml

Edit `template.yaml`:

```yaml
Events:
  DailyReminder:
    Type: Schedule
    Properties:
      Schedule: 'cron(0 1 * * ? *)'  # Change this line
      Description: Trigger daily reminder at 10:00 AM JST
      Enabled: true
```

Then redeploy:
```bash
sam build
sam deploy
```

### Option 2: AWS Console

1. Go to AWS Console → EventBridge
2. Navigate to Rules
3. Find your rule (kintai-slackbot-...)
4. Click "Edit"
5. Update the schedule expression
6. Save changes

## Troubleshooting

### Check Current Schedule

Using AWS CLI:
```bash
aws events describe-rule --name <rule-name>
```

### Test Manually

Invoke Lambda directly:
```bash
aws lambda invoke \
  --function-name <function-name> \
  --payload '{"source":"aws.events","detail-type":"Scheduled Event"}' \
  response.json
```

### View Next Scheduled Runs

The AWS Console shows the next scheduled execution time in the EventBridge rule details.

## Important Notes

1. **UTC Only**: EventBridge always uses UTC. Account for time zone differences.
2. **Daylight Saving**: JST doesn't observe DST, so the offset is always +9 hours.
3. **? vs ***: Use `?` for day-of-month or day-of-week when using the other, use `*` for "any value"
4. **Testing**: Use `sam local invoke` to test without waiting for the schedule

## Resources

- [EventBridge Cron Expressions](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html#eb-cron-expressions)
- [Time Zone Converter](https://www.timeanddate.com/worldclock/converter.html)
