import {
  S3Client,
  S3ServiceException,
  ListBucketsCommandInput,
  ListBucketsCommand,
  CreateBucketCommandInput,
  CreateBucketCommand,
  DeleteBucketCommandInput,
  DeleteBucketCommand,
} from '@aws-sdk/client-s3'

export async function listBuckets(client: S3Client) {
  const input: ListBucketsCommandInput = {}
  const command = new ListBucketsCommand(input)

  try {
    console.log('Listing S3 buckets:')
    const response = await client.send(command)
    const buckets = response.Buckets
    if (buckets) {
      for (const bucket of buckets) {
        console.log('Bucket name:', bucket.Name)
      }
    }
  } catch (err) {
    if (err instanceof S3ServiceException) {
      console.error(err.message)
    }
    else console.error(err)
  }
}

export async function createBucket(client: S3Client, bucket: string) {
  const input: CreateBucketCommandInput = { Bucket: bucket }
  const command = new CreateBucketCommand(input)

  try {
    console.log('Creating bucket:', bucket)
    const response = await client.send(command)
    console.log('Create bucket response:', response.$metadata.httpStatusCode)
  } catch (err) {
    if (err instanceof S3ServiceException) {
      console.error(err.message)
    }
    else console.error(err)
  }
}

export async function deleteBucket(client: S3Client, bucket: string) {
  const input: DeleteBucketCommandInput = { Bucket: bucket }
  const command = new DeleteBucketCommand(input)

  try {
    console.log('Deleting bucket:', bucket)
    const response = await client.send(command)
    console.log('Delete bucket response:', response.$metadata.httpStatusCode)
  } catch (err) {
    if (err instanceof S3ServiceException) {
      console.error(err.message)
    }
    else console.error(err)
  }
}