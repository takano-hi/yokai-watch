export const MAX_PHOTO_BYTES = 4_000_000;

export function validateGenerationInput(
  body: Record<string, unknown>,
  photo?: { buffer: Buffer; mimetype: string },
) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const skill = typeof body.skill === "string" ? body.skill.trim() : "";
  const personality = typeof body.personality === "string" ? body.personality.trim() : "";
  if (!name) return { error: "name フィールドが見つかりません", status: 400 } as const;
  if (name.length > 100 || skill.length > 500 || personality.length > 500 ||
      (body.skill !== undefined && typeof body.skill !== "string") ||
      (body.personality !== undefined && typeof body.personality !== "string")) {
    return { error: "入力文字数または形式が正しくありません", status: 400 } as const;
  }
  if (!photo) return { error: "photo フィールドが見つかりません", status: 400 } as const;
  if (photo.buffer.length > MAX_PHOTO_BYTES) {
    return { error: "写真は4MB以下にしてください", status: 413 } as const;
  }
  const png = photo.mimetype === "image/png" &&
    photo.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = photo.mimetype === "image/jpeg" &&
    photo.buffer[0] === 255 && photo.buffer[1] === 216 && photo.buffer[2] === 255;
  if (!png && !jpeg) return { error: "JPEGまたはPNGの写真を送信してください", status: 415 } as const;
  return { value: { name, skill, personality, photo } } as const;
}
