import {Construct} from "constructs"
import {App, TerraformStack, S3Backend, TerraformAsset, AssetType, Fn, Token} from "cdktf"
import {AwsProvider} from "@cdktf/provider-aws/lib/provider"
import {SqsQueue} from "@cdktf/provider-aws/lib/sqs-queue"
import * as path from 'path'
import {endpoints} from "./ls-endpoints"
import {TerraformOutput} from "cdktf/lib"
import {S3Bucket,} from "@cdktf/provider-aws/lib/s3-bucket"
import * as aws from "@cdktf/provider-aws"
import * as random from "@cdktf/provider-random"
import {LambdaEventSourceMapping} from "@cdktf/provider-aws/lib/lambda-event-source-mapping"


(async () => {

    interface MyMultiStackConfig {
        isLocal: boolean;
        environment: string;
        handler: string;
        sqstoddblambdaHandler: string;
        runtime: string;
        hotreloadLambdaPath: string;
        sqstoddblambdaHotreloadLambdaPath: string;
        listBucketName: string;
        version: string;
        region?: string;
    }

    class MyStack extends TerraformStack {
        constructor(scope: Construct, id: string, config: MyMultiStackConfig) {
            super(scope, id)
            console.log('config', config)

            let arch = 'arm64'
            const localArch = process.env.LOCAL_ARCH

            if (config.isLocal && localArch == 'x86_64') {
                arch = 'x86_64'
            }
            const lambdaDeployDir: string = path.resolve() + '/../../../app'
            // const dockerAppHash: string = await hashFolder(dockerAppDir);
            console.log(lambdaDeployDir)

            // Create NullProvider to run CMD Line
            // new Null.provider.NullProvider(this, 'Null');
            new random.provider.RandomProvider(this, "random")

            // define resources here
            if (config.isLocal) {
                console.log("LocalStack Deploy")
                // LocalStack AWS Provider
                new AwsProvider(this, "AWS", {
                    region: config.region,
                    accessKey: 'test',
                    secretKey: 'test',
                    s3UsePathStyle: true,
                    endpoints: endpoints
                })


            } else {
                console.log("AWS Deploy")
                // AWS Live Deploy
                // Use S3Backend
                new S3Backend(this, {
                    bucket: process.env.TERRAFORM_STATE_BUCKET ?? '',
                    key: id,
                    region: config.region
                })
                // Use AWS Provider with no LocalStack overrides
                new AwsProvider(this, "AWS", {
                    region: config.region
                })
            }
            // Bucket the lambda is going to get a list of objects from
            const listBucket = new S3Bucket(this, "list-bucket", {
                bucket: config.listBucketName,

            })

            // Create a DynamoDB table with a primary key named 'id'
            const ddbTable = new aws.dynamodbTable.DynamodbTable(this, "table", {
                name: "livedebug-table",
                attribute: [
                    {
                        name: "id",
                        type: "S",
                    },
                ],
                hashKey: "id",
                readCapacity: 10,
                writeCapacity: 10,
                tags: {
                    Environment: "dev",
                },
            })

            const terraformQueueDeadletter = new SqsQueue(
                this,
                "terraform_queue_deadletter",
                {
                    name: "terraform-example-deadletter-queue",
                }
            )
            const terraformQueue = new SqsQueue(this, "terraform_queue", {
                name: "terraform-example-queue",
                redrivePolicy: Token.asString(
                    Fn.jsonencode({
                        deadLetterTargetArn: terraformQueueDeadletter.arn,
                        maxReceiveCount: 4,
                    })
                ),
            })

            const lambdaAssumeRolePolicy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Action": "sts:AssumeRole",
                        "Principal": {
                            "Service": "lambda.amazonaws.com"
                        },
                        "Effect": "Allow",
                        "Sid": ""
                    },
                ]
            }

            const lambdaListBucketPolicy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Action": ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl"],
                        "Sid": "AllowAccessObjectsToS3",
                        "Effect": "Allow",
                        "Resource": [`${terraformQueue.arn}`],
                    },
                    {
                        "Effect": "Allow",
                        "Sid": "AllowAccessObjectsToSQS",
                        "Action": ["s3:ListBucket"],
                        "Resource": [`${listBucket.arn}/*`, listBucket.arn],
                    },
                    // policy for Lambda to write to ddbTable
                    {
                        "Effect": "Allow",
                        "Action": [
                            "dynamodb:DescribeTable",
                            "dynamodb:BatchGetItem",
                            "dynamodb:GetItem",
                            "dynamodb:Query",
                            "dynamodb:Scan",
                            "dynamodb:BatchWriteItem",
                            "dynamodb:PutItem",
                            "dynamodb:UpdateItem",
                            "dynamodb:DeleteItem"
                        ],
                        "Resource": [
                            `${ddbTable.arn}`,
                            `${ddbTable.arn}/*`
                        ],
                        "Sid": "AllowAccessToDynamoDB"
                    },
                ]
            }


            // Create Lambda archive
            const asset = new TerraformAsset(this, "lambda-asset", {
                path: config.hotreloadLambdaPath,
                type: AssetType.ARCHIVE, // if left empty it infers directory and file
            })

            // Create SqsToDdb Lambda archive
            const sqstoddbAsset = new TerraformAsset(this, "sqstoddb-asset", {
                path: config.sqstoddblambdaHotreloadLambdaPath,
                type: AssetType.ARCHIVE, // if left empty it infers directory and file
            })

            // Create unique S3 bucket that hosts Lambda executable
            const bucket = new aws.s3Bucket.S3Bucket(this, "lambda-bucket", {
                bucketPrefix: `${config.listBucketName}-lambda`
            })

            // Upload Lambda zip file to newly created S3 bucket
            const lambdaArchive = new aws.s3Object.S3Object(this, "lambda-archive", {
                bucket: bucket.bucket,
                key: `${config.version}/${asset.fileName}`,
                source: asset.path, // returns a posix path
            })

            const sqstoddbLambdaArchive = new aws.s3Object.S3Object(this, "sqstoddb-archive", {
                bucket: bucket.bucket,
                key: `${config.version}/${sqstoddbAsset.fileName}`,
                source: sqstoddbAsset.path, // returns a posix path
            })

            // Create Lambda role
            const role = new aws.iamRole.IamRole(this, "lambda-exec", {
                name: `livedebug-role`,
                assumeRolePolicy: JSON.stringify(lambdaAssumeRolePolicy)
            })

            // Add ListBucket policy to Lambda role
            new aws.iamRolePolicy.IamRolePolicy(this, "lambda-rolepolicy", {
                role: role.name,
                policy: JSON.stringify(lambdaListBucketPolicy)
            })

            // Add execution role for lambda to write to CloudWatch logs
            new aws.iamRolePolicyAttachment.IamRolePolicyAttachment(this, "lambda-managed-policy", {
                policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
                role: role.name
            })

            // Default to LocalStack hot-reload magic bucket name and prefix to docker mountable path
            let lambdaBucketName = 'hot-reload'
            let lambdaS3Key = config.hotreloadLambdaPath
            let sqstoddbLambdaS3Key = config.sqstoddblambdaHotreloadLambdaPath
            // If not Local, use actual S3 bucket and key
            if (!config.isLocal) {
                lambdaBucketName = bucket.bucket
                lambdaS3Key = lambdaArchive.key
                sqstoddbLambdaS3Key = sqstoddbLambdaArchive.key
            }

            // Create Lambda function
            const lambdaFunc = new aws.lambdaFunction.LambdaFunction(this, "livedebug-lambda", {
                functionName: `livedebug-lambda`,
                architectures: [arch],
                s3Bucket: lambdaBucketName,
                timeout: 15,
                s3Key: lambdaS3Key,
                handler: config.handler,
                runtime: config.runtime,
                environment: {
                    variables: {
                        'BUCKET': listBucket.bucket,
                        SQS_QUEUE: terraformQueue.url, // Pass SQS queue URL as an environment variable
                    }
                },
                role: role.arn
            })

            // Create SqsToDDB Lambda function
            const sqstoddbLambdaFunc = new aws.lambdaFunction.LambdaFunction(this, "sqstoddb-lambda", {
                functionName: `sqstoddb-lambda`,
                architectures: [arch],
                s3Bucket: lambdaBucketName,
                timeout: 15,
                s3Key: sqstoddbLambdaS3Key,
                handler: config.sqstoddblambdaHandler,
                runtime: config.runtime,
                environment: {
                    variables: {
                        DYNAMODB_TBL: ddbTable.name, // Pass DynamoDB table name as an environment variable
                    }
                },
                role: role.arn
            })
            new LambdaEventSourceMapping(this, "example", {
                eventSourceArn: Token.asString(terraformQueue.arn),
                functionName: Token.asString(sqstoddbLambdaFunc.arn),
                enabled: true,
                batchSize: 10,
                functionResponseTypes: ['ReportBatchItemFailures'],
            })

            // NOT BINDING THE LAMBDA TO APIGW NOW
            // Create and configure API gateway
            // const api = new aws.apigatewayv2Api.Apigatewayv2Api(this, "livedebug", {
            //     name: 'livedebug-api',
            //     protocolType: "HTTP",
            //     target: lambdaFunc.arn
            // });
            //
            // new aws.lambdaPermission.LambdaPermission(this, "apigw-lambda", {
            //     functionName: lambdaFunc.functionName,
            //     action: "lambda:InvokeFunction",
            //     principal: "apigateway.amazonaws.com",
            //     sourceArn: `${api.executionArn}/*/*`,
            // });
            //
            // new TerraformOutput(this, 'apigwUrl', {
            //     value: api.apiEndpoint
            // });


            // Output the Lambda function name
            new TerraformOutput(this, "lambdaFuncName", {
                value: lambdaFunc.functionName,
            })
            // Output the SqsToDDB Lambda function name
            new TerraformOutput(this, "sqstoddbLambdaFuncName", {
                value: sqstoddbLambdaFunc.functionName,
            })
            // Output the S3 bucket name
            new TerraformOutput(this, "bucketName", {
                value: listBucket.bucket,
            })
        }
    }


    const app = new App()
    new MyStack(app, "LsLambdaSample.local", {
        isLocal: true,
        environment: 'local',
        handler: 's3utillambda::s3utillambda.Function::FunctionHandler',
        sqstoddblambdaHandler: 'sqstoddblambda::SqsToDynamoDbLambda.Function::FunctionHandler',
        runtime: 'dotnet6',
        hotreloadLambdaPath: '/tmp/hot-reload/lambdas/dotnetlambda',
        sqstoddblambdaHotreloadLambdaPath: '/tmp/hot-reload/lambdas/sqstoddblambda',
        listBucketName: `sample-bucket`,
        version: '0.0.1',
        region: 'us-east-1'
    })
    new MyStack(app, "LsLambdaSample.non", {
        isLocal: false,
        environment: 'non',
        handler: 's3utillambda::s3utillambda.Function::FunctionHandler',
        sqstoddblambdaHandler: 'sqstoddblambda::SqsToDynamoDbLambda.Function::FunctionHandler',
        runtime: 'dotnet6',
        hotreloadLambdaPath: '/tmp/hot-reload/lambdas/dotnetlambda',
        sqstoddblambdaHotreloadLambdaPath: '/tmp/hot-reload/lambdas/sqstoddblambda',
        listBucketName: process.env.LIST_BUCKET_NAME || 'placeholder-bucket',
        version: '0.0.1',
        region: 'us-east-1'
    })
    app.synth()
})().catch(e => {
    // Deal with the fact the chain failed
    console.error(e)
})

