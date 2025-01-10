const START_TIME = Date.now();

//console.log('>>>>> Starting init.js ...');

const Module = require('module');
const vm = require('vm');
const path = require('path');
const fs = require('fs');

const WRAPPER_COMPILED_FILE_PATH = '/opt/wrapper.compiled';
let wrapperCompiledData;

if (process.env.MODULE_COMPILE_CACHE_LOAD === 'true' && fs.existsSync(WRAPPER_COMPILED_FILE_PATH)) {
  const wrapperCachedData = fs.readFileSync(WRAPPER_COMPILED_FILE_PATH);

  let requireWrapperDisabled = false;
  const originalModuleRequire = Module.prototype.require;
  Module.prototype.require = function(modulePath){
    if (requireWrapperDisabled) {
      return originalModuleRequire.call(this, modulePath);
    }

    return originalModuleRequire.call(this, modulePath);
  }

  const originalModuleCompile = Module.prototype._compile;
  Module.prototype._compile = function (content, filename) {
    const mod = this;

    const wrapper = Module.wrap(content);

    const script = new vm.Script(wrapper, {
      filename: filename,
      lineOffset: 0,
      displayErrors: true,
      produceCachedData: false,
      cachedData: wrapperCachedData,
    });

    const compiledWrapper = script.runInThisContext({
      filename: filename,
      lineOffset: 0,
      columnOffset: 0,
      displayErrors: true,
    });

    const dirname = path.dirname(filename);
    const args = [mod.exports, require, mod, filename, dirname];
    return compiledWrapper.apply(mod.exports, args);
  }

  require('./wrapper.js');

  Module.prototype._compile = originalModuleCompile;

  requireWrapperDisabled = true;
} else if (process.env.MODULE_COMPILE_CACHE_SAVE === 'true') {
  const originalModuleCompile = Module.prototype._compile;

  Module.prototype._compile = function (content, filename) {
    const mod = this;

    const wrapper = Module.wrap(content);

    const script = new vm.Script(wrapper, {
      filename: filename,
      lineOffset: 0,
      displayErrors: true,
      produceCachedData: true,
    });

    wrapperCompiledData = script.cachedData;

    const compiledWrapper = script.runInThisContext({
      filename: filename,
      lineOffset: 0,
      columnOffset: 0,
      displayErrors: true,
    });

    const dirname = path.dirname(filename);
    const args = [mod.exports, require, mod, filename, dirname];
    return compiledWrapper.apply(mod.exports, args);
  }

  require('./wrapper.js');

  Module.prototype._compile = originalModuleCompile;
} else {
  require('./wrapper.js');
}

console.log('>>>>> Wrapper init completed in', Date.now() - START_TIME, 'ms');
//console.log('>>>>> Wrapper init completed', (Math.floor(1000 * process.uptime())), 'ms later after startup');

//console.log('>>>>> Completed init.js');

module.exports.getWrapperCompiledData = function () {
  return wrapperCompiledData;
}
