using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using Amazon.DynamoDBv2.Model;
using Amazon.Lambda.Core;
using Amazon.Lambda.SQSEvents;
using Amazon.SQS.Model;
using static Amazon.Lambda.SQSEvents.SQSBatchResponse;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace SqsToDynamoDbLambda
{
    public class Function
    {
        private const string DynamoDbTableEnvName = "DYNAMODB_TBL";

        private readonly AmazonDynamoDBClient _dynamoDbClient;

        public Function()
        {
            _dynamoDbClient = new AmazonDynamoDBClient();
        }

        public async Task<SQSBatchResponse> FunctionHandler(SQSEvent sqsEvent, ILambdaContext context)
        {
            List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new List<SQSBatchResponse.BatchItemFailure>();
            foreach (var record in sqsEvent.Records)
            {
                string messageId = record.MessageId;
                string messageBody = record.Body;

                context.Logger.Log($"Received message - MessageId: {messageId}, Body: {messageBody}");

                // Put message into DynamoDB
                try
                {
                    await PutMessageIntoDynamoDb(messageBody);
                }
                catch (System.Exception)
                {
                    //Add failed message identifier to the batchItemFailures list
                    batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure { ItemIdentifier = record.MessageId });
                }
            }
            return new SQSBatchResponse(batchItemFailures);
        }

        private async Task PutMessageIntoDynamoDb(string messageBody)
        {
            string dynamoDbTableName = Environment.GetEnvironmentVariable(DynamoDbTableEnvName);

            var table = Table.LoadTable(_dynamoDbClient, dynamoDbTableName);

            var document = new Document();
            document["id"] = messageBody;

            var putItemOperationConfig = new PutItemOperationConfig
            {
                ConditionalExpression = new Expression
                {
                    ExpressionStatement = "attribute_not_exists(id)"
                }
            };
            try
            {
                await table.PutItemAsync(document, putItemOperationConfig);
            }
            catch (ConditionalCheckFailedException)
            {
                // Handle the case where the item with the same 'id' already exists
                Console.WriteLine($"Item with the same 'id' already exists. Skipping");
            }
            await Task.CompletedTask;

        }
    }
}
