import { Request, Response, Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { generateImages, GenerationClientError, getGenerationConfig } from "../lib/image-generation-client";
import { MAX_PHOTO_BYTES, validateGenerationInput } from "../lib/generation-input";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 3, fieldSize: 4_000 },
});

router.post("/", (req: Request, res: Response, next) => {
  upload.single("photo")(req, res, (error: unknown) => {
    if (error) {
      const tooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({
        success: false,
        message: tooLarge ? "写真は4MB以下にしてください" : "送信形式が正しくありません",
      });
      return;
    }
    next();
  });
}, async (req: Request, res: Response) => {
  const input = validateGenerationInput(req.body ?? {}, req.file);
  if (input.error) {
    res.status(input.status).json({ success: false, message: input.error });
    return;
  }
  try {
    getGenerationConfig();
  } catch {
    res.status(503).json({ success: false, message: "画像生成APIが設定されていません" });
    return;
  }

  const id = randomUUID();
  const started = Date.now();
  res.set("Cache-Control", "no-store").status(202).json({ id, status: "processing" });

  let stage = "generation";
  try {
    // The generation API responds only after all generated images are saved to R2.
    const generated = await generateImages({ id, ...input.value });
    stage = "registration";
    const { name, personality } = input.value;
    await prisma.monster.create({
      data: {
        id, name, personality,
        imageFilename: generated.imageFilename,
        medalFilename: generated.medalFilename,
        skill: generated.skill,
      },
    });
    console.info("monster_registered", { id, elapsedMs: Date.now() - started });
  } catch (error) {
    console.error("monster_processing_failed", {
      id, stage, elapsedMs: Date.now() - started,
      errorType: error instanceof Error ? error.name : "UnknownError",
      code: error instanceof GenerationClientError ? error.code : undefined,
    });
  }
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
  res.set("Cache-Control", "no-store");
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
