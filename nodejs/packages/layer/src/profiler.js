const inspector = require('inspector');
const session = new inspector.Session();

let profilerStarted = false;

async function _sessionPost(key, obj = {}) {
  return new Promise((resolve, reject) => {
    session.post(key, obj, (err, msg) => (err ? reject(err) : resolve(msg)));
  })
}

module.exports.startProfiler = async function(samplingInterval) {
  session.connect();
  await _sessionPost('Profiler.enable');
  await _sessionPost('Profiler.setSamplingInterval', {
    interval: samplingInterval,
  });
  await _sessionPost('Profiler.start');
  profilerStarted = true;
}

module.exports.finishProfiler = async function() {
  try {
    const params = await _sessionPost('Profiler.stop');
    return params.profile;
  } finally {
    profilerStarted = false;
    session.disconnect();
  }
}
