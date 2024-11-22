const Module = require('module');
const fs = require('fs');

const MODULE_CACHE_FILENAME =
  process.env.OTEL_NODE_CACHE_REQUIRE_PATHS_FILE ?
    process.env.OTEL_NODE_CACHE_REQUIRE_PATHS_FILE :
    `${__dirname}/cache-require-paths.json`;

console.log(`>>>>> Module cache file ${MODULE_CACHE_FILENAME} exist: ${fs.existsSync(MODULE_CACHE_FILENAME)}`);

const originalRequire = Module.prototype.require;
const originalResolveFilename = Module._resolveFilename;

const moduleNameCache: any =
  fs.existsSync(MODULE_CACHE_FILENAME)
    ? JSON.parse(fs.readFileSync(MODULE_CACHE_FILENAME, 'utf-8'))
    : {};

let resolvedPath: string | undefined;

Module._resolveFilename = function(name: string, parentModule: unknown,
                                   isMain: boolean | undefined, options: unknown): string | any {
  return resolvedPath || originalResolveFilename.call(this, name, parentModule, isMain, options);
};

Module.prototype.require = function cachePathsRequire(name: string) {
  const fileName = this.filename as string;
  let pathToLoad;
  let currentModuleCache = moduleNameCache[fileName];
  if (!currentModuleCache) {
    currentModuleCache = {};
    moduleNameCache[fileName] = currentModuleCache;
  }
  if (currentModuleCache[name]) {
    pathToLoad = currentModuleCache[name];
  } else {
    pathToLoad = Module._resolveFilename(name, this);
    currentModuleCache[name] = pathToLoad;
  }

  resolvedPath = pathToLoad;
  try {
    return originalRequire.call(this, pathToLoad);
  } finally {
    resolvedPath = undefined;
  }
};

////////////////////////////////////////////////////////////////////////////////

let s3Client: unknown;

async function _dumpToS3(
  data: object,
  bucketName: string,
  functionName: string,
  fileName: string,
): Promise<void> {
  const params = {
    Body: JSON.stringify(data, null, 2),
    Bucket: bucketName,
    Key: `${functionName}/${fileName}`,
  };

  if (_isSDKV3()) {
    await _reportWithSDKV3(params);
  } else {
    await _reportWithSDKV2(params);
  }
}

// Starting from Node18, Lambda includes JS SDK V3
function _isSDKV3() {
  const nodeVersion = parseInt(process.versions.node.split('.')[0]);
  return nodeVersion >= 18;
}

async function _reportWithSDKV3(params: object): Promise<void> {
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

  if (!s3Client) {
    s3Client = new S3Client();
  }

  const putObjectCommand = new PutObjectCommand(params);
  await (s3Client as typeof S3Client).send(putObjectCommand);
}

async function _reportWithSDKV2(params: object): Promise<void> {
  const S3 = require('aws-sdk/clients/s3');

  if (!s3Client) {
    s3Client = new S3();
  }

  await (s3Client as typeof S3).putObject(params).promise();
}

export async function dumpCache() {
  if (process.env.OTEL_NODE_REQUIRE_CACHE_S3_BUCKET_NAME) {
    try {
      await _dumpToS3(
        moduleNameCache,
        process.env.OTEL_NODE_REQUIRE_CACHE_S3_BUCKET_NAME,
        process.env.AWS_LAMBDA_FUNCTION_NAME!,
        '.cache-require-paths.json',
      );
    } catch (err) {
      console.error('Failed saving require cache: ' + err);
    }
  }
}
