import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { serverEnv } from "@/lib/env";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("Gemini is not configured. Set GEMINI_API_KEY on the server to enable AI features.");
  }
}

export class AiOutputError extends Error {}

let client: GoogleGenAI | null = null;
function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiNotConfiguredError();
  client ??= new GoogleGenAI({ apiKey: key });
  return client;
}

export interface GenerateOptions<T extends z.ZodType> {
  system: string;
  prompt: string;
  schema: T;
  /** Optional audio for transcript extraction (inline, ≤ ~15 MB). */
  audio?: { mimeType: string; base64: string };
  temperature?: number;
}

/**
 * Calls Gemini server-side and returns output validated against a zod schema.
 * Retries once if the model returns malformed JSON.
 */
export async function generateJson<T extends z.ZodType>(
  opts: GenerateOptions<T>,
): Promise<{ data: z.infer<T>; model: string }> {
  const ai = getClient();
  const models = [serverEnv.geminiModel(), ...serverEnv.geminiFallbacks()];
  let model = models[0];
  const jsonSchema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;

  const parts: Array<Record<string, unknown>> = [];
  if (opts.audio) parts.push({ inlineData: { mimeType: opts.audio.mimeType, data: opts.audio.base64 } });
  parts.push({ text: opts.prompt });

  let lastError: unknown;
  for (let attempt = 0; attempt < models.length * 2 + 1; attempt++) {
    model = models[Math.min(Math.floor(attempt / 2), models.length - 1)];
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature ?? 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      });
      const text = res.text;
      if (!text) throw new AiOutputError("Gemini returned an empty response.");
      const parsed = opts.schema.safeParse(JSON.parse(text));
      if (!parsed.success) throw new AiOutputError("Gemini output did not match the expected structure.");
      return { data: parsed.data, model };
    } catch (e) {
      lastError = e;
      if (e instanceof AiNotConfiguredError) throw e;
      const malformed = e instanceof AiOutputError || e instanceof SyntaxError;
      const transient = !malformed && /"code":\s*(429|500|503|504)|UNAVAILABLE|RESOURCE_EXHAUSTED/.test(e instanceof Error ? e.message : "");
      if (malformed && attempt >= 1) break; // one retry for malformed output
      if (!malformed && !transient) break; // surface other API errors immediately
      const quota = /"code":s*429|RESOURCE_EXHAUSTED/.test(e instanceof Error ? e.message : "");
      if (quota) attempt = (Math.floor(attempt / 2) + 1) * 2 - 1; // quota is per model: go straight to the next one
      else if (transient) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (lastError instanceof AiOutputError) throw lastError;
  if (lastError instanceof SyntaxError) throw new AiOutputError("Gemini returned malformed JSON.");
  const detail = lastError instanceof Error ? lastError.message : "unknown error";
  console.error("[gemini]", detail.slice(0, 400));
  if (/"code":s*429|RESOURCE_EXHAUSTED/.test(detail)) throw new Error("The AI provider's request quota has been reached. Try again later or upgrade the Gemini API plan.");
  if (/"code":s*(500|503|504)|UNAVAILABLE/.test(detail)) throw new Error("The AI provider is at capacity right now. Please try again in a minute.");
  throw new Error("The AI request failed.");
}

export const GROUNDING_RULES = `You are the analysis engine inside SalesIntel AI, a revenue intelligence platform for sales managers.
Strict rules:
- Use ONLY the data supplied in the prompt. Never invent accounts, people, figures, dates, competitors or events.
- Every quantitative claim must come from the supplied FACTS. Quote the figures exactly as given.
- If the data is not sufficient to support a point, say that more data is required instead of guessing.
- Refer to accounts and owners by the exact names supplied. Do not mention anything not present in the data.
- Write plainly, directly and in a confident executive tone. No hype, no filler, no mention of being an AI.
- You advise; the team decides. Recommendations must be specific and executable.`;
