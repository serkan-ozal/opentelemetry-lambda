const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client();

module.exports.reportToS3 = async function(
  data,
  bucketName,
  functionName,
  fileName,
  fileExt
){
  const formattedTime = new Date().toISOString().replace('T', '_').substring(0, 19);
  const params = {
    Body: data,
    Bucket: bucketName,
    Key: `${functionName}/${fileName}_${formattedTime}.${fileExt}`,
  };
  const putObjectCommand = new PutObjectCommand(params);
  await s3Client.send(putObjectCommand);
}
