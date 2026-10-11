import { Request, Response, Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { uploadImage } from "../lib/r2";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const IMAGE_PROMPTS = {
  character: (
    name: string,
    skill: string,
  ) => `この人を妖怪ウォッチの妖怪風にしてください。
        足はお化けみたいにしてください。
        入力された名前をそのまま妖怪の名前にしてください。
        入力されたこの人を表した言葉をそのまま性格にしてください。
        入力された一言を用いてスキルを作ってください。
        それ以外は出力しないでください。
        背景は透過してください。
        この子は${name}です。性格は恥ずかしがりやです。
        入力された一言：${skill}`,

  medal:
    "この写真に写っている人物の特徴を活かして、妖怪ウォッチのメダル風の円形画像を生成してください。" +
    "円形のメダルの中央に妖怪ウォッチ風にデフォルメされた人物のキャラクターイラスト、周囲に金色の装飾的なフレームデザインを描いてください。" +
    "背景は必ず完全に透過（透明）にしてください。",
} as const;

type OutputItem = {
  type: string;
  result?: string;
  content?: { text?: string }[];
};
type OpenAIResponse = { error?: { message: string }; output?: OutputItem[] };

function extractMessageText(data: OpenAIResponse): string {
  return (
    data.output?.find((o) => o.type === "message")?.content?.[0]?.text ?? ""
  );
}

async function callOpenAI(
  base64: string,
  mimeType: string,
  prompt: string,
  size?: string,
): Promise<OpenAIResponse> {
  const body = JSON.stringify({
    model: "gpt-6-luna",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: `data:${mimeType};base64,${base64}`,
          },
          { type: "input_text", text: prompt },
        ],
      },
    ],
    tools: [
      {
        type: "image_generation",
        output_format: "png",
        ...(size && { size }),
      },
    ],
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

router.post(
  "/",
  upload.single("photo"),
  async (req: Request, res: Response) => {
    const name = req.body.name as string | undefined;
    // skill は ChatGPT に渡して生成させ、personality は入力値をそのまま保存する
    const inputSkill = (req.body.skill as string | undefined)?.trim() ?? "";
    const personality =
      (req.body.personality as string | undefined)?.trim() ?? "";
    if (!name) {
      res
        .status(400)
        .json({ success: false, message: "name フィールドが見つかりません" });
      return;
    }
    if (!req.file) {
      res
        .status(400)
        .json({ success: false, message: "photo フィールドが見つかりません" });
      return;
    }

    const base64 = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";

    const [characterData, medalData] = await Promise.all([
      callOpenAI(base64, mimeType, IMAGE_PROMPTS.character(name, inputSkill)),
      callOpenAI(base64, mimeType, IMAGE_PROMPTS.medal, "1024x1024"),
    ]);

    if (characterData.error) {
      res
        .status(422)
        .json({ success: false, message: characterData.error.message });
      return;
    }

    const characterOutput = characterData.output?.find(
      (o) => o.type === "image_generation_call",
    );

    const characterText = extractMessageText(characterData);

    if (!characterOutput?.result) {
      if (characterText.trim() === "NO_PERSON") {
        res
          .status(422)
          .json({ success: false, message: "人物を特定できませんでした" });
      } else {
        res
          .status(422)
          .json({ success: false, message: "画像の生成に失敗しました" });
      }
      return;
    }

    const skill = characterText.trim();

    const medalOutput = medalData.output?.find(
      (o) => o.type === "image_generation_call",
    );

    const imageFilename = `${randomUUID()}.png`;
    const medalFilename = medalOutput?.result ? `${randomUUID()}.png` : null;

    await Promise.all([
      uploadImage(
        imageFilename,
        Buffer.from(characterOutput.result, "base64"),
        "image/png",
      ),
      ...(medalFilename && medalOutput?.result
        ? [
            uploadImage(
              medalFilename,
              Buffer.from(medalOutput.result, "base64"),
              "image/png",
            ),
          ]
        : []),
    ]);

    const monster = await prisma.monster.create({
      data: { name, imageFilename, medalFilename, skill, personality },
    });

    res.status(201).json(monster);
  },
);

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
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
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
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
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
