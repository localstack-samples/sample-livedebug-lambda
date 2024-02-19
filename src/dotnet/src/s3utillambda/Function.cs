using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Amazon.Lambda.Core;
using Amazon.Lambda.S3Events;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.SQS;
using Amazon.SQS.Model;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace s3utillambda
{
    public class Function
    {
        private const string BucketVariableName = "BUCKET";
        private const string SqsQueueVariableName = "SQS_QUEUE"; // New constant for SQS queue environment variable

        private AmazonS3Client GetS3Client(ILambdaContext context)
        {
            return new AmazonS3Client();
        }

        private AmazonSQSClient GetSqsClient(ILambdaContext context)
        {
            return new AmazonSQSClient();
        }

        public async Task<List<S3Object>> FunctionHandler(S3Event s3Event, ILambdaContext context)
        {
            // Check the environment variables
            string bucketName = Environment.GetEnvironmentVariable(BucketVariableName);
            string sqsQueueUrl = Environment.GetEnvironmentVariable(SqsQueueVariableName);

            context.Logger.Log($"bucketName: {bucketName}\n");
            context.Logger.Log($"sqsQueueUrl: {sqsQueueUrl}\n");

            AmazonS3Client s3Client = GetS3Client(context);
            AmazonSQSClient sqsClient = GetSqsClient(context);

            var listObjectsRequest = new ListObjectsRequest
            {
                BucketName = bucketName
            };

            var response = await s3Client.ListObjectsAsync(listObjectsRequest);

            foreach (var s3Object in response.S3Objects)
            {
                // Put each S3 object key into the SQS queue
                await sqsClient.SendMessageAsync(new SendMessageRequest
                {
                    QueueUrl = sqsQueueUrl,
                    MessageBody = s3Object.Key
                });
            }

            return response.S3Objects;
        }
    }
}
