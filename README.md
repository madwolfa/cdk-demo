# Welcome to CDK TypeScript demo project

This is a demo project for CDK development with TypeScript (basic serverless application).

It will deploy the following resources (encrypted with CMK where applicable):

* VPC with private subnets (no internet access)
* VPC endpoints (gateway/interface)
* Public API Gateway (restricted access policy - allowlist)
* SQS integration for API Gateway
* Execution and access logging for API Gateway
* Lambda function (VPC)
* KMS key (CMK)
* SQS queue (with Lambda trigger)
* S3 bucket
* EC2 instance
* IAM roles and policies

## Prerequisites

* Node environment (16.x and higher)
* AWS account with unrestricted access

## Usage

1. Login/assume role in the target AWS account
2. Add source IP(s) to `allowlist` property inside `properties.json` file
3. Execute `npm i` to install Node dependencies
4. Execute `npm run deploy` to deploy CDK stack (~5 minutes)
5. Use the REST API endpoint URL to POST the following request:

    ```bash
    curl --location 'https://<API_ID>.execute-api.us-east-1.amazonaws.com/prod' \
    --header 'Content-Type: application/json' \
    --data '{"Subject": "Heck yeah", "Message": "STARTING EC2"}'
    ```

6. Observe API Gateway execution and access logs
7. Observe Lambda function execution log
8. Observe SQS messages saved into S3 bucket as `<message_id>.json` files
9. Observe shutdown EC2 instance start-up
10. Execute `npm run destroy` to destroy CDK stack

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
