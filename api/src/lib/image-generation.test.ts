import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { generateAndSaveImages } from "./image-generation";
import { uploadImage } from "./r2";
import { loadReferenceImage } from "./reference-images";

vi.mock("./r2", () => ({ getR2Config: vi.fn(), uploadImage: vi.fn() }));
vi.mock("./reference-images", () => ({ loadReferenceImage: vi.fn() }));

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const templatePng = Buffer.concat([png, Buffer.from("template")]);
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
  vi.stubEnv("CHATGPT_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => generated()));
  vi.mocked(uploadImage).mockResolvedValue(undefined);
  vi.mocked(loadReferenceImage).mockReset().mockResolvedValue(templatePng.toString("base64"));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("generateAndSaveImages", () => {
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
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(uploadImage).not.toHaveBeenCalled();
    expect(loadReferenceImage).not.toHaveBeenCalled();
    resolveCharacter(generated());
    const result = await pending;

    expect(fetch).toHaveBeenCalledTimes(2);
    const bodies = vi.mocked(fetch).mock.calls.map(([, options]) => JSON.parse(String(options?.body)));
    expect(bodies[0].input[0].content[0].image_url).toBe(`data:image/jpeg;base64,${photo.toString("base64")}`);
    expect(bodies[0].input[0].content).toHaveLength(2);
    expect(loadReferenceImage).toHaveBeenCalledExactlyOnceWith("medal");
    expect(bodies[1].input[0].content).toEqual([
      { type: "input_image", image_url: `data:image/png;base64,${png.toString("base64")}` },
      { type: "input_image", image_url: `data:image/png;base64,${templatePng.toString("base64")}` },
      { type: "input_text", text: expect.stringContaining("同一のキャラクター") },
    ]);
    expect(bodies[1].tools[0]).toMatchObject({ output_format: "png", size: "1024x1024" });
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
    expect(loadReferenceImage).not.toHaveBeenCalled();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("メダル元画像を読み込めなければメダル生成を呼ばずnullで継続する", async () => {
    vi.mocked(loadReferenceImage).mockRejectedValue(new Error("missing template"));
    const result = await generateAndSaveImages(input);
    expect(result.medalFilename).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(uploadImage).toHaveBeenCalledExactlyOnceWith(`${input.id}.png`, png, "image/png", expect.any(AbortSignal));
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
