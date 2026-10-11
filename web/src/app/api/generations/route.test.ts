import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { generateAndSaveImages } from "@/lib/image-generation";
import { GenerationError } from "@/lib/generation-input";

vi.mock("@/lib/image-generation", () => ({ generateAndSaveImages: vi.fn() }));

const id = "550e8400-e29b-41d4-a716-446655440000";
function request(token = "test-token", photo = new File([new Uint8Array([255, 216, 255, 224])], "photo.jpg", { type: "image/jpeg" })) {
  const form = new FormData();
  form.set("id", id);
  form.set("name", "demo");
  form.set("photo", photo);
  return new NextRequest("http://localhost/api/generations", {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("IMAGE_GENERATION_API_TOKEN", "test-token");
});

describe("POST /api/generations", () => {
  it("認証前に生成処理を呼ばない", async () => {
    expect((await POST(request("wrong-token"))).status).toBe(401);
    expect(generateAndSaveImages).not.toHaveBeenCalled();
  });

  it("実形式が不正な写真は415", async () => {
    const response = await POST(request("test-token", new File(["bad"], "photo.jpg", { type: "image/jpeg" })));
    expect(response.status).toBe(415);
    expect(generateAndSaveImages).not.toHaveBeenCalled();
  });

  it("4MB超の写真は413", async () => {
    expect((await POST(request("test-token", new File([new Uint8Array(4_000_001)], "photo.jpg", { type: "image/jpeg" })))).status).toBe(413);
    expect(generateAndSaveImages).not.toHaveBeenCalled();
  });

  it("生成・保存を待ってキーだけを200で返す", async () => {
    const result = { id, imageFilename: `${id}.png`, medalFilename: null, skill: "skill" };
    vi.mocked(generateAndSaveImages).mockResolvedValue(result);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(result);
  });

  it("保存失敗を502で返す", async () => {
    vi.mocked(generateAndSaveImages).mockRejectedValue(new GenerationError(502, "画像を保存できませんでした", "R2_UPLOAD_FAILED"));
    expect((await POST(request())).status).toBe(502);
  });
});
