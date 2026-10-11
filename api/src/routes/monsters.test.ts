import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import app from "../app";
import prisma from "../lib/prisma";

vi.mock("../lib/r2", () => ({
  uploadImage: vi.fn().mockResolvedValue(undefined),
}));

const mockOpenAI = (body: object, status = 200) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(body),
      status,
    })
  );
};

const imageGenerationResponse = (base64 = "abc123", text?: string) => ({
  output: [
    { type: "image_generation_call", result: base64 },
    ...(text !== undefined ? [{ type: "message", content: [{ type: "output_text", text }] }] : []),
  ],
});

describe("GET /monsters", () => {
  it("データがないとき空配列を返す", async () => {
    const res = await request(app).get("/monsters");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  describe("データがあるとき", () => {
    beforeEach(async () => {
      const book = await prisma.book.create({ data: {} });
      await prisma.monster.createMany({
        data: [
          {
            bookId: book.id,
            name: "ジバニャン",
            imageFilename: "jibanyan.png",
            medalFilename: "jibanyan_medal.png",
            skill: "ひゃくれつ肉球",
            personality: "めんどくさがり",
          },
          {
            bookId: book.id,
            name: "ウィスパー",
            imageFilename: "whisper.png",
            medalFilename: "whisper_medal.png",
            skill: "妖怪の案内",
            personality: "おしゃべり",
          },
        ],
      });
    });

    it("妖怪一覧を名前の昇順で返す", async () => {
      const res = await request(app).get("/monsters");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe("ウィスパー");
      expect(res.body[1].name).toBe("ジバニャン");
    });

    it("各妖怪が必要なフィールドを持つ", async () => {
      const res = await request(app).get("/monsters");
      const monster = res.body[0];

      expect(monster).toHaveProperty("id");
      expect(monster).toHaveProperty("bookId");
      expect(monster).toHaveProperty("name");
      expect(monster).toHaveProperty("imageFilename");
      expect(monster).toHaveProperty("medalFilename");
      expect(monster).toHaveProperty("skill");
      expect(monster).toHaveProperty("personality");
      expect(monster).not.toHaveProperty("description");
    });
  });
});

describe("POST /monsters", () => {
  const photoBuffer = Buffer.from("fake image data");

  it("name がないとき 400 を返す", async () => {
    const res = await request(app)
      .post("/monsters")
      .attach("photo", photoBuffer, "photo.jpg");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("name フィールドが見つかりません");
  });

  it("photo がないとき 400 を返す", async () => {
    const res = await request(app)
      .post("/monsters")
      .field("name", "ジバニャン");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("photo フィールドが見つかりません");
  });

  it("ChatGPT がエラーを返したとき 422 を返す", async () => {
    mockOpenAI({ error: { message: "API error" } });

    const res = await request(app)
      .post("/monsters")
      .field("name", "ジバニャン")
      .attach("photo", photoBuffer, "photo.jpg");

    expect(res.status).toBe(422);
    expect(res.body.message).toBe("API error");
  });

  it("人物が写っていないとき 422 を返す", async () => {
    mockOpenAI({
      output: [{ type: "message", content: [{ text: "NO_PERSON" }] }],
    });

    const res = await request(app)
      .post("/monsters")
      .field("name", "ジバニャン")
      .attach("photo", photoBuffer, "photo.jpg");

    expect(res.status).toBe(422);
    expect(res.body.message).toBe("人物を特定できませんでした");
  });

  it("画像生成に成功したとき monster を DB に保存して 201 を返す", async () => {
    mockOpenAI(imageGenerationResponse());

    const res = await request(app)
      .post("/monsters")
      .field("name", "ジバニャン")
      .attach("photo", photoBuffer, "photo.jpg");

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("ジバニャン");
    expect(res.body.id).toBeDefined();
    expect(res.body.imageFilename).toMatch(/^[\w-]+\.png$/);
  });

  it("生成された monster が DB に保存されている", async () => {
    mockOpenAI(imageGenerationResponse());

    const res = await request(app)
      .post("/monsters")
      .field("name", "ジバニャン")
      .attach("photo", photoBuffer, "photo.jpg");

    const saved = await prisma.monster.findUnique({ where: { id: res.body.id } });
    expect(saved?.name).toBe("ジバニャン");
    expect(saved?.imageFilename).toBe(res.body.imageFilename);
  });

  it("入力された skill を ChatGPT に渡し、生成されたとくぎを保存する", async () => {
    mockOpenAI(imageGenerationResponse("abc123", "ひゃくれつ肉球パンチ\n"));

    const res = await request(app)
      .post("/monsters")
      .field("name", "ジバニャン")
      .field("skill", "ねこパンチ")
      .attach("photo", photoBuffer, "photo.jpg");

    expect(res.status).toBe(201);
    expect(res.body.skill).toBe("ひゃくれつ肉球パンチ");
    const prompts = vi.mocked(fetch).mock.calls.map(([, init]) => String(init?.body));
    expect(prompts.some((body) => body.includes("ねこパンチ"))).toBe(true);
    const saved = await prisma.monster.findUnique({ where: { id: res.body.id } });
    expect(saved?.skill).toBe("ひゃくれつ肉球パンチ");
  });

  it("入力された personality をそのまま保存する", async () => {
    mockOpenAI(imageGenerationResponse("abc123", "ひゃくれつ肉球"));

    const res = await request(app)
      .post("/monsters")
      .field("name", "ジバニャン")
      .field("personality", "めんどくさがり")
      .attach("photo", photoBuffer, "photo.jpg");

    expect(res.status).toBe(201);
    expect(res.body.personality).toBe("めんどくさがり");
    const saved = await prisma.monster.findUnique({ where: { id: res.body.id } });
    expect(saved?.personality).toBe("めんどくさがり");
  });

  it("テキストも personality もないとき skill と personality は空文字で保存する", async () => {
    mockOpenAI(imageGenerationResponse());

    const res = await request(app)
      .post("/monsters")
      .field("name", "ジバニャン")
      .attach("photo", photoBuffer, "photo.jpg");

    expect(res.status).toBe(201);
    expect(res.body.skill).toBe("");
    expect(res.body.personality).toBe("");
  });
});

describe("GET /monsters/:id", () => {
  let monsterId: string;

  beforeEach(async () => {
    const monster = await prisma.monster.create({
      data: { name: "ジバニャン", imageFilename: "jibanyan.png" },
    });
    monsterId = monster.id;
  });

  it("存在するIDのとき monster を返す", async () => {
    const res = await request(app).get(`/monsters/${monsterId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(monsterId);
    expect(res.body.name).toBe("ジバニャン");
  });

  it("存在しないIDのとき 404 を返す", async () => {
    const res = await request(app).get("/monsters/non-existent-id");

    expect(res.status).toBe(404);
  });
});

describe("PATCH /monsters/:id", () => {
  let monsterId: string;

  beforeEach(async () => {
    const monster = await prisma.monster.create({
      data: { name: "ジバニャン", imageFilename: "jibanyan.png" },
    });
    monsterId = monster.id;
  });

  it("name を更新して更新後の monster を返す", async () => {
    const res = await request(app)
      .patch(`/monsters/${monsterId}`)
      .send({ name: "ジバニャンEX" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(monsterId);
    expect(res.body.name).toBe("ジバニャンEX");
  });

  it("存在しないIDのとき 404 を返す", async () => {
    const res = await request(app)
      .patch("/monsters/non-existent-id")
      .send({ name: "ジバニャンEX" });

    expect(res.status).toBe(404);
  });

  it("name が空のとき 400 を返す", async () => {
    const res = await request(app)
      .patch(`/monsters/${monsterId}`)
      .send({ name: "" });

    expect(res.status).toBe(400);
  });

  it("name がないとき 400 を返す", async () => {
    const res = await request(app)
      .patch(`/monsters/${monsterId}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("DELETE /monsters/:id", () => {
  let monsterId: string;

  beforeEach(async () => {
    const monster = await prisma.monster.create({
      data: { name: "ジバニャン", imageFilename: "jibanyan.png" },
    });
    monsterId = monster.id;
  });

  it("正常に削除して 204 を返す", async () => {
    const res = await request(app).delete(`/monsters/${monsterId}`);

    expect(res.status).toBe(204);
  });

  it("削除後に GET すると 404 になる", async () => {
    await request(app).delete(`/monsters/${monsterId}`);

    const res = await request(app).get(`/monsters/${monsterId}`);
    expect(res.status).toBe(404);
  });

  it("存在しないIDのとき 404 を返す", async () => {
    const res = await request(app).delete("/monsters/non-existent-id");

    expect(res.status).toBe(404);
  });
});
