let s3Client: unknown;

export async function reportToS3(
  profilingData: object,
  bucketName: string,
  functionName: string,
  fileName: string
): Promise<void> {
  const formattedTime = new Date().toISOString().replace('T', '_').substring(0, 19);
  const params = {
    Body: JSON.stringify(profilingData),
    Bucket: bucketName,
    Key: `${functionName}/${fileName}_${formattedTime}.cpuprofile`,
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
