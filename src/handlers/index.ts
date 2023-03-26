import { PutObjectCommand, PutObjectCommandInput, S3Client, S3ServiceException } from '@aws-sdk/client-s3'
import { StartInstancesCommand, StartInstancesCommandInput, EC2Client, EC2ServiceException } from '@aws-sdk/client-ec2'

import { SQSEvent } from 'aws-lambda'

// Extract environment variables
const region = process.env.AWS_REGION
const bucket = process.env.BUCKET_NAME
const instance = process.env.INSTANCE_ID ?? ''

// Create SDK clients outside Lambda handler for runtime caching
const s3_client = new S3Client({region})
const ec2_client = new EC2Client({region})

export async function main(event: SQSEvent) {
  // Extract messages from SQS events
  const messages = event.Records.map(record => {
    const body = JSON.parse(record.body) as { Subject: string; Message: string}
    return {id: record.messageId, subject: body.Subject, message: body.Message}
  })

  // Process SQS messages
  for (const message of messages) {
    console.log('DEBUG:', message)

    // Create AWS S3 SDK 'PutObject' command input
    const input: PutObjectCommandInput = {
      Bucket: bucket,
      Key: `${message.id}.json`,
      Body: Buffer.from(JSON.stringify(message)),
    }
    const command = new PutObjectCommand(input)

    // Write SQS messages into S3 bucket
    try {
      console.log('Writing file: ' + message.id + ' to S3 bucket: ' + bucket)
      // Send API command
      await s3_client.send(command)
    } catch (error) {
      if (error instanceof S3ServiceException) {
        console.error('S3 exception', error.message)
      } else {
        console.error('Unknown exception', error)
      } 
    }
  }

  // Create AWS EC2 SDK 'StartInstances' command input
  const input: StartInstancesCommandInput = {
    InstanceIds: [instance],
    DryRun: false,
  }
  const command = new StartInstancesCommand(input)

  // Start EC2 instance
  try {
    console.log('Starting instance:', instance)
    // Send API command
    const resp = await ec2_client.send(command)
    console.log('[DEBUG]: EC2 response:', JSON.stringify(resp))
  } catch (error) {
    if (error instanceof EC2ServiceException) {
      console.error('Unknown exception', error.message)
    } else {
      console.error('EC2 exception', error)
    } 
  }

  console.log('messages 👉', JSON.stringify(messages, null, 2))

  // Return successful response to API GW
  return {
    body: JSON.stringify({messages}),
    statusCode: 200,
  }
}
