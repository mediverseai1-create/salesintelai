import "server-only";
import { z } from "zod";
import type { AppContext } from "@/lib/auth/context";
import { generateJson, GROUNDING_RULES } from "@/lib/ai/gemini";
import { addDays, isoDay } from "@/lib/utils";

export const FindingSchema = z.object({
  transcript: z.string().describe("Verbatim transcript if audio was provided; empty string if text was provided"),
  summary: z.string(),
  intent: z.string().describe("What the buyer is trying to achieve / their buying intent"),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  objections: z.array(z.string()),
  commitments: z.array(z.object({ owner: z.string(), text: z.string(), due: z.string().nullable().describe("YYYY-MM-DD or null") })),
  competitors: z.array(z.string()),
  decision_criteria: z.array(z.string()),
  risks: z.array(z.string()),
  next_action: z.string().describe("Single recommended next action"),
  follow_up_required: z.boolean(),
  follow_up_by: z.string().nullable().describe("YYYY-MM-DD or null"),
});

const validDate = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null);

/** Analyse a stored conversation, save findings and turn them into actions + account activity. */
export async function analyzeConversation(
  ctx: AppContext,
  conv: { id: string; title: string; account_id: string | null; opportunity_id: string | null; content: string | null; occurred_at: string },
  audio?: { mimeType: string; base64: string },
) {
  const today = isoDay(new Date());
  const { data: out, model } = await generateJson({
    system: `${GROUNDING_RULES}\nYou extract structured sales intelligence from a single sales conversation. Only report what was actually said. Use empty arrays when nothing applies. Today is ${today}; resolve relative dates ("next Tuesday", "in September") to YYYY-MM-DD, or null if ambiguous.`,
    prompt: audio
      ? `Transcribe the attached call recording and extract the intelligence. Title: ${conv.title}`
      : `Conversation title: ${conv.title}\n\nTRANSCRIPT / NOTES:\n${(conv.content ?? "").slice(0, 120000)}`,
    audio,
    schema: FindingSchema,
  });

  const followBy = validDate(out.follow_up_by);
  const { error } = await ctx.supabase.from("conversation_findings").upsert(
    {
      org_id: ctx.org.id, conversation_id: conv.id, summary: out.summary, intent: out.intent, sentiment: out.sentiment,
      objections: out.objections,
      commitments: out.commitments.map((c) => ({ ...c, due: validDate(c.due) })),
      competitors: out.competitors, decision_criteria: out.decision_criteria, risks: out.risks,
      next_action: out.next_action, follow_up_required: out.follow_up_required, follow_up_by: followBy, model,
    },
    { onConflict: "conversation_id" },
  );
  if (error) throw new Error(error.message);

  await ctx.supabase.from("conversations").update({
    status: "analyzed", error: null, ...(audio && out.transcript ? { content: out.transcript } : {}),
  }).eq("id", conv.id);

  if (conv.account_id) {
    await ctx.supabase.from("accounts").update({ last_interaction_at: conv.occurred_at }).eq("id", conv.account_id);
    if (conv.opportunity_id) await ctx.supabase.from("opportunities").update({ last_activity_at: conv.occurred_at }).eq("id", conv.opportunity_id);
  }

  // Conversation -> finding -> action
  const rows: Record<string, unknown>[] = [];
  const base = { org_id: ctx.org.id, account_id: conv.account_id, opportunity_id: conv.opportunity_id, conversation_id: conv.id, source: "conversation", created_by: ctx.user.id };
  if (out.next_action && out.follow_up_required) {
    rows.push({ ...base, title: out.next_action, reason: `Recommended after "${conv.title}": ${out.summary}`, expected_outcome: "Keeps the deal moving on the buyer's stated intent.", definition_of_done: "Next action completed and logged against the account.", priority: out.sentiment === "negative" ? "high" : "medium", due_date: followBy ?? isoDay(addDays(new Date(), 3)) });
  }
  out.commitments.slice(0, 5).forEach((c) =>
    rows.push({ ...base, title: `Commitment: ${c.text}`, reason: `${c.owner || "Team"} committed to this on "${conv.title}".`, expected_outcome: "Promise kept, trust maintained.", definition_of_done: "Commitment delivered and confirmed with the buyer.", priority: "high", due_date: validDate(c.due) ?? isoDay(addDays(new Date(), 3)) }),
  );
  if (rows.length) await ctx.supabase.from("actions").insert(rows);
  return out;
}
