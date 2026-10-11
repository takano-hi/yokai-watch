import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { generateAndSaveImages } from "./image-generation";
import { uploadImage } from "./r2";

vi.mock("./r2", () => ({ getR2Config: vi.fn(), uploadImage: vi.fn() }));

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
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
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("generateAndSaveImages", () => {
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
    expect(bodies.some((body) => body.includes("running"))).toBe(true);
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
    expect(uploadImage).not.toHaveBeenCalled();
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
