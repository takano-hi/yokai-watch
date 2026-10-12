import request from "supertest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import app from "../app";
import prisma from "../lib/prisma";
import { getR2Config, uploadImage } from "../lib/r2";

vi.mock("../lib/r2", () => ({ getR2Config: vi.fn(), uploadImage: vi.fn() }));

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
  const photoBuffer = Buffer.from([255, 216, 255, 224, 0, 0]);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const submit = () => request(app).post("/monsters")
    .field("name", "ジバニャン").attach("photo", photoBuffer, "photo.jpg");
  const generated = () => Response.json({ output: [
    { type: "image_generation_call", result: png.toString("base64") },
    { type: "message", content: [{ text: "ひゃくれつ肉球\n" }] },
  ] });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CHATGPT_API_KEY", "existing-openai-key");
    vi.stubEnv("IMAGE_GENERATION_API_URL", "");
    vi.stubEnv("IMAGE_GENERATION_API_TOKEN", "");
    vi.mocked(getR2Config).mockReset();
    vi.mocked(uploadImage).mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => generated()));
  });

  afterEach(() => {
    vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks();
  });

  it("nameがなければ400", async () => {
    expect((await request(app).post("/monsters").attach("photo", photoBuffer, "photo.jpg")).status).toBe(400);
  });
  it("photoがなければ400", async () => {
    expect((await request(app).post("/monsters").field("name", "ジバニャン")).status).toBe(400);
  });
  it("空白の名前は400", async () => {
    expect((await request(app).post("/monsters").field("name", "   ").attach("photo", photoBuffer, "photo.jpg")).status).toBe(400);
  });
  it("写真の実形式が不正なら415", async () => {
    expect((await request(app).post("/monsters").field("name", "demo").attach("photo", Buffer.from("not a jpeg"), "photo.jpg")).status).toBe(415);
  });
  it("4MBを超える写真は413", async () => {
    expect((await request(app).post("/monsters").field("name", "demo").attach("photo", Buffer.alloc(4_000_001), "photo.jpg")).status).toBe(413);
  });
  it("既存OpenAIキー未設定なら受付前に503", async () => {
    vi.stubEnv("CHATGPT_API_KEY", "");
    expect((await submit()).status).toBe(503);
    expect(await prisma.monster.count()).toBe(0);
  });
  it("既存R2設定が不備なら受付前に503", async () => {
    vi.mocked(getR2Config).mockImplementation(() => { throw new Error("not configured"); });
    expect((await submit()).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("追加接続設定なしで202を先に返し、すべてのR2保存後に発行済みIDで登録する", async () => {
    const replies: ((response: Response) => void)[] = [];
    const saves: (() => void)[] = [];
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>((resolve) => replies.push(resolve)));
    vi.mocked(uploadImage).mockImplementation(() => new Promise<void>((resolve) => saves.push(resolve)));
    const res = await request(app).post("/monsters").field("name", " ジバニャン ")
      .field("skill", "ねこパンチ").field("personality", "めんどくさがり")
      .attach("photo", photoBuffer, "photo.jpg");
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("processing");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(await prisma.monster.count()).toBe(0);
    expect((await request(app).get(`/monsters/${res.body.id}`)).status).toBe(404);
    expect(replies).toHaveLength(1);
    replies[0](generated());
    await vi.waitFor(() => expect(replies).toHaveLength(2));
    for (const [url, init] of vi.mocked(fetch).mock.calls) {
      expect(url).toBe("https://api.openai.com/v1/responses");
      expect(init?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer existing-openai-key" }));
    }
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => String(init?.body).includes("めんどくさがり"))).toBe(true);
    const bodies = vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies[0].input[0].content[0].image_url).toBe(`data:image/jpeg;base64,${photoBuffer.toString("base64")}`);
    expect(bodies[1].input[0].content[0].image_url).toBe(`data:image/png;base64,${png.toString("base64")}`);
    expect(bodies[1].input[0].content[1]).toMatchObject({ type: "input_image", image_url: expect.stringMatching(/^data:image\/png;base64,/) });
    replies[1](generated());
    await vi.waitFor(() => expect(saves).toHaveLength(2));
    saves[0]();
    expect(await prisma.monster.count()).toBe(0);
    saves[1]();
    await vi.waitFor(async () => {
      const saved = await prisma.monster.findUnique({ where: { id: res.body.id } });
      expect(saved?.name).toBe("ジバニャン");
      expect(saved?.personality).toBe("めんどくさがり");
      expect(saved?.skill).toBe("ひゃくれつ肉球");
      expect(saved?.imageFilename).toBe(`${res.body.id}.png`);
    });
    const registered = await request(app).get(`/monsters/${res.body.id}`);
    expect(registered.status).toBe(200);
    expect(registered.headers["cache-control"]).toBe("no-store");
  });

  it("OpenAI生成失敗後はDB登録しない", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockImplementation(async () => new Response("failed", { status: 500 }));
    expect((await submit()).status).toBe(202);
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(uploadImage).not.toHaveBeenCalled();
    expect(await prisma.monster.count()).toBe(0);
  });
  it("R2保存失敗後はDB登録しない", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(uploadImage).mockRejectedValue(new Error("storage failed"));
    expect((await submit()).status).toBe(202);
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(await prisma.monster.count()).toBe(0);
  });
  it("メダル生成のみの失敗はnullで登録する", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(generated()).mockResolvedValueOnce(new Response("failed", { status: 500 }));
    const res = await submit();
    expect(res.status).toBe(202);
    await vi.waitFor(async () => {
      const saved = await prisma.monster.findUnique({ where: { id: res.body.id } });
      expect(saved).not.toBeNull(); expect(saved?.medalFilename).toBeNull();
    });
  });
  it("OpenAIが非JSONを返したらDB登録しない", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockImplementation(async () => new Response("not json"));
    expect((await submit()).status).toBe(202);
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(await prisma.monster.count()).toBe(0);
  });
  it("応答後のDB登録失敗を捕捉する", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const originalCreate = prisma.monster.create;
    prisma.monster.create = vi.fn().mockRejectedValueOnce(new Error("DB unavailable"));
    try {
      expect((await submit()).status).toBe(202);
      await vi.waitFor(() => expect(log).toHaveBeenCalledWith("monster_processing_failed", expect.objectContaining({ stage: "registration" })));
      expect(await prisma.monster.count()).toBe(0);
    } finally { prisma.monster.create = originalCreate; }
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
