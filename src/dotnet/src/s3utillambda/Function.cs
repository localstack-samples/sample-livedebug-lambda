using System;
using Amazon.Lambda.Core;
using Amazon.Lambda.S3Events;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace s3utillambda;

public class Function
{

    private const string BucketVariableName = "BUCKET";

    private AmazonS3Client GetS3Client(ILambdaContext context) {
        return new AmazonS3Client();
    }


    /// <summary>
    /// A simple function that takes a string and does a ToUpper
    /// </summary>
    /// <param name="input"></param>
    /// <param name="context"></param>
    /// <returns></returns>
    public async Task<List<S3Object>> FunctionHandler(S3Event s3Event, ILambdaContext context)
    {

        // Check the environment variable
        string bucketName = Environment.GetEnvironmentVariable(BucketVariableName);
        context.Logger.Log($"bucketName {bucketName}\n");
        AmazonS3Client _s3Client = GetS3Client(context);
        context.Logger.Log($"Testing 1 2 3\n");
        var listObjectsRequest = new ListObjectsRequest
        {
            BucketName = bucketName
        };

        var response = await _s3Client.ListObjectsAsync(listObjectsRequest);
        return response.S3Objects;
    }
}
