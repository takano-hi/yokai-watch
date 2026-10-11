import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GenerationError } from "./generation-input";

export function getR2Config() {
  if (!process.env.CLOUDFLARE_R2_API_ENDPOINT || !process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
      !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || !process.env.CLOUDFLARE_R2_BUCKET_NAME) {
    throw new GenerationError(503, "画像保存先が設定されていません", "R2_NOT_CONFIGURED");
  }
}

const client = new S3Client({
  region: "auto",
  maxAttempts: 1,
  endpoint: process.env.CLOUDFLARE_R2_API_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? "";

export async function uploadImage(
  filename: string,
  buffer: Buffer,
  contentType: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
    }),
    { abortSignal: signal },
  );
}
