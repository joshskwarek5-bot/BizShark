"use server";

import { z } from "zod";
import { getSession } from "@/lib/session";
import { generateLandingCopy, type GenerationResult } from "@/lib/ai-generate";

const InputSchema = z.object({
  brief: z.string().min(8, "Tell me a bit more about the business").max(2000),
  type: z.enum(["restaurant", "service_business"]),
  businessName: z.string().min(1).max(120),
  city: z.string().max(80).optional(),
});

export interface GenerateCopyResponse {
  ok: boolean;
  result?: GenerationResult;
  error?: string;
}

export async function generateCopyAction(
  input: z.infer<typeof InputSchema>
): Promise<GenerateCopyResponse> {
  // Either super_admin (creating from /platform) or an operator (from /app)
  // may invoke this. Reject everyone else.
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "Not authorized" };
  if (session.role !== "super_admin" && session.role !== "operator") {
    return { ok: false, error: "Not authorized" };
  }

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const result = await generateLandingCopy(parsed.data);
    return { ok: true, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed";
    console.error("[ai-generate]", e);
    return { ok: false, error: message };
  }
}

export async function hasAnthropicKey(): Promise<boolean> {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
