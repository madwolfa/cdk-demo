import { PutObjectCommand, PutObjectCommandInput, S3Client, S3ServiceException } from '@aws-sdk/client-s3'
import { StartInstancesCommand, StartInstancesCommandInput, EC2Client, EC2ServiceException } from '@aws-sdk/client-ec2'

import { SQSEvent } from 'aws-lambda'

// Extract environment variables
const region = process.env.AWS_REGION
const bucket = process.env.BUCKET_NAME
const instance = process.env.INSTANCE_ID ?? ''

// Initiate clients outside Lambda handler for runtime caching
const s3_client = new S3Client({region})
const ec2_client = new EC2Client({region})

export async function main(event: SQSEvent) {
  // Extract messages from SQS event
  const messages = event.Records.map(record => {
    const body = JSON.parse(record.body) as { Subject: string; Message: string}
    return {id: record.messageId, subject: body.Subject, message: body.Message}
  })

  // Process SQS messages
  for (const message of messages) {
    console.log('DEBUG:', message)

    // Initiate S3 'PutObject' command
    const input: PutObjectCommandInput = {
      Bucket: bucket,
      Key: `${message.id}.json`,
      Body: Buffer.from(JSON.stringify(message)),
    }
    const command = new PutObjectCommand(input)

    // Write SQS message into S3 bucket
    try {
      console.log('Writing file: ' + message.id + ' to S3 bucket: ' + bucket)
      // Call API 'send' operation with command input object
      await s3_client.send(command)
    } catch (error) {
      if (error instanceof S3ServiceException) {
        console.error('S3 exception', error.message)
      } else {
        console.error('Unknown exception', error)
      } 
    }
  }

  // Initiate EC2 'StartInstances' command
  const input: StartInstancesCommandInput = {
    InstanceIds: [instance],
    DryRun: false,
  }
  const command = new StartInstancesCommand(input)

  // Start EC2 instance
  try {
    console.log('Starting instance:', instance)
    // Call API 'send' operation with command input object
    const resp = await ec2_client.send(command)
    console.log('[DEBUG]: EC2 response:', JSON.stringify(resp))
  } catch (error) {
    if (error instanceof EC2ServiceException) {
      console.error('Unknown exception', error.message)
    } else {
      console.error('EC2 exception', error)
    } 
  }

  // Return successful response to API GW
  return {
    body: JSON.stringify({messages}),
    statusCode: 200,
  }
}
