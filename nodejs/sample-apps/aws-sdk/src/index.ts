//const INIT_START = Date.now();

import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';

import AWS from 'aws-sdk';

const s3 = new AWS.S3();

//console.log(">>>>> Handler has been initialized in", (Date.now() - INIT_START), 'milliseconds')

// eslint-disable-next-line @typescript-eslint/no-unused-vars
exports.handler = async (_event: APIGatewayProxyEvent, _context: Context) => {
  console.info('Serving lambda request.');
  console.log('Environment variables:', JSON.stringify(process.env));

  const result = await s3.listBuckets().promise();

  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: `Hello lambda - found ${result.Buckets?.length || 0} buckets`,
  };

  return response;
};
