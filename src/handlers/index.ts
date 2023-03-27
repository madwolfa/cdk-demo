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
    console.log('[DEBUG]: SQS message:', message)

    // Define S3 'PutObject' command input parameters
    const input: PutObjectCommandInput = {
      Bucket: bucket,
      Key: `${message.id}.json`,
      Body: Buffer.from(JSON.stringify(message)),
    }
    // Initiate S3 'PutObject' command with input parameters
    const command = new PutObjectCommand(input)
    // Write SQS message into S3 bucket
    try {
      console.log('Writing file: ' + `'${command.input.Key}'` + ' to S3 bucket: ' + `'${command.input.Bucket}'`)
      // Call API 'send' operation on S3 client with command object as input
      const resp = await s3_client.send(command)
      console.log('[DEBUG]: S3 response:', JSON.stringify(resp))
    } catch (error) {
      if (error instanceof S3ServiceException) {
        console.error('S3 error', error.message)
      } else {
        console.error('Error', error)
      }
    }
  }

  // Define EC2 'StartInstances' command input parameters
  const input: StartInstancesCommandInput = {
    InstanceIds: [instance],
    DryRun: false,
  }
  // Initiate EC2 'StartInstances' command with input parameters
  const command = new StartInstancesCommand(input)

  // Start EC2 instance
  try {
    console.log('Starting instance:', `'${instance}'`)
    // Call API 'send' operation on EC2 client with command object as input
    const resp = await ec2_client.send(command)
    console.log('[DEBUG]: EC2 response:', JSON.stringify(resp))
  } catch (error) {
    if (error instanceof EC2ServiceException) {
      console.error('EC2 error', error.message)
    } else {
      console.error('Error', error)
    }
  }

  // Return successful response to API GW
  return {
    body: JSON.stringify({messages}),
    statusCode: 200,
  }
}
