import { readFile } from "fs/promises";
import { resolve } from "path";

// src/lib と dist/lib のどちらからも同じPNGファイルを参照する。
const REFERENCE_IMAGE_PATHS = {
  character: resolve(__dirname, "../../src/lib/reference-images/character.png"),
  character2: resolve(__dirname, "../../src/lib/reference-images/character-2.png"),
  medal: resolve(__dirname, "../../src/lib/reference-images/medal.png"),
  medal2: resolve(__dirname, "../../src/lib/reference-images/medal-2.png"),
  medal3: resolve(__dirname, "../../src/lib/reference-images/medal-3.png"),
} as const;

export async function loadReferenceImage(kind: keyof typeof REFERENCE_IMAGE_PATHS): Promise<string> {
  const image = await readFile(REFERENCE_IMAGE_PATHS[kind]);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!image.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${kind} reference image must be a PNG file`);
  }
  return image.toString("base64");
}
