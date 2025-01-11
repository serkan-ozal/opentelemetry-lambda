import {
  context,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  metrics,
  propagation,
  trace,
} from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import {ExportResult, getEnv} from '@opentelemetry/core';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  ReadableSpan,
  SDKRegistrationConfig,
  SimpleSpanProcessor,
  SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import {
  NodeTracerConfig,
  NodeTracerProvider,
} from '@opentelemetry/sdk-trace-node';
import {
  MeterProvider,
  MeterProviderOptions,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
  ConsoleLogRecordExporter,
  LoggerProviderConfig,
} from '@opentelemetry/sdk-logs';
import {
  detectResourcesSync,
  envDetector,
  processDetector,
} from '@opentelemetry/resources';
import { awsLambdaDetector } from '@opentelemetry/resource-detector-aws';
import { getPropagator } from '@opentelemetry/auto-configuration-propagators';
import { OTLPTraceExporter as OTLPHTTPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPProtoTraceExporter} from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  Instrumentation,
  registerInstrumentations,
} from '@opentelemetry/instrumentation';
import {
  AwsInstrumentation,
  AwsSdkInstrumentationConfig,
} from '@opentelemetry/instrumentation-aws-sdk';
import {
  AwsLambdaInstrumentation,
  AwsLambdaInstrumentationConfig,
} from '@opentelemetry/instrumentation-aws-lambda';

function defaultConfigureInstrumentations() {
  // Use require statements for instrumentation
  // to avoid having to have transitive dependencies on all the typescript definitions.
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

declare global {
  // In case of downstream configuring span processors etc
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

function createInstrumentations() {
  return [
    new AwsInstrumentation(
      typeof configureAwsInstrumentation === 'function'
        ? configureAwsInstrumentation({ suppressInternalInstrumentation: true })
        : { suppressInternalInstrumentation: true },
    ),
    new AwsLambdaInstrumentation(
      typeof configureLambdaInstrumentation === 'function'
        ? configureLambdaInstrumentation({})
        : {},
    ),
    ...(typeof configureInstrumentations === 'function'
      ? configureInstrumentations
      : defaultConfigureInstrumentations)(),
  ];
}

class ManagedTraceExporter implements SpanExporter {

  private readonly spanExporter: SpanExporter;

  constructor(spanExporter: SpanExporter) {
    this.spanExporter = spanExporter;
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (process.env.OTLP_DUPLICATE_FACTOR) {
      const duplicateFactor = parseInt(process.env.OTLP_DUPLICATE_FACTOR);
      const duplicatedSpans: ReadableSpan[] = [];
      for (let i = 0; i < duplicateFactor; i++) {
        duplicatedSpans.push(...spans);
      }
      spans = duplicatedSpans;
    }

    const start: [number, number] = process.hrtime();
    this.spanExporter.export(spans, (result: ExportResult) => {
      const end: [number, number] = process.hrtime(start);
      const timeInMs: number = (end[0] * 1_000) + (end[1] / 1_000_000);
      console.log(`>>> Traces have been exported in ${timeInMs} milliseconds`);
      resultCallback(result);
    });
  }

  shutdown(): Promise<void> {
    return Promise.resolve(undefined);
  }

}

function initializeProvider() {
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
    let spanExporter: SpanExporter;
    if (process.env.OTLP_PROTO_ENABLED === 'true') {
      console.log('>>> Using OTLPProtoTraceExporter ...');
      spanExporter = new OTLPProtoTraceExporter();
    } else {
      console.log('>>> Using OTLPHTTPTraceExporter ...');
      spanExporter = new OTLPHTTPTraceExporter();
    }
    // Defaults
    tracerProvider.addSpanProcessor(
      new BatchSpanProcessor(new ManagedTraceExporter(spanExporter)),
    );
  }
  // Logging for debug
  if (logLevel === DiagLogLevel.DEBUG) {
    tracerProvider.addSpanProcessor(
      new SimpleSpanProcessor(new ConsoleSpanExporter()),
    );
  }

  let sdkRegistrationConfig: SDKRegistrationConfig = {};
  if (typeof configureSdkRegistration === 'function') {
    sdkRegistrationConfig = configureSdkRegistration(sdkRegistrationConfig);
  }
  // Auto-configure propagator if not provided
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
  } else {
    metrics.setGlobalMeterProvider(meterProvider);
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

  // Logging for debug
  if (logLevel === DiagLogLevel.DEBUG) {
    loggerProvider.addLogRecordProcessor(
      new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
    );
  }

  // Create instrumentations if they have not been created before
  // to prevent additional coldstart overhead
  // caused by creations and initializations of instrumentations.
  if (!instrumentations || !instrumentations.length) {
    instrumentations = createInstrumentations();
  }

  // Re-register instrumentation with initialized provider. Patched code will see the update.
  disableInstrumentations = registerInstrumentations({
    instrumentations,
    tracerProvider,
    meterProvider,
    loggerProvider,
  });
}

export function wrap() {
  initializeProvider();
}

export function unwrap() {
  if (disableInstrumentations) {
    disableInstrumentations();
    disableInstrumentations = () => {};
  }
  instrumentations = [];
  context.disable();
  propagation.disable();
  trace.disable();
  metrics.disable();
  logs.disable();
}

console.log('Registering OpenTelemetry');

// Configure lambda logging
const logLevel = getEnv().OTEL_LOG_LEVEL;
diag.setLogger(new DiagConsoleLogger(), logLevel);

let instrumentations = createInstrumentations();
let disableInstrumentations: () => void;

// Register instrumentations synchronously to ensure code is patched even before provider is ready.
disableInstrumentations = registerInstrumentations({
  instrumentations,
});

wrap();
