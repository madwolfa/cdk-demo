# Welcome to CDK TypeScript demo project

This is a demo project for CDK development with TypeScript (basic serverless application).

It will deploy the following resources (encrypted with CMK where applicable):

* VPC with isolated private subnets (no ingress/egress internet access)
* VPC endpoints (gateway/interface)
* API Gateway with public endpoint (use allowlist to restrict access)
* SQS backend integration for API Gateway
* Execution and access logging for API Gateway
* Lambda function (VPC)
* KMS key (CMK)
* SQS queue (with Lambda trigger)
* S3 bucket
* EC2 instance
* IAM roles and policies

## Prerequisites

* Node environment (NodeJS >=16.x, NPM)
* AWS account with unrestricted access

## Usage

1. Login/assume role in the target AWS account
2. To restrict API access, add source IP CIDR(s) to `allowlist` property inside `properties.json` file:

    ```json
    {
        "allowlist": [
            "10.0.0.1/32",
            "10.0.0.2/32"
        ]
    }
    ```

3. Execute `npm install` to install Node dependencies
4. Execute `npm run bootstrap` to bootstrap the target account
5. Execute `npm run deploy` to deploy CDK stack (~5 minutes)
6. Use the REST API endpoint URL to POST the following request:

    ```bash
    curl --location 'https://<API_ID>.execute-api.us-east-1.amazonaws.com/prod' \
    --header 'Content-Type: application/json' \
    --data '{"Subject": "Heck yeah", "Message": "STARTING EC2"}'
    ```

7. Observe API Gateway execution and access logs
8. Observe Lambda function execution log
9. Observe individual SQS messages saved into S3 bucket as `<message_id>.json` files
10. Observe shutdown EC2 instance start-up
11. Execute `npm run destroy` to destroy CDK stack

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
