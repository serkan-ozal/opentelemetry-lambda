const inspector = require('inspector');
const session = new inspector.Session();

let profilerStarted = false

async function _sessionPost(key: string, obj: object = {}): Promise<object> {
  return new Promise((resolve, reject) => {
    session.post(key, obj, (err: Error | null, msg: object) => (err ? reject(err) : resolve(msg)));
  })
}

export function isProfilerStarted(): boolean {
  return profilerStarted;
}

export async function startProfiler(samplingInterval: number): Promise<void> {
  session.connect();

  await _sessionPost('Profiler.enable');
  await _sessionPost('Profiler.setSamplingInterval', {
    interval: samplingInterval,
  });
  await _sessionPost('Profiler.start');

  profilerStarted = true;
}

export async function finishProfiler(): Promise<object> {
  try {
    const params = await _sessionPost('Profiler.stop');
    return (params as any).profile;
  } finally {
    profilerStarted = false;
    session.disconnect();
  }
}
