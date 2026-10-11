import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GenerationError } from "./generation-input";

export function getR2Config() {
  const endpoint = process.env.CLOUDFLARE_R2_API_ENDPOINT;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new GenerationError(503, "画像保存先が設定されていません", "R2_NOT_CONFIGURED");
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

export async function uploadImage(filename: string, buffer: Buffer, signal: AbortSignal) {
  const { endpoint, accessKeyId, secretAccessKey, bucket } = getR2Config();
  const client = new S3Client({
    region: "auto", endpoint, maxAttempts: 1,
    credentials: { accessKeyId, secretAccessKey },
  });
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: filename, Body: buffer, ContentType: "image/png",
    }), { abortSignal: signal });
  } catch {
    throw new GenerationError(signal.aborted ? 504 : 502,
      signal.aborted ? "画像保存がタイムアウトしました" : "画像を保存できませんでした",
      signal.aborted ? "R2_TIMEOUT" : "R2_UPLOAD_FAILED");
  } finally {
    client.destroy();
  }
}
