import {
  deactivate as deactivateModuleTracer,
  getRootTracedRequires,
  RequireTrace,
} from './module-load-tracer';

import {
  NodeTracerConfig,
  NodeTracerProvider,
  ReadableSpan,
} from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SDKRegistrationConfig,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  Instrumentation,
  registerInstrumentations,
} from '@opentelemetry/instrumentation';
import { awsLambdaDetector } from '@opentelemetry/resource-detector-aws';
import {
  detectResourcesSync,
  envDetector,
  processDetector,
} from '@opentelemetry/resources';
import {
  AwsInstrumentation,
  AwsSdkInstrumentationConfig,
} from '@opentelemetry/instrumentation-aws-sdk';
import {
  AwsLambdaInstrumentation,
  AwsLambdaInstrumentationConfig,
} from '@opentelemetry/instrumentation-aws-lambda';
import {
  AttributeValue,
  context as OTELContext,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  Span,
  SpanKind,
  trace,
  Tracer
} from '@opentelemetry/api';
import { getEnv, VERSION } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import {
  MeterProvider,
  MeterProviderOptions,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { getPropagator } from '@opentelemetry/auto-configuration-propagators';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
  ConsoleLogRecordExporter,
  LoggerProviderConfig,
} from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import {
  SEMATTRS_FAAS_COLDSTART,
  SEMATTRS_FAAS_EXECUTION,
  SEMRESATTRS_CLOUD_ACCOUNT_ID,
  SEMRESATTRS_FAAS_ID,
} from '@opentelemetry/semantic-conventions';
import { Context } from "aws-lambda";

const PACKAGE_NAME = '@opentelemetry/aws-lambda-wrapper';
const tracer: Tracer = trace.getTracer(PACKAGE_NAME, VERSION);

function defaultConfigureInstrumentations() {
  // Use require statements for instrumentation to avoid having to have transitive dependencies on all the typescript
  // definitions.
  const { DnsInstrumentation } = require('@opentelemetry/instrumentation-dns');
  const {
    ExpressInstrumentation,
  } = require('@opentelemetry/instrumentation-express');
  const {
    GraphQLInstrumentation,
  } = require('@opentelemetry/instrumentation-graphql');
  const {
    GrpcInstrumentation,
  } = require('@opentelemetry/instrumentation-grpc');
  const {
    HapiInstrumentation,
  } = require('@opentelemetry/instrumentation-hapi');
  const {
    HttpInstrumentation,
  } = require('@opentelemetry/instrumentation-http');
  const {
    IORedisInstrumentation,
  } = require('@opentelemetry/instrumentation-ioredis');
  const { KoaInstrumentation } = require('@opentelemetry/instrumentation-koa');
  const {
    MongoDBInstrumentation,
  } = require('@opentelemetry/instrumentation-mongodb');
  const {
    MySQLInstrumentation,
  } = require('@opentelemetry/instrumentation-mysql');
  const { NetInstrumentation } = require('@opentelemetry/instrumentation-net');
  const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg');
  const {
    RedisInstrumentation,
  } = require('@opentelemetry/instrumentation-redis');
  return [
    new DnsInstrumentation(),
    new ExpressInstrumentation(),
    new GraphQLInstrumentation(),
    new GrpcInstrumentation(),
    new HapiInstrumentation(),
    new HttpInstrumentation(),
    new IORedisInstrumentation(),
    new KoaInstrumentation(),
    new MongoDBInstrumentation(),
    new MySQLInstrumentation(),
    new NetInstrumentation(),
    new PgInstrumentation(),
    new RedisInstrumentation(),
  ];
}

function createRequireSpans(requireTrace: RequireTrace, parentSpan: Span) {
  if (requireTrace.ignored) {
    return;
  }

  const parentContext = trace.setSpan(OTELContext.active(), parentSpan);
  const requireSpan: Span =
    tracer.startSpan(
      requireTrace.moduleId,
      {
        startTime: requireTrace.startTimestamp,
        kind: SpanKind.INTERNAL,
      },
      parentContext
    );
  if (requireTrace.error) {
    requireSpan.recordException(requireTrace.error);
  }
  requireSpan.end(requireTrace.finishTimestamp);

  for (let childRequireTrace of requireTrace.children) {
    createRequireSpans(childRequireTrace, requireSpan);
  }
}

declare global {
  // in case of downstream configuring span processors etc
  function configureAwsInstrumentation(
    defaultConfig: AwsSdkInstrumentationConfig,
  ): AwsSdkInstrumentationConfig;
  function configureTracerProvider(tracerProvider: NodeTracerProvider): void;
  function configureTracer(defaultConfig: NodeTracerConfig): NodeTracerConfig;
  function configureSdkRegistration(
    defaultSdkRegistration: SDKRegistrationConfig,
  ): SDKRegistrationConfig;
  function configureInstrumentations(): Instrumentation[];
  function configureLoggerProvider(loggerProvider: LoggerProvider): void;
  function configureMeter(
    defaultConfig: MeterProviderOptions,
  ): MeterProviderOptions;
  function configureMeterProvider(meterProvider: MeterProvider): void;
  function configureLambdaInstrumentation(
    config: AwsLambdaInstrumentationConfig,
  ): AwsLambdaInstrumentationConfig;
  function configureInstrumentations(): Instrumentation[];
}

