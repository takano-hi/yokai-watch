import { afterEach, describe, expect, it, vi } from "vitest";
import { postMonster } from "./api";

const id = "550e8400-e29b-41d4-a716-446655440000";
const photo = new File([new Uint8Array([255, 216, 255])], "photo.jpg", { type: "image/jpeg" });
const monster = { id, name: "demo", imageFilename: `${id}.png`, medalFilename: null, bookId: null, skill: "skill", personality: "shy" };

afterEach(() => vi.useRealTimers());

describe("postMonster", () => {
  it("202のIDを確認し404後に登録結果を返し、skill・personalityも送信する", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ id, status: "processing" }, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(Response.json(monster));
    vi.stubGlobal("fetch", fetchMock);
    const pending = postMonster("demo", photo, "running", "shy");
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await pending).toMatchObject({ success: true, monster });
    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get("skill")).toBe("running");
    expect(form.get("personality")).toBe("shy");
    expect(fetchMock.mock.calls[1][1].cache).toBe("no-store");
  });

  it("登録未確認は期限で打ち切り、再生成を送らない", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ id, status: "processing" }, { status: 202 }))
      .mockImplementation(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = postMonster("demo", photo);
    await vi.advanceTimersByTimeAsync(330_000);
    expect(await pending).toEqual({ success: false, message: "時間内に登録を確認できませんでした" });
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  });

  it("中断後はポーリングを止める", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ id, status: "processing" }, { status: 202 }))
      .mockImplementation(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const pending = postMonster("demo", photo, "", "", controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await assertion;
    await vi.advanceTimersByTimeAsync(9_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
