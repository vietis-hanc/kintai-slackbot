const { App, AwsLambdaReceiver } = require('@slack/bolt');
const AWS = require('aws-sdk');

// Initialize AWS SSM Parameter Store client
const ssm = new AWS.SSM();
const PARAMETER_NAME = '/kintai-slackbot/reminder-ts';

// Initialize the Slack Bolt receiver for AWS Lambda
const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Initialize the Slack Bolt app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: awsLambdaReceiver,
});

// Store the reminder message timestamp in SSM Parameter Store
async function storeReminderTimestamp(ts) {
  try {
    await ssm.putParameter({
      Name: PARAMETER_NAME,
      Value: ts,
      Type: 'String',
      Overwrite: true,
    }).promise();
    console.log(`Stored reminder timestamp: ${ts}`);
  } catch (error) {
    console.error('Error storing timestamp:', error);
  }
}

// Retrieve the reminder message timestamp from SSM Parameter Store
async function getReminderTimestamp() {
  try {
    const result = await ssm.getParameter({
      Name: PARAMETER_NAME,
    }).promise();
    return result.Parameter.Value;
  } catch (error) {
    console.error('Error retrieving timestamp:', error);
    return null;
  }
}

// Function to send daily reminder
async function sendDailyReminder() {
  try {
    const channelId = process.env.SLACK_CHANNEL_ID;
    
    // Send the reminder message with interactive buttons
    const result = await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId,
      text: 'Reminder: 今日勤怠連絡をお願いします。',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Reminder: 今日勤怠連絡をお願いします。',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'オフィス出勤',
              },
              action_id: 'office_checkin',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'リモート出勤',
              },
              action_id: 'remote_checkin',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'オフィス退勤',
              },
              action_id: 'office_checkout',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'リモート退勤',
              },
              action_id: 'remote_checkout',
            },
          ],
        },
      ],
    });

    // Store the message timestamp for thread replies
    if (result.ts) {
      await storeReminderTimestamp(result.ts);
    }

    console.log('Daily reminder sent successfully:', result.ts);
    return { statusCode: 200, body: 'Reminder sent successfully' };
  } catch (error) {
    console.error('Error sending reminder:', error);
    return { statusCode: 500, body: 'Error sending reminder' };
  }
}

// Helper function to get current time in JST formatted as HH:ii
function getCurrentTimeJST() {
  const now = new Date();
  // Convert to JST (UTC+9)
  const jstOffset = 9 * 60; // 9 hours in minutes
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const jstTime = new Date(utcTime + (jstOffset * 60000));
  
  const hours = String(jstTime.getHours()).padStart(2, '0');
  const minutes = String(jstTime.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

// Handle button clicks
app.action('office_checkin', async ({ body, ack, client }) => {
  await ack();
  
  const userId = body.user.id;
  const time = getCurrentTimeJST();
  const threadTs = await getReminderTimestamp();
  
  try {
    await client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel.id,
      thread_ts: threadTs || body.message.ts,
      text: `<@${userId}> ${time}にオフィス勤務を開始します。`,
    });
  } catch (error) {
    console.error('Error posting message:', error);
  }
});

app.action('remote_checkin', async ({ body, ack, client }) => {
  await ack();
  
  const userId = body.user.id;
  const time = getCurrentTimeJST();
  const threadTs = await getReminderTimestamp();
  
  try {
    await client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel.id,
      thread_ts: threadTs || body.message.ts,
      text: `<@${userId}> ${time}にリモート勤務を開始します。`,
    });
  } catch (error) {
    console.error('Error posting message:', error);
  }
});

app.action('office_checkout', async ({ body, ack, client }) => {
  await ack();
  
  const userId = body.user.id;
  const time = getCurrentTimeJST();
  const threadTs = await getReminderTimestamp();
  
  try {
    await client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel.id,
      thread_ts: threadTs || body.message.ts,
      text: `<@${userId}> ${time}にオフィス勤務を終了します。`,
    });
  } catch (error) {
    console.error('Error posting message:', error);
  }
});

app.action('remote_checkout', async ({ body, ack, client }) => {
  await ack();
  
  const userId = body.user.id;
  const time = getCurrentTimeJST();
  const threadTs = await getReminderTimestamp();
  
  try {
    await client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel.id,
      thread_ts: threadTs || body.message.ts,
      text: `<@${userId}> ${time}にリモート勤務を終了します。`,
    });
  } catch (error) {
    console.error('Error posting message:', error);
  }
});

// Lambda handler
module.exports.handler = async (event, context, callback) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Check if this is a scheduled event (from EventBridge)
  if (event.source === 'aws.events' || event['detail-type'] === 'Scheduled Event') {
    console.log('Scheduled event detected, sending daily reminder...');
    return await sendDailyReminder();
  }
  
  // Otherwise, handle Slack events/interactions
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
};
