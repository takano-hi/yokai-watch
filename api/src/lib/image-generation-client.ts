export type GenerationInput = {
  id: string;
  name: string;
  skill: string;
  personality: string;
  photo: { buffer: Buffer; mimetype: string };
};

export type GenerationResult = {
  id: string;
  imageFilename: string;
  medalFilename: string | null;
  skill: string;
};

export class GenerationClientError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "GenerationClientError";
  }
}

export function getGenerationConfig() {
  const url = process.env.IMAGE_GENERATION_API_URL;
  const token = process.env.IMAGE_GENERATION_API_TOKEN;
  if (!url || !token) throw new Error("GENERATION_NOT_CONFIGURED");
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("GENERATION_NOT_CONFIGURED");
  }
  return { url, token };
}

export async function generateImages(input: GenerationInput): Promise<GenerationResult> {
  const { url, token } = getGenerationConfig();
  const form = new FormData();
  form.set("id", input.id);
  form.set("name", input.name);
  form.set("skill", input.skill);
  form.set("personality", input.personality);
  form.set("photo", new Blob([new Uint8Array(input.photo.buffer)], {
    type: input.photo.mimetype,
  }), "photo");

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: form,
    signal: AbortSignal.timeout(290_000),
  });
  if (!response.ok) throw new GenerationClientError(`GENERATION_HTTP_${response.status}`);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object") throw new GenerationClientError("INVALID_GENERATION_RESULT");
  const data = result as Record<string, unknown>;
  if (data.id !== input.id || data.imageFilename !== `${input.id}.png` ||
      (data.medalFilename !== null && data.medalFilename !== `${input.id}-medal.png`) ||
      typeof data.skill !== "string") {
    throw new GenerationClientError("INVALID_GENERATION_RESULT");
  }
  return data as GenerationResult;
}
