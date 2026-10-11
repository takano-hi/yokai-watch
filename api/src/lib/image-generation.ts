import { GenerationError } from "./generation-input";
import { getR2Config, uploadImage } from "./r2";

const IMAGE_PROMPTS = {
  character: (name: string, personality: string) => `この人を妖怪ウォッチの妖怪風にしてください。
        足はお化けみたいにしてください。
        入力された名前をそのまま妖怪の名前にしてください。
        それ以外は出力しないでください。
        背景は透過してください。
        この子は${name}です。性格は${personality}です。この性格を元にskillを返してください。`,
  medal: "入力画像の妖怪キャラクターを、妖怪ウォッチのメダル風の円形画像の中央に配置してください。" +
    "顔・髪型・体型・配色・服装・足の形などのデザインを変更せず、入力画像と同一のキャラクターとして描いてください。" +
    "別のデザインに描き直したり、新しい要素を加えたりしないでください。" +
    "キャラクター全体がメダルの内側に収まるように配置し、周囲に金色の装飾的なフレームデザインを描いてください。" +
    "背景は必ず完全に透過（透明）にしてください。",
};

type OutputItem = { type: string; result?: string; content?: { text?: string }[] };
type OpenAIResponse = { output?: OutputItem[]; error?: unknown };
type Input = { id: string; name: string; skill: string; personality: string; bytes: Buffer; mimeType: string };

async function callOpenAI(input: Input, prompt: string, signal: AbortSignal, size?: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CHATGPT_API_KEY}` },
    signal,
    body: JSON.stringify({
      model: "gpt-6-luna",
      input: [{ role: "user", content: [
        { type: "input_image", image_url: `data:${input.mimeType};base64,${input.bytes.toString("base64")}` },
        { type: "input_text", text: prompt },
      ] }],
      tools: [{ type: "image_generation", output_format: "png", ...(size && { size }) }],
    }),
  });
  if (!response.ok) {
    const status = response.status === 429 ? 429 :
      [401, 403].includes(response.status) ? 503 : response.status === 400 ? 422 : 502;
    throw new GenerationError(status, "画像生成サービスで処理できませんでした", `OPENAI_HTTP_${response.status}`);
  }
  const data = await response.json() as OpenAIResponse;
  if (!data || data.error || !Array.isArray(data.output)) {
    throw new GenerationError(502, "画像生成サービスの応答が正しくありません", "INVALID_OPENAI_RESPONSE");
  }
  const image = data.output.find((item) => item.type === "image_generation_call")?.result;
  const text = data.output.find((item) => item.type === "message")?.content?.[0]?.text?.trim() ?? "";
  if (!image) {
    throw new GenerationError(422, text === "NO_PERSON" ? "人物を特定できませんでした" : "画像を生成できませんでした", "NO_IMAGE");
  }
  const bytes = Buffer.from(image, "base64");
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new GenerationError(502, "生成画像の形式が正しくありません", "INVALID_GENERATED_PNG");
  }
  return { bytes, text };
}

export function getGenerationConfig() {
  if (!process.env.CHATGPT_API_KEY) {
    throw new GenerationError(503, "画像生成サービスが設定されていません", "OPENAI_NOT_CONFIGURED");
  }
  getR2Config();
}

export async function generateAndSaveImages(input: Input, requestSignal = new AbortController().signal) {
  getGenerationConfig();
  const overallSignal = AbortSignal.any([requestSignal, AbortSignal.timeout(270_000)]);
  const generationSignal = AbortSignal.any([overallSignal, AbortSignal.timeout(240_000)]);
  let stage = "generation";
  const started = Date.now();
  try {
    const character = await callOpenAI(input, IMAGE_PROMPTS.character(input.name, input.personality), generationSignal);
    const medal = await callOpenAI(
      { ...input, bytes: character.bytes, mimeType: "image/png" },
      IMAGE_PROMPTS.medal, generationSignal, "1024x1024",
    ).catch((error: unknown) => {
      if (overallSignal.aborted) throw error;
      console.warn("medal_generation_failed", {
        id: input.id, code: error instanceof GenerationError ? error.code : "UPSTREAM_ERROR",
      });
      return null;
    });
    const imageFilename = `${input.id}.png`;
    const medalFilename = medal ? `${input.id}-medal.png` : null;
    stage = "storage";
    await Promise.all([
      uploadImage(imageFilename, character.bytes, "image/png", overallSignal),
      ...(medal && medalFilename ? [uploadImage(medalFilename, medal.bytes, "image/png", overallSignal)] : []),
    ]);
    console.info("images_saved", { id: input.id, elapsedMs: Date.now() - started });
    return { id: input.id, imageFilename, medalFilename, skill: character.text };
  } catch (error) {
    const failure = overallSignal.aborted || (stage === "generation" && generationSignal.aborted)
      ? new GenerationError(504, "画像生成・保存がタイムアウトしました", "GENERATION_TIMEOUT")
      : error instanceof GenerationError ? error
      : new GenerationError(502, "画像生成サービスとの通信に失敗しました", "UPSTREAM_ERROR");
    console.error("image_generation_failed", { id: input.id, stage, code: failure.code, elapsedMs: Date.now() - started });
    throw failure;
  }
}
