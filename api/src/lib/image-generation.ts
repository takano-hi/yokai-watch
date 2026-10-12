import { GenerationError } from "./generation-input";
import { getR2Config, uploadImage } from "./r2";
import { loadReferenceImage } from "./reference-images";

const IMAGE_PROMPTS = {
  character: [
    { referenceImage: "character", prompt: (name: string, personality: string) => `この人を妖怪ウォッチの妖怪風にしてください。
        【フォルム・絵柄】
・ジバニャンのような、丸みのある頭と胴体、短めの手足、大きくて分かりやすい顔パーツを持つ、かわいくデフォルメされたマスコット型のフォルムを参考にする。
・太くはっきりした輪郭線、シンプルな形、鮮やかな色、親しみやすく表情豊かなデザインにする。
・写真の人物の髪型、目、顔の印象、服装などの特徴を、妖怪の色・模様・顔つき・装飾に反映する。
・元の人物らしさを残しつつ、動物や不思議な生き物などの要素を組み合わせ、独自の妖怪にする。
・毎回同じ猫型にせず、人物の特徴に合う動物型や人型、幻獣型なども取り入れながら、ジバニャンのような親しみやすいマスコット感を保つ。
・既存キャラクターをそのままコピーせず、オリジナルのデザインにする。
        背景は透過してください。
        性格は${personality}です。必ず妖怪キャラクター画像を生成してください。画像とは別に、テキスト部分には性格に合うスキル名だけを返してください。` },
    { referenceImage: "character2", prompt: (name: string, personality: string) => `この人を妖怪ウォッチの妖怪風にしてください。
足はお化けにみたいにしてください。
入力された名前をそのまま妖怪の名前にしてください。
入力されたこの人を表した言葉をそのまま性格にしてください。
入力された一言を用いてスキルを作ってください。
それ以外は出力しないでください。
背景は透過してください。
性格は${personality}です。必ず妖怪キャラクター画像を生成してください。画像とは別に、テキスト部分には性格に合うスキル名だけを返してください。` },
  ] as const,
  medal: "1枚目の画像の妖怪キャラクターを、2枚目のメダル元画像の中央にはめ込んでください。" +
        "絶対にキャラクターの上半身がメダルの内側に収まるように配置してください。" +
        "2枚目のメダルの形・枠・背景・配色・装飾はそのまま使ってください。"
};

type OutputItem = { type: string; result?: string; content?: { text?: string }[] };
type OpenAIResponse = { output?: OutputItem[]; error?: unknown };
type Input = { id: string; name: string; skill: string; personality: string; bytes: Buffer; mimeType: string };

function sanitizeErrorDetail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const apiKey = process.env.CHATGPT_API_KEY;
  const redacted = apiKey ? value.split(apiKey).join("[REDACTED]") : value;
  return redacted.replace(/data:image\/[^\s"']+/g, "[REDACTED_IMAGE]").slice(0, 2_000);
}

async function callOpenAI(input: Input, prompt: string, signal: AbortSignal, referenceImageBase64?: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CHATGPT_API_KEY}` },
    signal,
    body: JSON.stringify({
      model: "gpt-6-luna",
      input: [{ role: "user", content: [
        { type: "input_image", image_url: `data:${input.mimeType};base64,${input.bytes.toString("base64")}` },
        ...(referenceImageBase64 ? [{ type: "input_image", image_url: `data:image/png;base64,${referenceImageBase64}` }] : []),
        { type: "input_text", text: prompt },
      ] }],
      tools: [{
        type: "image_generation", model: "gpt-image-2.5-flare", quality: "medium", size: "816x816",
        background: "transparent", output_format: "png",
      }],
    }),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = body && typeof body === "object" && "error" in body &&
      body.error && typeof body.error === "object" ? body.error : null;
    console.error("openai_request_failed", {
      id: input.id,
      status: response.status,
      requestId: response.headers.get("x-request-id"),
      message: sanitizeErrorDetail(error && "message" in error ? error.message : null),
      param: sanitizeErrorDetail(error && "param" in error ? error.param : null),
      code: sanitizeErrorDetail(error && "code" in error ? error.code : null),
    });
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
    const characterTemplate = IMAGE_PROMPTS.character[Math.floor(Math.random() * IMAGE_PROMPTS.character.length)];
    const referenceImage = await loadReferenceImage(characterTemplate.referenceImage);
    const character = await callOpenAI(
      input,
      "1枚目の人物写真を妖怪にしてください。2枚目はフォルム・絵柄の見本です。人物の特徴は1枚目から、フォルム・絵柄は2枚目から参照してください。\n" +
        characterTemplate.prompt(input.name, input.personality),
      generationSignal, referenceImage,
    );
    const medal = await loadReferenceImage("medal").then((referenceImage) => callOpenAI(
      { ...input, bytes: character.bytes, mimeType: "image/png" },
      IMAGE_PROMPTS.medal, generationSignal, referenceImage,
    )).catch((error: unknown) => {
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
