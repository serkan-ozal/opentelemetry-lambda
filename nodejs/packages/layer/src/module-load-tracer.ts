const Module = require('module');

export interface RequireTrace {

  readonly parent: RequireTrace | null;
  readonly children: RequireTrace[];
  readonly moduleId: string;
  readonly fileName: string;
  readonly moduleType: string;
  readonly depth: number;
  startTimestamp: number;
  finishTimestamp: number;
  duration: number;
  error: any;
  ignored: boolean;

}

export const NodejsModuleTypes = {
  MODULE: 'MODULE',
  CORE: 'CORE',
  RUNTIME: 'RUNTIME',
  LAYER: 'LAYER',
};

let activated: boolean = false;
let originalRequire: Function;
let activeRequires: RequireTrace[] = [];
let tracedRequires: RequireTrace[] = [];
let rootTracedRequires: RequireTrace[] = [];
let minModuleDuration: number = -1;
let maxModuleDepth: number = -1;

function getModuleType(fileName: string): string {
  if (fileName.startsWith('/opt/')) {
    return NodejsModuleTypes.LAYER;
  } else if (fileName.startsWith('/var/runtime/')) {
    return NodejsModuleTypes.RUNTIME;
  } else if (fileName.includes('/')) {
    return NodejsModuleTypes.MODULE;
  } else {
    return NodejsModuleTypes.CORE;
  }
}

const traceRequire = function (moduleId: string): any {
  // @ts-ignore
  const scopeObj = this;

  if (!activated) {
    return originalRequire.call(scopeObj, moduleId);
  }

  let originalRequireCalled: boolean = false;
  let res: any;
  try {
    const fileName: string = Module._resolveFilename(moduleId, scopeObj);
    const moduleType: string = getModuleType(fileName);
    const numOfActiveReqs: number = activeRequires.length;
    // Get parent require trace
    const parentReqTrace: RequireTrace | null =
      numOfActiveReqs === 0 ? null : activeRequires[numOfActiveReqs - 1];
    const ignored: boolean = parentReqTrace ? parentReqTrace.ignored : false;

    // Create new require trace
    const reqTrace: RequireTrace = {
      parent: parentReqTrace,
      children: [] as RequireTrace[],
      moduleId,
      fileName,
      moduleType,
      depth: numOfActiveReqs,
      ignored,
    } as RequireTrace;

    if (parentReqTrace) {
      parentReqTrace.children.push(reqTrace);
    } else {
      rootTracedRequires.push(reqTrace);
    }

    // Push new require traces onto stack as current require trace
    activeRequires.push(reqTrace);
    // Record current require trace
    tracedRequires.push(reqTrace);
    try {
      // Capture start timestamp of require
      reqTrace.startTimestamp = Date.now();
      originalRequireCalled = true;
      res = originalRequire.call(scopeObj, moduleId);
    } catch (err) {
      // Capture error occurred during require
      reqTrace.error = err;
      throw err;
    } finally {
      // Capture finish timestamp of require
      reqTrace.finishTimestamp = Date.now();
      // Capture duration of require
      reqTrace.duration = reqTrace.finishTimestamp - reqTrace.startTimestamp;
      if (minModuleDuration > -1 && reqTrace.duration < minModuleDuration) {
        reqTrace.ignored = true;
      }
      if (maxModuleDepth > -1 && reqTrace.depth > maxModuleDepth) {
        reqTrace.ignored = true;
      }
      // Pop new require trace from stack as it is not current require trace anymore
      activeRequires.pop();
    }

    return res;
  } catch (err) {
    // Check whether there is an internal error from our module load tracer
    if (originalRequireCalled) {
      if (res) {
        return res;
      } else {
        throw err;
      }
    } else {
      return originalRequire.call(scopeObj, moduleId);
    }
  }
};

export function configure(minDuration: number, maxDepth: number): void {
  minModuleDuration = minDuration;
  maxModuleDepth = maxDepth;
}

export function activate(): void {
  if (activated) {
    return;
  }

  originalRequire = Module.prototype.require;
  Module.prototype.require = traceRequire;
  activated = true;
}

export function reset(): void {
  tracedRequires = [];
  activeRequires = [];
}

export function getTracedRequires(): RequireTrace[] {
  return tracedRequires;
}

export function getRootTracedRequires(): RequireTrace[] {
  return rootTracedRequires;
}

export function deactivate(): void {
  reset();

  if (!activated) {
    return;
  }

  const currentRequire = Module.prototype.require;
  // Check whether another one has not patched require and override ours
  if (currentRequire === traceRequire) {
    Module.prototype.require = originalRequire;
  }
  activated = false;
}
