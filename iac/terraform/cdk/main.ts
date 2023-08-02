import {Construct} from "constructs";
import {App, TerraformStack, S3Backend} from "cdktf";
import {AwsProvider} from "@cdktf/provider-aws/lib/provider";
// import {EcrRepository} from "@cdktf/provider-aws/lib/ecr-repository"
import * as Null from "@cdktf/provider-null";
// import * as path from 'path';
// import {hashFolder} from "./hashing";
import {endpoints} from "./ls-endpoints";
import {TerraformOutput} from "cdktf/lib";
import {S3Bucket} from "@cdktf/provider-aws/lib/s3-bucket";

(async () => {

    // const dockerAppDir: string = path.resolve() + '/../../../app';
    // const dockerAppHash: string = await hashFolder(dockerAppDir);
    // console.log(dockerAppHash);

    interface MyMultiStackConfig {
        isLocal: boolean;
        environment: string;
        region?: string;
    }


    class MyStack extends TerraformStack {
        constructor(scope: Construct, id: string, config: MyMultiStackConfig) {
            super(scope, id);
            console.log('config', config);
            // Create NullProvider to run CMD Line
            new Null.provider.NullProvider(this, 'Null');

            // define resources here
            if (config.isLocal) {
                console.log("LocalStack Deploy");
                // LocalStack AWS Provider
                new AwsProvider(this, "AWS", {
                    region: config.region,
                    accessKey: 'test',
                    secretKey: 'test',
                    s3UsePathStyle: true,
                    endpoints: endpoints
                });


            } else {
                console.log("AWS Deploy");
                // AWS Live Deploy
                // Use S3Backend
                new S3Backend(this, {
                    bucket: process.env.TERRAFORM_STATE_BUCKET ?? '',
                    key: id,
                    region: config.region
                });
                // Use AWS Provider with no LocalStack overrides
                new AwsProvider(this, "AWS", {
                    region: config.region
                });
            }

            const sampleBucket = new S3Bucket(this, "sample-bucket", {
                bucket: "sample-bucket"
            });

            // Output the ECR Repository URL
            new TerraformOutput(this, "bucketName", {
                value: sampleBucket.bucket,
            });

        }
    }


    const app = new App();
    new MyStack(app, "LsLambdaSample.local", {
        isLocal: true,
        environment: 'local',
        region: 'us-east-1'
    });
    new MyStack(app, "LsLambdaSample.non", {
        isLocal: false,
        environment: 'non',
        region: 'us-east-1'
    });
    app.synth();
})().catch(e => {
    // Deal with the fact the chain failed
    console.error(e);
});

