import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { generateAndSaveImages } from "./image-generation";
import { uploadImage } from "./r2";
import { loadReferenceImage } from "./reference-images";

vi.mock("./r2", () => ({ getR2Config: vi.fn(), uploadImage: vi.fn() }));
vi.mock("./reference-images", () => ({ loadReferenceImage: vi.fn() }));

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const templatePng = Buffer.concat([png, Buffer.from("template")]);
const characterTemplates = {
  character: Buffer.concat([png, Buffer.from("character-1")]).toString("base64"),
  character2: Buffer.concat([png, Buffer.from("character-2")]).toString("base64"),
  medal: templatePng.toString("base64"),
  medal2: Buffer.concat([png, Buffer.from("medal-2")]).toString("base64"),
  medal3: Buffer.concat([png, Buffer.from("medal-3")]).toString("base64"),
};
const input = {
  id: "550e8400-e29b-41d4-a716-446655440000", name: "demo", skill: "running",
  personality: "shy", bytes: png, mimeType: "image/png",
};
const generated = () => Response.json({ output: [
  { type: "image_generation_call", result: png.toString("base64") },
  { type: "message", content: [{ text: "とくぎ\n" }] },
] });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.stubEnv("CHATGPT_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => generated()));
  vi.mocked(uploadImage).mockResolvedValue(undefined);
  vi.mocked(loadReferenceImage).mockReset().mockImplementation(async (kind) => characterTemplates[kind]);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("generateAndSaveImages", () => {
  it.each([0, 0.499999, 0.5, 0.999999])("乱数 %s に応じてcharacterのプロンプトと見本を一緒に選ぶ", async (random) => {
    vi.mocked(Math.random).mockReturnValueOnce(random).mockReturnValue(0);

    await generateAndSaveImages(input);

    const bodies = vi.mocked(fetch).mock.calls.map(([, options]) => JSON.parse(String(options?.body)));
    const referenceKind = random < 0.5 ? "character" : "character2";
    expect(loadReferenceImage).toHaveBeenNthCalledWith(1, referenceKind);
    expect(loadReferenceImage).toHaveBeenNthCalledWith(2, "medal");
    expect(loadReferenceImage).toHaveBeenCalledTimes(2);
    expect(bodies[0].input[0].content).toEqual([
      { type: "input_image", image_url: `data:image/png;base64,${input.bytes.toString("base64")}` },
      { type: "input_image", image_url: `data:image/png;base64,${characterTemplates[referenceKind]}` },
      { type: "input_text", text: expect.any(String) },
    ]);
    const characterPrompt = bodies[0].input[0].content[2].text;
    expect(characterPrompt).toContain("人物の特徴は1枚目から、フォルム・絵柄は2枚目から参照してください。");
    if (random < 0.5) {
      expect(characterPrompt).toContain("この人を妖怪ウォッチの妖怪風にしてください。");
      expect(characterPrompt).toContain(input.personality);
      expect(characterPrompt).toContain("【フォルム・絵柄】");
      expect(characterPrompt).not.toContain("足はお化け");
    } else {
      expect(characterPrompt).toContain(`この人を妖怪ウォッチの妖怪風にしてください。
足はお化けにみたいにしてください。
入力された名前をそのまま妖怪の名前にしてください。
入力されたこの人を表した言葉をそのまま性格にしてください。
入力された一言を用いてスキルを作ってください。
それ以外は出力しないでください。
背景は透過してください。
性格は${input.personality}です。必ず妖怪キャラクター画像を生成してください。画像とは別に、テキスト部分には性格に合うスキル名だけを返してください。`);
    }
    expect(Math.random).toHaveBeenCalledTimes(2);
    expect(bodies[1].input[0].content[2].text).toContain("2枚目のメダル");
  });

  it.each([
    [0, "medal"], [1 / 3 - 0.000001, "medal"],
    [1 / 3, "medal2"], [2 / 3 - 0.000001, "medal2"],
    [2 / 3, "medal3"], [0.999999, "medal3"],
  ] as const)("メダル用の乱数 %s で選んだ %s だけを送信する", async (random, referenceKind) => {
    vi.mocked(Math.random).mockReturnValueOnce(0.5).mockReturnValueOnce(random);
    await generateAndSaveImages(input);
    expect(Math.random).toHaveBeenCalledTimes(2);
    expect(loadReferenceImage).toHaveBeenNthCalledWith(1, "character2");
    expect(loadReferenceImage).toHaveBeenNthCalledWith(2, referenceKind);
    expect(loadReferenceImage).toHaveBeenCalledTimes(2);
    const bodies = vi.mocked(fetch).mock.calls.map(([, options]) => JSON.parse(String(options?.body)));
    expect(bodies[1].input[0].content).toEqual([
      { type: "input_image", image_url: `data:image/png;base64,${png.toString("base64")}` },
      { type: "input_image", image_url: `data:image/png;base64,${characterTemplates[referenceKind]}` },
      { type: "input_text", text: expect.stringContaining("2枚目のメダル") },
    ]);
  });

  it("OpenAIのエラー詳細とリクエストIDを記録し、既存のエラーを返す", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: {
      message: "Unsupported background", param: "tools[0].background", code: "invalid_value",
      extra: "do not log",
    } }, { status: 400, headers: { "x-request-id": "req-test" } }));

    await expect(generateAndSaveImages(input)).rejects.toMatchObject({ status: 422, code: "OPENAI_HTTP_400" });
    expect(console.error).toHaveBeenCalledWith("openai_request_failed", {
      id: input.id, status: 400, requestId: "req-test", message: "Unsupported background",
      param: "tools[0].background", code: "invalid_value",
    });
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it.each(["not JSON", "null", '{"error":"unexpected"}'])("エラー本文が不正でもHTTPエラーを維持する: %s", async (body) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { status: 403 }));
    await expect(generateAndSaveImages(input)).rejects.toMatchObject({ status: 503, code: "OPENAI_HTTP_403" });
    expect(console.error).toHaveBeenCalledWith("openai_request_failed", {
      id: input.id, status: 403, requestId: null, message: null, param: null, code: null,
    });
  });

  it("ログのエラー詳細からAPIキーと画像データを除外し、長さを制限する", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: {
      message: `test-key data:image/png;base64,secret ${"x".repeat(3_000)}`,
      param: 123, code: null,
    } }, { status: 400 }));
    await expect(generateAndSaveImages(input)).rejects.toMatchObject({ code: "OPENAI_HTTP_400" });
    const details = vi.mocked(console.error).mock.calls.find(([event]) => event === "openai_request_failed")?.[1];
    expect(details).toMatchObject({ param: null, code: null });
    expect(details.message).toHaveLength(2_000);
    expect(details.message).toContain("[REDACTED] [REDACTED_IMAGE]");
    expect(details.message).not.toContain("test-key");
    expect(details.message).not.toContain("secret");
  });

  it("妖怪画像の生成完了後、そのPNGとメダル元画像を入力としてメダルを生成する", async () => {
    const photo = Buffer.from([255, 216, 255, 224]);
    const medalPng = Buffer.concat([png, Buffer.from("medal")]);
    let resolveCharacter!: (response: Response) => void;
    vi.mocked(fetch)
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveCharacter = resolve; }))
      .mockResolvedValueOnce(Response.json({ output: [
        { type: "image_generation_call", result: medalPng.toString("base64") },
        { type: "message", content: [{ text: "メダル用テキスト" }] },
      ] }));
    const pending = generateAndSaveImages({ ...input, bytes: photo, mimeType: "image/jpeg" });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(uploadImage).not.toHaveBeenCalled();
    expect(loadReferenceImage).toHaveBeenCalledExactlyOnceWith("character");
    resolveCharacter(generated());
    const result = await pending;

    expect(fetch).toHaveBeenCalledTimes(2);
    const bodies = vi.mocked(fetch).mock.calls.map(([, options]) => JSON.parse(String(options?.body)));
    expect(bodies[0].input[0].content[0].image_url).toBe(`data:image/jpeg;base64,${photo.toString("base64")}`);
    expect(bodies[0].input[0].content).toHaveLength(3);
    expect(bodies[0].input[0].content[1].image_url).toBe(`data:image/png;base64,${characterTemplates.character}`);
    expect(bodies[0].model).toBe("gpt-6-luna");
    expect(bodies[0].tools[0]).toEqual({
      type: "image_generation", model: "gpt-image-2.5-flare", quality: "medium", size: "816x816",
      background: "transparent", output_format: "png",
    });
    expect(loadReferenceImage).toHaveBeenNthCalledWith(2, "medal");
    expect(bodies[1].input[0].content).toEqual([
      { type: "input_image", image_url: `data:image/png;base64,${png.toString("base64")}` },
      { type: "input_image", image_url: `data:image/png;base64,${templatePng.toString("base64")}` },
      { type: "input_text", text: expect.stringContaining("2枚目のメダルの形・枠・背景・配色・装飾はそのまま") },
    ]);
    expect(bodies[1].model).toBe("gpt-6-luna");
    expect(bodies[1].tools[0]).toEqual({
      type: "image_generation", model: "gpt-image-2.5-flare", quality: "medium", size: "816x816",
      background: "transparent", output_format: "png",
    });
    expect(uploadImage).toHaveBeenCalledWith(`${input.id}.png`, png, "image/png", expect.any(AbortSignal));
    expect(uploadImage).toHaveBeenCalledWith(`${input.id}-medal.png`, medalPng, "image/png", expect.any(AbortSignal));
    expect(result.skill).toBe("とくぎ");
  });

  it("両方のR2保存が完了するまで登録用の結果を返さない", async () => {
    const saves: (() => void)[] = [];
    vi.mocked(uploadImage).mockImplementation(() => new Promise<void>((resolve) => saves.push(resolve)));
    let completed = false;
    const pending = generateAndSaveImages(input, new AbortController().signal).then((value) => {
      completed = true;
      return value;
    });
    await vi.waitFor(() => expect(saves).toHaveLength(2));
    saves[0]();
    await Promise.resolve();
    expect(completed).toBe(false);
    saves[1]();
    expect(await pending).toEqual({
      id: input.id, imageFilename: `${input.id}.png`, medalFilename: `${input.id}-medal.png`, skill: "とくぎ",
    });
    const bodies = vi.mocked(fetch).mock.calls.map(([, options]) => String(options?.body));
    expect(bodies[0]).toContain(input.personality);
  });

  it("R2保存が失敗したら成功結果を返さない", async () => {
    vi.mocked(uploadImage).mockRejectedValue(new Error("storage failed"));
    await expect(generateAndSaveImages(input, new AbortController().signal)).rejects.toMatchObject({ status: 502 });
  });

  it("メダル生成だけの失敗はnullで継続する", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(generated()).mockResolvedValueOnce(new Response("failed", { status: 500 }));
    const result = await generateAndSaveImages(input, new AbortController().signal);
    expect(result.medalFilename).toBeNull();
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });

  it("キャラクター生成の拒否ではR2へ保存しない", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ output: [{ type: "message", content: [{ text: "NO_PERSON" }] }] }));
    await expect(generateAndSaveImages(input, new AbortController().signal)).rejects.toMatchObject({ status: 422 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(loadReferenceImage).toHaveBeenCalledExactlyOnceWith("character");
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it.each([
    [0, "medal"], [1 / 3, "medal2"], [2 / 3, "medal3"],
  ] as const)("%s で選んだ %s を読み込めなければメダル生成を呼ばずnullで継続する", async (random, referenceKind) => {
    vi.mocked(Math.random).mockReturnValueOnce(0).mockReturnValueOnce(random);
    vi.mocked(loadReferenceImage).mockImplementation(async (kind) => {
      if (kind === referenceKind) throw new Error("missing template");
      return characterTemplates[kind];
    });
    const result = await generateAndSaveImages(input);
    expect(result.medalFilename).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(loadReferenceImage).toHaveBeenNthCalledWith(2, referenceKind);
    expect(loadReferenceImage).toHaveBeenCalledTimes(2);
    expect(uploadImage).toHaveBeenCalledExactlyOnceWith(`${input.id}.png`, png, "image/png", expect.any(AbortSignal));
  });

  it.each([0, 0.5])("乱数 %s で選んだcharacterの見本を読めなければ生成・保存を中止する", async (random) => {
    vi.mocked(Math.random).mockReturnValue(random);
    vi.mocked(loadReferenceImage).mockRejectedValue(new Error("missing character reference"));
    await expect(generateAndSaveImages(input)).rejects.toMatchObject({ status: 502, code: "UPSTREAM_ERROR" });
    expect(loadReferenceImage).toHaveBeenCalledExactlyOnceWith(random < 0.5 ? "character" : "character2");
    expect(fetch).not.toHaveBeenCalled();
    expect(uploadImage).not.toHaveBeenCalled();
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
