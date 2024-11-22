const moduleLoadCache = await import('./module-load-cache.js');

if (process.env.OTEL_LAMBDA_MODULE_TRACE_ENABLE === 'true') {
  const { activate, configure } = await import('./module-load-tracer.js');

  const minModuleDurationToTrace = parseInt(
    process.env.OTEL_LAMBDA_MODULE_TRACE_MIN_DURATION || '-1',
  );
  const maxModuleDepthToTrace = parseInt(
    process.env.OTEL_LAMBDA_MODULE_TRACE_MAX_DEPTH || '-1',
  );
  configure(minModuleDurationToTrace, maxModuleDepthToTrace);
  activate();
}

////////////////////////////////////////////////////////////////////////////////

let profileController;

if (process.env.OTEL_NODE_PROFILER_ENABLE === 'true') {
  // Start profiler

  profileController = await import('./profile-controller.js');

  await profileController.startProfiler(parseInt(
    process.env.OTEL_NODE_PROFILER_SAMPLING_INTERVAL || '10'
  ));
}

////////////////////////////////////////////////////////////////////////////////

// Import wrapper

await import('./wrapper.js');

////////////////////////////////////////////////////////////////////////////////

if (profileController) {
  // Finish profiler

  const profilingData = await profileController.finishProfiler();

  ////////////////////////////////////////////////////////////////////////////////

  // Report profile data

  const profileReporter = await import('./profile-reporter.js');

  if (process.env.OTEL_NODE_PROFILER_S3_BUCKET_NAME) {
    await profileReporter.reportToS3(
      profilingData,
      process.env.OTEL_NODE_PROFILER_S3_BUCKET_NAME,
      process.env.AWS_LAMBDA_FUNCTION_NAME,
      'wrapper-init',
    );
  }
}

////////////////////////////////////////////////////////////////////////////////

//await moduleLoadCache.dumpCache();
