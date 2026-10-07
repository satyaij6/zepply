import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/*
 * Structured answers from Claude (brand analysis, captions). Callers always have a plain fallback:
 * this returns null when there's no API key, the call fails, or Claude declines, so nothing that
 * depends on it can dead-end.
 */
const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;

export type ContentBlock = Anthropic.Beta.Messages.BetaContentBlockParam;

export async function askForJson<S extends z.ZodType>({
  schema,
  system,
  content,
  effort = "medium",
  label,
}: {
  schema: S;
  system: string;
  content: ContentBlock[];
  effort?: "low" | "medium" | "high";
  /** For logs */
  label: string;
}): Promise<z.infer<S> | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, Anthropic re-runs the request on its recommended model
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort, format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") {
      console.warn(`[ai] ${label}: declined (${response.stop_details?.category ?? "no category"})`);
      return null;
    }
    if (response.stop_reason === "max_tokens") console.warn(`[ai] ${label}: hit max_tokens`);
    return response.parsed_output ?? null;
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error(`[ai] ${label}: API error ${error.status}: ${error.message}`);
    else console.error(`[ai] ${label}: failed`, error);
    return null;
  }
}

/** An image block from bytes we already hold (Claude never has to fetch our private URLs). */
export function imageBlock(bytes: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"): ContentBlock {
  return { type: "image", source: { type: "base64", media_type: mediaType, data: bytes.toString("base64") } };
}
