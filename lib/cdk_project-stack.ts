import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdajs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as events from 'aws-cdk-lib/aws-lambda-event-sources'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

import fs from 'fs'
import path from 'path'

export class CdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Define config interface
    interface Config {
      allowlist: string[]
      instances: number
    }

    // Try reading config from the properties file
    let config: Config = {allowlist: [], instances: 0}
    try {
      config = JSON.parse(fs.readFileSync('properties.json', 'utf8'))
    } catch (err) {
      console.error(err)
    }

    // Create Lambda policy document
    const lambdaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['ec2:*'],
          resources: ['*'],
        }),         
        new iam.PolicyStatement({
          actions: ['s3:*'],
          resources: ['arn:aws:s3:::*'],
        }), 
        new iam.PolicyStatement({
          actions: ['sqs:*'],
          resources: ['arn:aws:sqs:*'],
        }),
        new iam.PolicyStatement({
          actions: ['kms:*'],
          resources: ['*'],
        }),
      ]
    })

    // Create Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        LambdaPolicy: lambdaPolicy,
      },
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(this, 'importedAWSLambdaBasicExecutionRole', 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole')
      ]
    })

    // Create APIGW policy document
    const apiGwPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['sqs:*'],
          resources: ['arn:aws:sqs:*'],
        }),
        new iam.PolicyStatement({
          actions: ['kms:*'],
          resources: ['*'],
        }),
      ]
    })
  
    // Create APIGW integration role
    const apiGwRole = new iam.Role(this, 'ApiGwRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      inlinePolicies: {
        ApiGwPolicy: apiGwPolicy,
      }
    })

    // Import EC2 SSM role
    // const ec2SsmRole = iam.Role.fromRoleArn(this, 'importedEc2SsmRole', `arn:aws:iam::${this.account}:role/AmazonSSMRoleForInstancesQuickSetup`)

    // Create private (isolated) VPC
    const myVpc = new ec2.Vpc(this, 'MyVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 3,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
          name: 'Private'
        }
      ],
      // Add S3 gateway endpoint
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3,
        },
      },
      enableDnsHostnames: true,
      enableDnsSupport: true,
    })

    // Add interface endpoints for other services
    myVpc.addInterfaceEndpoint('Ec2VpcEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.EC2
    })

    myVpc.addInterfaceEndpoint('SqsVpcEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SQS
    })

    // Below endpoints are only required for EC2 access via SSM Session Manager
    /* 
    myVpc.addInterfaceEndpoint('Ec2MsgVpcEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES
    })

    myVpc.addInterfaceEndpoint('SsmVpcEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM
    })

    myVpc.addInterfaceEndpoint('SsmMsgVpcEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES
    })
    */    

    // Create EC2 instance(s)
    const instances: string[] = []
    for (let i = 0; i < config.instances; i++) {
      const instance = new ec2.Instance(this, `MyInstance${i+1}`, {
        vpc: myVpc,
        instanceType: new ec2.InstanceType('m7g.medium'),
        machineImage: ec2.MachineImage.fromSsmParameter('/aws/service/ami-amazon-linux-latest/al2022-ami-kernel-default-arm64'),
        // role: ec2SsmRole,
      })
      instances.push(instance.instanceId)
    }

    // Create CMK
    const myKms = new kms.Key(this, 'MyKmsKey', {})

    // Create S3 bucket
    const myBucket = new s3.Bucket(this, 'MyBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: myKms,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // Create SQS queue
    const smallQueue = new sqs.Queue(this, 'SmallQueue', {
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: myKms,
    })

    // Create Lambda function (VPC)
    const myFunction = new lambdajs.NodejsFunction(this, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'main',
      role: lambdaRole,
      vpc: myVpc,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, '../src/handlers/index.ts'),
      // Pass bucket name and instance ids as environment variables
      environment: {
        BUCKET_NAME: myBucket.bucketName,
        INSTANCE_IDS: instances.length !== 0 ? instances.join(',') : '',
      }
    })
    // Add SQS queue as Lambda event source
    myFunction.addEventSource(new events.SqsEventSource(smallQueue))

    // Create SQS integration for APIGW
    const sqsBackend = new apigw.AwsIntegration({
      service: 'sqs',
      path: smallQueue.queueName,
      integrationHttpMethod: 'POST',
      options: {
        credentialsRole: apiGwRole,
        requestTemplates: {
          'application/json': 'Action=SendMessage&MessageBody=$input.body',
        },
        requestParameters: {
          'integration.request.header.Content-Type': '\'application/x-www-form-urlencoded\'',
        },
        passthroughBehavior: apigw.PassthroughBehavior.NEVER,
        integrationResponses: [
          {
            statusCode: '200',
          },
          {
            statusCode: '400',
          },
          {
            statusCode: '500',
          }
        ]
      }
    })

    // Create APIGW access policy
    const apiGwAccessPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          principals: [new iam.StarPrincipal()],
          actions: ['execute-api:Invoke'],
          resources: [`arn:aws:execute-api:${this.region}:${this.account}:*`],
        }),
      ]
    })

    // Deny ALL IPs except allowlisted in the properties file
    if (config.allowlist && config.allowlist.length !== 0) {
      apiGwAccessPolicy.addStatements(
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          principals: [new iam.StarPrincipal()],
          actions: ['execute-api:Invoke'],
          resources: [`arn:aws:execute-api:${this.region}:${this.account}:*`],
          conditions: {'NotIpAddress': {'aws:SourceIp': config.allowlist}},
        }),
      )
    }

    // Enable APIGW execution and access logging
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: '/aws/apigateway/my-api',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })
    const accessLogDestination = new apigw.LogGroupLogDestination(logGroup)
    const accessLogFormat = apigw.AccessLogFormat.jsonWithStandardFields()

    // Create APIGW (public access with allowlist)
    const api = new apigw.RestApi(this, 'MyApi', {
      policy: apiGwAccessPolicy,
      cloudWatchRole: true,
      deployOptions: {
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        accessLogDestination,
        accessLogFormat,
      },
    })
    // Add POST method to API root
    api.root.addMethod('POST', sqsBackend, {
      methodResponses: [
        { 
          statusCode: '200',
        },
        {
          statusCode: '400',
        },
        {
          statusCode: '500',
        }
      ]
    })

  }
}
