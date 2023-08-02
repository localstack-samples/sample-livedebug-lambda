import {Construct} from "constructs";
import {App, TerraformStack, S3Backend} from "cdktf";
import {AwsProvider} from "@cdktf/provider-aws/lib/provider";
import {EcrRepository} from "@cdktf/provider-aws/lib/ecr-repository"
import * as Null from "@cdktf/provider-null";
import * as path from 'path';
import {hashFolder} from "./hashing";
import {endpoints} from "./ls-endpoints";
import {TerraformOutput} from "cdktf/lib";

(async () => {

    const dockerAppDir: string = path.resolve() + '/../../../app';
    const dockerAppHash: string = await hashFolder(dockerAppDir);
    console.log(dockerAppHash);

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
            // Create ECR Repository
            const myecr = new EcrRepository(this, 'myrepo', {
                name: 'myrepo',
                imageScanningConfiguration: {scanOnPush: true},
                // Use forceDelete to allow deleting repo when images are in it
                forceDelete: true,
                tags: {
                    environment: config.environment,
                }
            });
            // resource that runs the docker build and deploy commands
            const buildAndPush = new Null.resource.Resource(this, 'buildAndPush', {
                dependsOn: [myecr],
                triggers: {folderHash: dockerAppHash},
            });
            // Docker build and push
            let command = `
      cd ${dockerAppDir} && docker build -t ${myecr.repositoryUrl} . &&
      docker push ${myecr.repositoryUrl}
    `;
            // If NOT on LocalStack, assume AWS and prepend login
            // needs AWS CLI v2
            if (!config.isLocal) {
                command = `
      aws ecr get-login-password --region ${config.region} |
      docker login --username AWS --password-stdin ${myecr.repositoryUrl} &&
      ` + command;
            }
            buildAndPush.addOverride('provisioner.local-exec.command', command);

            // Output the ECR Repository URL
            new TerraformOutput(this, "myimageUrl", {
                value: myecr.repositoryUrl,
            });

        }
    }


    const app = new App();
    new MyStack(app, "lsecr.local", {
        isLocal: true,
        environment: 'local',
        region: 'us-east-1'
    });
    new MyStack(app, "lsecr.non", {
        isLocal: false,
        environment: 'non',
        region: 'us-east-1'
    });
    app.synth();
})().catch(e => {
    // Deal with the fact the chain failed
    console.error(e);
});

