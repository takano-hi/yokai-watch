export const MAX_PHOTO_BYTES = 4_000_000;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class GenerationError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
    this.name = "GenerationError";
  }
}

export async function parseGenerationInput(form: FormData, requireId = true) {
  const id = form.get("id");
  if (requireId && (form.getAll("id").length !== 1 || typeof id !== "string" || !UUID_PATTERN.test(id))) {
    throw new GenerationError(400, "idにUUIDを指定してください", "INVALID_ID");
  }
  const text = (key: string, limit: number, required = false) => {
    const value = form.get(key);
    if (form.getAll(key).length > 1 || (value !== null && typeof value !== "string")) {
      throw new GenerationError(400, "入力形式が正しくありません", "INVALID_INPUT");
    }
    const result = typeof value === "string" ? value.trim() : "";
    if ((required && !result) || result.length > limit) {
      throw new GenerationError(400, `${key}の入力を確認してください`, "INVALID_INPUT");
    }
    return result;
  };
  const name = text("name", 100, true);
  const skill = text("skill", 500);
  const personality = text("personality", 500);
  const photo = form.get("photo");
  if (!(photo instanceof File) || form.getAll("photo").length !== 1) {
    throw new GenerationError(400, "photoに写真1枚を指定してください", "INVALID_PHOTO");
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    throw new GenerationError(413, "写真は4MB以下にしてください", "PHOTO_TOO_LARGE");
  }
  const bytes = Buffer.from(await photo.arrayBuffer());
  const png = photo.type === "image/png" && bytes.subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = photo.type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!png && !jpeg) {
    throw new GenerationError(415, "JPEGまたはPNGの写真を送信してください", "UNSUPPORTED_PHOTO");
  }
  return { id: typeof id === "string" ? id : "", name, skill, personality, bytes, mimeType: photo.type };
}
