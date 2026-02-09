import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

export function sanitizeFileName(name: string) {
  const base = name.split(/[\\/]/).pop() || "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 180);
}

export async function presignPutObject(args: {
  key: string;
  contentType: string;
}) {
  const cmd = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: args.key,
    ContentType: args.contentType,
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 10 });
  return url;
}

export async function presignGetObject(args: { key: string }) {
  const cmd = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: args.key,
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 10 });
  return url;
}

export async function deleteObjects(keys: string[]) {
  if (keys.length === 0) return { deleted: 0 };
  // S3 DeleteObjects supports up to 1000 keys per request
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 900) chunks.push(keys.slice(i, i + 900));

  let deleted = 0;
  for (const chunk of chunks) {
    const cmd = new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET,
      Delete: {
        Objects: chunk.map((Key) => ({ Key })),
        Quiet: true,
      },
    });
    const res = await s3.send(cmd);
    deleted += res.Deleted?.length ?? 0;
  }
  return { deleted };
}

export async function copyObject(args: { fromKey: string; toKey: string }) {
  // CopySource must be URL-encoded but keep path separators.
  const encodedKey = encodeURIComponent(args.fromKey).replaceAll("%2F", "/");
  const copySource = `${env.S3_BUCKET}/${encodedKey}`;
  const cmd = new CopyObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: args.toKey,
    CopySource: copySource,
  });
  await s3.send(cmd);
}
