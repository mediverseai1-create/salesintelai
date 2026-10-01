import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAi, withCredits } from "@/lib/ai/run";
import { generateJson, GROUNDING_RULES } from "@/lib/ai/gemini";
import { creditCosts } from "@/config/pricing";
import { addDays, isoDay } from "@/lib/utils";

export const maxDuration = 90;

const Body = z.object({
  targets: z.array(z.object({ type: z.enum(["account", "lead"]), id: z.string().uuid(), reason: z.string().max(300) })).min(1).max(10),
  instruction: z.string().max(300).optional(),
});

const Out = z.object({
  drafts: z.array(z.object({ target_id: z.string(), subject: z.string(), body: z.string() })),
});

export async function POST(req: Request) {
  const g = await guardAi();
  if (!g.ok) return g.response;
  const { ctx } = g;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose 1-10 targets." }, { status: 400 });
  const { targets, instruction } = parsed.data;

  // Gather each target's own history (RLS-scoped to this workspace).
  const contexts: Record<string, unknown>[] = [];
  for (const t of targets) {
    if (t.type === "account") {
      const { data: a } = await ctx.supabase.from("accounts").select("id, name, industry, contact_name, last_interaction_at").eq("id", t.id).eq("org_id", ctx.org.id).maybeSingle();
      if (!a) continue;
      const [{ data: opps }, { data: convs }] = await Promise.all([
        ctx.supabase.from("opportunities").select("name, amount, status, product, closed_at, expected_close_date").eq("account_id", t.id).order("created_at", { ascending: false }).limit(6),
        ctx.supabase.from("conversations").select("title, occurred_at, conversation_findings(summary, objections, commitments, next_action)").eq("account_id", t.id).order("occurred_at", { ascending: false }).limit(3),
      ]);
      contexts.push({ target_id: t.id, kind: "account", name: a.name, contact: a.contact_name, industry: a.industry, last_interaction: a.last_interaction_at, why_following_up: t.reason, opportunities: opps, recent_conversations: convs });
    } else {
      const { data: l } = await ctx.supabase.from("leads").select("id, name, company, title, industry, source, status, last_contacted_at, notes").eq("id", t.id).eq("org_id", ctx.org.id).maybeSingle();
      if (!l) continue;
      contexts.push({ target_id: t.id, kind: "lead", ...l, why_following_up: t.reason });
    }
  }
  if (!contexts.length) return NextResponse.json({ error: "Targets not found in this workspace." }, { status: 404 });

  const cost = creditCosts.follow_up_draft * contexts.length;
  const res = await withCredits(ctx, "follow_up_draft", { targets: contexts.length }, async () => {
    const { data } = await generateJson({
      system: `${GROUNDING_RULES}\nWrite one short, specific follow-up message per target (max 110 words), in the first person for the sales rep. Base each ONLY on that target's own history — reference real prior conversations, promises or deals when present. No placeholders like [Name] unless the contact name is unknown. No template blasts: each message must differ. Do not invent offers, prices or dates.`,
      prompt: `${instruction ? `CAMPAIGN INSTRUCTION: ${instruction}\n\n` : ""}TARGETS (JSON):\n${JSON.stringify(contexts)}`,
      schema: Out,
      temperature: 0.5,
    });
    const valid = new Set(contexts.map((c) => c.target_id as string));
    const drafts = data.drafts.filter((d) => valid.has(d.target_id));
    const rows = drafts.map((d) => {
      const t = targets.find((x) => x.id === d.target_id)!;
      const c = contexts.find((x) => x.target_id === d.target_id)!;
      return {
        org_id: ctx.org.id, account_id: t.type === "account" ? t.id : null, lead_id: t.type === "lead" ? t.id : null,
        recipient: (c.name as string) ?? null, reason: t.reason, subject: d.subject, body: d.body, created_by: ctx.user.id,
      };
    });
    if (rows.length) await ctx.supabase.from("follow_up_drafts").insert(rows);
    // Each draft becomes trackable work.
    const actionRows = drafts.map((d) => {
      const t = targets.find((x) => x.id === d.target_id)!;
      const c = contexts.find((x) => x.target_id === d.target_id)!;
      return {
        org_id: ctx.org.id, account_id: t.type === "account" ? t.id : null, lead_id: t.type === "lead" ? t.id : null,
        title: `Send follow-up to ${c.name}`, reason: t.reason, expected_outcome: "Re-open the conversation and secure a next step.",
        definition_of_done: "Message sent and any reply logged.", priority: "medium", due_date: isoDay(addDays(new Date(), 2)),
        source: "follow_up", created_by: ctx.user.id,
      };
    });
    if (actionRows.length) await ctx.supabase.from("actions").insert(actionRows);
    return { count: rows.length };
  }, cost);
  if (!res.ok) return res.response;
  return NextResponse.json(res.value);
}
