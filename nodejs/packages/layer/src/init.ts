import {
  activate as activateModuleTracer,
  configure as configureModuleTracer,
} from './module-load-tracer';

function initModuleTracer() {
  const minModuleDurationToTrace: number = parseInt(process.env.OTEL_LAMBDA_MODULE_TRACE_MIN_DURATION || '-1');
  const maxModuleDepthToTrace: number = parseInt(process.env.OTEL_LAMBDA_MODULE_TRACE_MAX_DEPTH || '-1');

  configureModuleTracer(minModuleDurationToTrace, maxModuleDepthToTrace);

  activateModuleTracer();
}

if (process.env.OTEL_LAMBDA_MODULE_TRACE_ENABLE === 'true') {
  initModuleTracer();
}

require('./wrapper');
