import { Request, Response, Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { uploadImage } from "../lib/r2";
import { loadReferenceImage } from "../lib/reference-images";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const IMAGE_PROMPTS = {
  character: (name: string) => `添付した人物の写真をもとに、『妖怪ウォッチ』に登場する妖怪のような、日本の妖怪アニメ・ゲーム風のオリジナル妖怪を1体デザインし、画像を生成してください。

【フォルム・絵柄】
・ジバニャンのような、丸みのある頭と胴体、短めの手足、大きくて分かりやすい顔パーツを持つ、かわいくデフォルメされたマスコット型のフォルムを参考にする。
・太くはっきりした輪郭線、シンプルな形、鮮やかな色、親しみやすく表情豊かなデザインにする。
・写真の人物の髪型、目、顔の印象、服装などの特徴を、妖怪の色・模様・顔つき・装飾に反映する。
・元の人物らしさを残しつつ、動物や不思議な生き物などの要素を組み合わせ、独自の妖怪にする。
・毎回同じ猫型にせず、人物の特徴に合う動物型や人型、幻獣型なども取り入れながら、ジバニャンのような親しみやすいマスコット感を保つ。
・既存キャラクターをそのままコピーせず、オリジナルのデザインにする。

【画像出力】
・背景は２枚目の画像を使ってください。これは絶対守ってください。
・妖怪1体の全身イラスト
・頭から足先まで画面内に収める
・キャラクターを中央に配置する
・その人の説明文を書いてください。
・入力された名前の最後ににゃんをつけて名前にしてください。

説明だけで終わらせず、実際に画像を生成してください。
この人はとてもめんどくさがり屋です。名前は${name}です`,

  medal:
    "この写真に写っている人物の特徴を活かして、妖怪ウォッチのメダル風の円形画像を生成してください。" +
    "円形のメダルの中央に妖怪ウォッチ風にデフォルメされた人物のキャラクターイラスト、周囲に金色の装飾的なフレームデザインを描いてください。" +
    "背景は透明または単色にしてください。",

} as const;

type OutputItem = { type: string; result?: string; content?: { text?: string }[] };
type OpenAIResponse = { error?: { message: string }; output?: OutputItem[] };

async function callOpenAI(
  base64: string,
  mimeType: string,
  prompt: string,
  referenceImageBase64: string,
  size?: string
): Promise<OpenAIResponse> {
  const body = JSON.stringify({
    model: "gpt-6-luna",
    input: [
      {
        role: "user",
        content: [
          { type: "input_image", image_url: `data:${mimeType};base64,${base64}` },
          { type: "input_image", image_url: `data:image/png;base64,${referenceImageBase64}` },
          { type: "input_text", text: prompt },
        ],
      },
    ],
    tools: [{ type: "image_generation", ...(size && { size }) }],
  });
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CHATGPT_API_KEY}`,
    },
    body,
  });
  return res.json() as Promise<OpenAIResponse>;
}

router.post("/", upload.single("photo"), async (req: Request, res: Response) => {
  const name = req.body.name as string | undefined;
  if (!name) {
    res.status(400).json({ success: false, message: "name フィールドが見つかりません" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ success: false, message: "photo フィールドが見つかりません" });
    return;
  }

  const base64 = req.file.buffer.toString("base64");
  const mimeType = req.file.mimetype || "image/jpeg";
  let characterReferenceImage: string;
  let medalReferenceImage: string;
  try {
    [characterReferenceImage, medalReferenceImage] = await Promise.all([
      loadReferenceImage("character"),
      loadReferenceImage("medal"),
    ]);
  } catch {
    res.status(500).json({ success: false, message: "参照用PNGファイルを読み込めませんでした" });
    return;
  }

  const [characterData, medalData] = await Promise.all([
    callOpenAI(base64, mimeType, IMAGE_PROMPTS.character(name), characterReferenceImage),
    callOpenAI(base64, mimeType, IMAGE_PROMPTS.medal, medalReferenceImage, "256x256"),
  ]);

  if (characterData.error) {
    res.status(422).json({ success: false, message: characterData.error.message });
    return;
  }

  const characterOutput = characterData.output?.find((o) => o.type === "image_generation_call");

  if (!characterOutput?.result) {
    const text = characterData.output?.find((o) => o.type === "message")?.content?.[0]?.text ?? "";
    if (text.trim() === "NO_PERSON") {
      res.status(422).json({ success: false, message: "人物を特定できませんでした" });
    } else {
      res.status(422).json({ success: false, message: "画像の生成に失敗しました" });
    }
    return;
  }

  const medalOutput = medalData.output?.find((o) => o.type === "image_generation_call");

  const imageFilename = `${randomUUID()}.png`;
  const medalFilename = medalOutput?.result ? `${randomUUID()}.png` : null;

  await Promise.all([
    uploadImage(imageFilename, Buffer.from(characterOutput.result, "base64"), "image/png"),
    ...(medalFilename && medalOutput?.result
      ? [uploadImage(medalFilename, Buffer.from(medalOutput.result, "base64"), "image/png")]
      : []),
  ]);

  const monster = await prisma.monster.create({
    data: { name, imageFilename, medalFilename },
  });

  res.status(201).json(monster);
});

router.get("/", async (_req: Request, res: Response) => {
  const monsters = await prisma.monster.findMany({
    orderBy: { name: "asc" },
  });
  res.json(monsters);
});

router.patch("/:id", async (req: Request, res: Response) => {
  const name = req.body.name as string | undefined;
  if (!name || !name.trim()) {
    res.status(400).json({ success: false, message: "name が空です" });
    return;
  }
  try {
    const monster = await prisma.monster.update({
      where: { id: req.params.id },
      data: { name },
    });
    res.json(monster);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      res.status(404).json({ success: false, message: "妖怪が見つかりません" });
      return;
    }
    throw e;
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await prisma.monster.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      res.status(404).json({ success: false, message: "妖怪が見つかりません" });
      return;
    }
    throw e;
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const monster = await prisma.monster.findUnique({
    where: { id: req.params.id },
  });
  if (!monster) {
    res.status(404).json({ success: false, message: "妖怪が見つかりません" });
    return;
  }
  res.json(monster);
});

export default router;