console.log('Registering OpenTelemetry');

const instrumentations = [
  new AwsInstrumentation(
    typeof configureAwsInstrumentation === 'function'
      ? configureAwsInstrumentation({ suppressInternalInstrumentation: true })
      : { suppressInternalInstrumentation: true },
  ),
  new AwsLambdaInstrumentation(
    typeof configureLambdaInstrumentation === 'function'
      ? configureLambdaInstrumentation({})
      : {
        requestHook: (span: Span, hookInfo: {
          event: any;
          context: Context;
        }): void => {
          const readableSpan: ReadableSpan = (span as any) as ReadableSpan;
          const coldStart: AttributeValue | undefined = readableSpan.attributes[SEMATTRS_FAAS_COLDSTART];
          if (coldStart === true) {
            const initContext = trace.setSpan(OTELContext.active(), span);
            const initSpan: Span = tracer.startSpan(
              'init',
              {
                startTime: readableSpan.startTime,
                kind: SpanKind.INTERNAL,
                attributes: {
                  [SEMATTRS_FAAS_EXECUTION]: readableSpan.attributes[SEMATTRS_FAAS_EXECUTION],
                  [SEMRESATTRS_FAAS_ID]: readableSpan.attributes[SEMRESATTRS_FAAS_ID],
                  [SEMRESATTRS_CLOUD_ACCOUNT_ID]: readableSpan.attributes[SEMRESATTRS_CLOUD_ACCOUNT_ID],
                },
              },
              initContext,
            );

            const rootTracedRequires: RequireTrace[] = getRootTracedRequires();
            deactivateModuleTracer();

            for (const rootTracedRequire of rootTracedRequires) {
              createRequireSpans(rootTracedRequire, initSpan);
            }

            initSpan.end(Date.now());
          }
        },
      }
  ),
  ...(typeof configureInstrumentations === 'function'
    ? configureInstrumentations
    : defaultConfigureInstrumentations)(),
];

// configure lambda logging
const logLevel = getEnv().OTEL_LOG_LEVEL;
diag.setLogger(new DiagConsoleLogger(), logLevel);

// Register instrumentations synchronously to ensure code is patched even before provider is ready.
registerInstrumentations({
  instrumentations,
});

async function initializeProvider() {
  const resource = detectResourcesSync({
    detectors: [awsLambdaDetector, envDetector, processDetector],
  });

  let config: NodeTracerConfig = {
    resource,
  };
  if (typeof configureTracer === 'function') {
    config = configureTracer(config);
  }

  const tracerProvider = new NodeTracerProvider(config);
  if (typeof configureTracerProvider === 'function') {
    configureTracerProvider(tracerProvider);
  } else {
    // defaults
    tracerProvider.addSpanProcessor(
      new BatchSpanProcessor(new OTLPTraceExporter()),
    );
  }
  // logging for debug
  if (logLevel === DiagLogLevel.DEBUG) {
    tracerProvider.addSpanProcessor(
      new SimpleSpanProcessor(new ConsoleSpanExporter()),
    );
  }

  let sdkRegistrationConfig: SDKRegistrationConfig = {};
  if (typeof configureSdkRegistration === 'function') {
    sdkRegistrationConfig = configureSdkRegistration(sdkRegistrationConfig);
  }
  // auto-configure propagator if not provided
  if (!sdkRegistrationConfig.propagator) {
    sdkRegistrationConfig.propagator = getPropagator();
  }
  tracerProvider.register(sdkRegistrationConfig);

  // Configure default meter provider (doesn't export metrics)
  const metricExporter = new OTLPMetricExporter();
  let meterConfig: MeterProviderOptions = {
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
      }),
    ],
  };
  if (typeof configureMeter === 'function') {
    meterConfig = configureMeter(meterConfig);
  }

  const meterProvider = new MeterProvider(meterConfig);
  if (typeof configureMeterProvider === 'function') {
    configureMeterProvider(meterProvider);
  }

  const logExporter = new OTLPLogExporter();
  const loggerConfig: LoggerProviderConfig = {
    resource,
  };
  const loggerProvider = new LoggerProvider(loggerConfig);
  if (typeof configureLoggerProvider === 'function') {
    configureLoggerProvider(loggerProvider);
  } else {
    loggerProvider.addLogRecordProcessor(
      new SimpleLogRecordProcessor(logExporter),
    );
    logs.setGlobalLoggerProvider(loggerProvider);
  }

  // logging for debug
  if (logLevel === DiagLogLevel.DEBUG) {
    loggerProvider.addLogRecordProcessor(
      new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
    );
  }

  // Re-register instrumentation with initialized provider. Patched code will see the update.
  registerInstrumentations({
    instrumentations,
    tracerProvider,
    meterProvider,
    loggerProvider,
  });
}

initializeProvider();
