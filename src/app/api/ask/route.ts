import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAi, withCredits } from "@/lib/ai/run";
import { generateJson, GROUNDING_RULES } from "@/lib/ai/gemini";
import { buildFacts } from "@/lib/ai/facts";
import { loadWorkspaceData } from "@/lib/intel/load";
import { computeMetrics } from "@/lib/intel/metrics";
import { computeFindings } from "@/lib/intel/findings";
import { cadenceById } from "@/config/site";

export const maxDuration = 90;

const Body = z.object({ question: z.string().trim().min(3).max(500) });

const Answer = z.object({
  answer: z.string().describe("Direct answer in plain English, 2-6 sentences, quoting exact figures."),
  supporting: z.array(z.object({ label: z.string(), value: z.string() })).describe("Figures from FACTS or RECORDS that back the answer"),
  table: z.object({ title: z.string(), columns: z.array(z.string()), rows: z.array(z.array(z.string())) }).nullable()
    .describe("Optional table of the supporting records; null if not useful"),
  data_gaps: z.string().nullable().describe("What data is missing, if the question cannot be fully answered"),
  follow_ups: z.array(z.string()).max(3),
});

export async function POST(req: Request) {
  const g = await guardAi();
  if (!g.ok) return g.response;
  const { ctx } = g;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ask a question of 3-500 characters." }, { status: 400 });
  const { question } = parsed.data;

  const { count } = await ctx.supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id);
  if (!count) return NextResponse.json({ error: "Import pipeline data first — there is nothing to answer from yet.", code: "no_data" }, { status: 400 });

  const res = await withCredits(ctx, "question", {}, async () => {
    const data = await loadWorkspaceData(ctx.supabase, ctx.org.id);
    const cadence = cadenceById(ctx.org.cadence);
    const metrics = computeMetrics(data, cadence.days);
    const facts = buildFacts(metrics, computeFindings(metrics), cadence.label);
    const acct = new Map(data.accounts.map((a) => [a.id, a.name]));
    const rep = new Map(data.reps.map((r) => [r.id, r.name]));
    const records = data.opps.slice(0, 250).map((o) => ({
      account: acct.get(o.account_id), name: o.name, amount: Number(o.amount), status: o.status, owner: o.owner_rep_id ? rep.get(o.owner_rep_id) : null,
      region: o.region, product: o.product, motion: o.motion, created: o.created_on, closed: o.closed_at, expected_close: o.expected_close_date,
      last_activity: o.last_activity_at?.slice(0, 10),
    }));
    const { data: out, model } = await generateJson({
      system: `${GROUNDING_RULES}\nAnswer the manager's question using only FACTS and RECORDS. Show the figures that support the answer. If the data cannot answer it, say so in data_gaps.`,
      prompt: `QUESTION: ${question}\n\nFACTS (JSON):\n${JSON.stringify(facts)}\n\nRECORDS (opportunities, up to 250, JSON):\n${JSON.stringify(records)}`,
      schema: Answer,
    });
    const { data: row } = await ctx.supabase.from("ai_queries").insert({
      org_id: ctx.org.id, user_id: ctx.user.id, question, answer: out.answer,
      supporting: { supporting: out.supporting, table: out.table, data_gaps: out.data_gaps, follow_ups: out.follow_ups },
      credits_used: 5, model,
    }).select("id").single();
    return { id: row?.id ?? null, ...out };
  });
  if (!res.ok) return res.response;
  return NextResponse.json(res.value);
}
