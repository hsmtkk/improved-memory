import { Construct } from "constructs";
import { App, S3Backend, TerraformStack } from "cdktf";
import * as aws from "@cdktf/provider-aws";

const REGION = "ap-northeast-1";
const UNIQUE_STR = "202305161645";
const TERRAFORM_BACKEND = `pragmatic-terraform-backend-${UNIQUE_STR}`;

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new S3Backend(this, {
      bucket: TERRAFORM_BACKEND,
      key: "backend",
      region: REGION,
    });

    new aws.provider.AwsProvider(this, "aws", {
      region: REGION,
    });

    const awsAccountID = (new aws.dataAwsCallerIdentity.DataAwsCallerIdentity(this, "aws-account")).accountId;
    
    const privateBucket = new aws.s3Bucket.S3Bucket(this, "private-bucket", {
      bucket: `private-bucket-${UNIQUE_STR}`,
      forceDestroy: true,
    });

    new aws.s3BucketServerSideEncryptionConfiguration.S3BucketServerSideEncryptionConfigurationA(this, "private-bucket-encrypt", {
      bucket: privateBucket.id,
      rule: [{
        applyServerSideEncryptionByDefault: {
          sseAlgorithm: "AES256",
        },
      }],
    });

    new aws.s3BucketVersioning.S3BucketVersioningA(this, "private-bucket-versioning", {
      bucket: privateBucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });

    new aws.s3BucketPublicAccessBlock.S3BucketPublicAccessBlock(this, "private-bucket-block-public", {
      bucket: privateBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    const publicBucket = new aws.s3Bucket.S3Bucket(this, "public-bucket", {
      bucket: `public-bucket-${UNIQUE_STR}`,
      forceDestroy: true,
    });

    new aws.s3BucketOwnershipControls.S3BucketOwnershipControls(this, "public-bucket-owner-control", {
      bucket: publicBucket.id,
      rule: {
        objectOwnership: "BucketOwnerPreferred",
      },
    });

    new aws.s3BucketAcl.S3BucketAcl(this, "public-bucket-acl", {
      bucket: publicBucket.id,
      acl: "public-read",
    });

    new aws.s3BucketCorsConfiguration.S3BucketCorsConfiguration(this, "public-bucket-cors", {
      bucket: publicBucket.id,
      corsRule: [{
        allowedOrigins: ["https://example.com"],
        allowedMethods: ["GET"],
        allowedHeaders: ["*"],
        maxAgeSeconds: 3000,
      }],
    });

    const albLogBucket = new aws.s3Bucket.S3Bucket(this, "alb-log-bucket", {
      bucket: `alb-log-${UNIQUE_STR}`,
      forceDestroy: true,
    });

    new aws.s3BucketLifecycleConfiguration.S3BucketLifecycleConfiguration(this, "alb-log-bucket-lifecycle-rule", {
      bucket: albLogBucket.id,
      rule: [{
        id: "rule-1",
        status: "Enabled",
        expiration: {
          days: 180,
        },
      }],
    });

    const albLogPolicyDocument = new aws.dataAwsIamPolicyDocument.DataAwsIamPolicyDocument(this, "alb-log-policy-document", {
      statement: [{
        effect: "Allow",
        actions: ["s3:PutObject"],
        resources: [`arn:aws:s3:::${albLogBucket.id}/*`],
        principals: [{
          type: "AWS",
          identifiers: [`${awsAccountID}`],
        }],
      }],
    });

    new aws.s3BucketPolicy.S3BucketPolicy(this, "alb-log-bucket-policy", {
      bucket: albLogBucket.id,
      policy: albLogPolicyDocument.json,
    });

  }
}

const app = new App();
new MyStack(app, "improved-memory");
app.synth();
