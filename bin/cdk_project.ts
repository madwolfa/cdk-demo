#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { CdkProjectStack } from '../lib/cdk_project-stack'

const app = new cdk.App()
new CdkProjectStack(app, 'CdkProjectStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
})
