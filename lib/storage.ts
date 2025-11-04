import { env } from './env';
import { S3Client, PutObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';

export type UploadResult = { key: string; publicUrl: string };

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!env.AWS_REGION) {
    throw new Error('AWS_REGION must be configured');
  }
  if (!s3Client) {
    s3Client = new S3Client({ region: env.AWS_REGION });
  }
  return s3Client;
}

function encodeKeyForUrl(key: string): string {
  return key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

const allowedAclValues: ObjectCannedACL[] = [
  'private',
  'public-read',
  'public-read-write',
  'authenticated-read',
  'aws-exec-read',
  'bucket-owner-read',
  'bucket-owner-full-control',
];

function resolveAcl(value?: string): ObjectCannedACL | undefined {
  if (!value) return undefined;
  return allowedAclValues.find((acl) => acl === value);
}

export async function uploadToS3(key: string, bytes: Uint8Array, contentType: string): Promise<UploadResult> {
  const bucket = env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error('AWS_S3_BUCKET must be configured');
  }
  const client = getS3Client();
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: resolveAcl(env.AWS_S3_ACL),
      CacheControl: 'public, max-age=31536000',
    })
  );

  const baseUrl =
    (env.AWS_S3_PUBLIC_URL || `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com`).replace(/\/$/, '');
  const publicUrl = `${baseUrl}/${encodeKeyForUrl(key)}`;
  return { key, publicUrl };
}

