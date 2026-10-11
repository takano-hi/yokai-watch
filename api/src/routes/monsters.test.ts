import request from "supertest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import app from "../app";
import prisma from "../lib/prisma";

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
  const submit = () => request(app).post("/monsters")
    .field("name", "ジバニャン").attach("photo", photoBuffer, "photo.jpg");
  const result = (id: string) => ({
    id, imageFilename: `${id}.png`, medalFilename: `${id}-medal.png`, skill: "ひゃくれつ肉球",
  });

  beforeEach(() => {
    vi.stubEnv("IMAGE_GENERATION_API_URL", "https://generation.example/api/generations");
    vi.stubEnv("IMAGE_GENERATION_API_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("nameがなければ400", async () => {
    const res = await request(app).post("/monsters").attach("photo", photoBuffer, "photo.jpg");
    expect(res.status).toBe(400);
  });

  it("photoがなければ400", async () => {
    const res = await request(app).post("/monsters").field("name", "ジバニャン");
    expect(res.status).toBe(400);
  });

  it("空白の名前は400", async () => {
    const res = await request(app).post("/monsters").field("name", "   ")
      .attach("photo", photoBuffer, "photo.jpg");
    expect(res.status).toBe(400);
  });

  it("写真の実形式が不正なら415", async () => {
    const res = await request(app).post("/monsters").field("name", "demo")
      .attach("photo", Buffer.from("not a jpeg"), "photo.jpg");
    expect(res.status).toBe(415);
  });

  it("4MBを超える写真は413", async () => {
    const res = await request(app).post("/monsters").field("name", "demo")
      .attach("photo", Buffer.alloc(4_000_001), "photo.jpg");
    expect(res.status).toBe(413);
  });

  it("生成API未設定なら受付前に503", async () => {
    vi.stubEnv("IMAGE_GENERATION_API_TOKEN", "");
    const res = await submit();
    expect(res.status).toBe(503);
    expect(await prisma.monster.count()).toBe(0);
  });

  it("生成APIが応答する前に202を返し、R2保存完了の結果を待って発行済みIDで登録する", async () => {
    let complete!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { complete = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await request(app).post("/monsters").field("name", " ジバニャン ")
      .field("skill", "ねこパンチ").field("personality", "めんどくさがり")
      .attach("photo", photoBuffer, "photo.jpg");
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("processing");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(await prisma.monster.count()).toBe(0);
    expect((await request(app).get(`/monsters/${res.body.id}`)).status).toBe(404);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const form = init.body as FormData;
    expect(form.get("id")).toBe(res.body.id);
    expect(form.get("skill")).toBe("ねこパンチ");
    expect(form.get("personality")).toBe("めんどくさがり");
    expect(init.headers).toEqual({ Authorization: "Bearer test-token" });
    complete(Response.json(result(res.body.id)));
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

  it.each([502, 504])("生成・R2保存が失敗した場合（%s）も202で受付後、DB登録せずログに残す", async (status) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("upstream failed", { status })));
    const res = await submit();
    expect(res.status).toBe(202);
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(await prisma.monster.count()).toBe(0);
  });

  it("不正なIDの生成結果は登録しない", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(result("wrong-id"))));
    const res = await submit();
    expect(res.status).toBe(202);
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(await prisma.monster.count()).toBe(0);
  });

  it("メダルなしの成功結果も同じIDで登録する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const id = (init.body as FormData).get("id") as string;
      return Response.json({ ...result(id), medalFilename: null });
    }));
    const res = await submit();
    expect(res.status).toBe(202);
    await vi.waitFor(async () => {
      const saved = await prisma.monster.findUnique({ where: { id: res.body.id } });
      expect(saved).not.toBeNull();
      expect(saved?.medalFilename).toBeNull();
    });
  });

  it("生成APIが200で非JSONを返してもDB登録しない", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    expect((await submit()).status).toBe(202);
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(await prisma.monster.count()).toBe(0);
  });

  it("応答後のDB登録失敗を捕捉する", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const originalCreate = prisma.monster.create;
    prisma.monster.create = vi.fn().mockRejectedValueOnce(new Error("DB unavailable"));
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      return Response.json(result((init.body as FormData).get("id") as string));
    }));
    try {
      expect((await submit()).status).toBe(202);
      await vi.waitFor(() => expect(log).toHaveBeenCalledWith("monster_processing_failed", expect.objectContaining({ stage: "registration" })));
      expect(await prisma.monster.count()).toBe(0);
    } finally {
      prisma.monster.create = originalCreate;
    }
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
