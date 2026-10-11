import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GenerationError, parseGenerationInput } from "@/lib/generation-input";
import { generateAndSaveImages } from "@/lib/image-generation";

// cacheComponents requires the default Node.js runtime rather than a runtime export.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const token = process.env.IMAGE_GENERATION_API_TOKEN;
    if (!token) throw new GenerationError(503, "画像生成APIが設定されていません", "API_NOT_CONFIGURED");
    const actual = Buffer.from(req.headers.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${token}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new GenerationError(401, "認証に失敗しました", "UNAUTHORIZED");
    }
    let form: FormData;
    try { form = await req.formData(); } catch {
      throw new GenerationError(400, "送信形式が正しくありません", "INVALID_FORM");
    }
    const input = await parseGenerationInput(form);
    const result = await generateAndSaveImages(input, req.signal);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error instanceof GenerationError ? error :
      new GenerationError(502, "画像生成に失敗しました", "UNEXPECTED_ERROR");
    return NextResponse.json({ success: false, message: failure.message }, {
      status: failure.status, headers: { "Cache-Control": "no-store" },
    });
  }
}
