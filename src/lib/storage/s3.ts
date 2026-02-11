import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
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

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  // AWS SDK v3 in Node returns a Readable stream for Body.
  const maybe = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof maybe.transformToByteArray === "function") {
    const arr = await maybe.transformToByteArray();
    return Buffer.from(arr);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<unknown>) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
    } else if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      // Fallback: try best-effort conversion.
      chunks.push(Buffer.from(String(chunk)));
    }
  }
  return Buffer.concat(chunks);
}

export async function getObjectBytes(args: { key: string; maxBytes: number }) {
  const cmd = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: args.key,
  });
  const res = await s3.send(cmd);
  const buf = await streamToBuffer(res.Body);
  if (buf.length > args.maxBytes) {
    throw new Error(`Object too large (${buf.length} bytes)`);
  }
  return buf;
}

export async function getObjectRangeBytes(args: { key: string; start: number; end: number; maxBytes: number }) {
  if (!Number.isInteger(args.start) || !Number.isInteger(args.end) || args.start < 0 || args.end < args.start) {
    throw new Error("Invalid range");
  }
  const cmd = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: args.key,
    Range: `bytes=${args.start}-${args.end}`,
  });
  const res = await s3.send(cmd);
  const buf = await streamToBuffer(res.Body);
  if (buf.length > args.maxBytes) {
    throw new Error(`Object range too large (${buf.length} bytes)`);
  }
  return buf;
}

export async function putObjectBytes(args: {
  key: string;
  bytes: Buffer;
  contentType: string;
  cacheControl?: string;
}) {
  const cmd = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: args.key,
    Body: args.bytes,
    ContentType: args.contentType,
    CacheControl: args.cacheControl,
  });
  await s3.send(cmd);
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

export async function listObjectKeysByPrefix(prefix: string) {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const cmd = new ListObjectsV2Command({
      Bucket: env.S3_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });
    const res = await s3.send(cmd);
    for (const item of res.Contents || []) {
      if (item.Key) keys.push(item.Key);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}
