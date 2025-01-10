console.log('>>>>> Starting init.mjs ...');

if (process.env.PROFILER_ENABLE === 'true') {
  const profiler = await import('./profiler.js');

  await profiler.startProfiler(parseInt(process.env.PROFILER_SAMPLING_INTERVAL || '10'));
  const init = await import('./init.js');
  const profilingData = await profiler.finishProfiler();

  const reporter = await import('./s3-reporter.js');
  await reporter.reportToS3(
    JSON.stringify(profilingData),
    'sozal-otel',
    process.env.AWS_LAMBDA_FUNCTION_NAME,
    'wrapper',
    'cpuprofile',
  );

  const wrapperCompiledData = init.getWrapperCompiledData();
  if (wrapperCompiledData) {
    await reporter.reportToS3(
      wrapperCompiledData,
      'sozal-otel',
      process.env.AWS_LAMBDA_FUNCTION_NAME,
      'wrapper',
      'compiled',
    );
  }
} else {
  const init = await import('./init.js');
  const wrapperCompiledData = init.getWrapperCompiledData();
  if (wrapperCompiledData) {
    const reporter = await import('./s3-reporter.js');
    await reporter.reportToS3(
      wrapperCompiledData,
      'sozal-otel',
      process.env.AWS_LAMBDA_FUNCTION_NAME,
      'wrapper',
      'compiled',
    );
  }
}

console.log('>>>>> Completed init.mjs');
