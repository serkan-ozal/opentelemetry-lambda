import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import {Span} from "@opentelemetry/api";

const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('handler');

import AWS from 'aws-sdk';

const s3 = new AWS.S3();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
exports.handler = async (_event: APIGatewayProxyEvent, _context: Context) => {
  return tracer.startActiveSpan('handle', async (span: Span) => {
    console.info('Serving lambda request.');

    /*
    span.end();

    return {
      statusCode: 200,
      body: `Hello lambda`,
    };
    */

    const result = await s3.listBuckets().promise();

    const response: APIGatewayProxyResult = {
      statusCode: 200,
      body: `Hello lambda - found ${result.Buckets?.length || 0} buckets`,
    };

    span.end();

    return response;
  });
};
