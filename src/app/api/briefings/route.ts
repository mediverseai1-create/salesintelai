import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAi, withCredits } from "@/lib/ai/run";
import { briefingSearchText, generateBriefing } from "@/lib/ai/briefing";
import { addDays, isoDay } from "@/lib/utils";

export const maxDuration = 120;

const Body = z.object({
  cadence: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "biannual", "annual"]),
});

export async function POST(req: Request) {
  const g = await guardAi();
  if (!g.ok) return g.response;
  const { ctx } = g;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cadence." }, { status: 400 });

  const { count } = await ctx.supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id);
  if (!count) return NextResponse.json({ error: "Import pipeline data before generating a briefing.", code: "no_data" }, { status: 400 });

  const res = await withCredits(ctx, "briefing", { cadence: parsed.data.cadence }, async () => {
    const { out, model, metrics, cadence, data } = await generateBriefing(ctx, parsed.data.cadence);
    const w = metrics.windows;
    const repByName = new Map(data.reps.map((r) => [r.name.toLowerCase(), r.id]));
    const acctByName = new Map(data.accounts.map((a) => [a.name.toLowerCase(), a.id]));

    const { data: briefing, error } = await ctx.supabase
      .from("briefings")
      .insert({
        org_id: ctx.org.id, cadence: cadence.id,
        period_start: w.cur.start, period_end: isoDay(addDays(new Date(`${w.cur.end}T00:00:00Z`), -1)),
        compare_start: w.prev.start, compare_end: isoDay(addDays(new Date(`${w.prev.end}T00:00:00Z`), -1)),
        title: out.title, summary: out.executive_summary,
        report: out.report, strategy: out.strategy, next_checks: out.next_run_checks,
        metrics: { revenue: metrics.revenue, pipeline: metrics.pipeline, winLoss: metrics.winLoss, counts: metrics.counts },
        generated_by: ctx.user.id, credits_used: 50, model, search_text: briefingSearchText(out),
      })
      .select("id")
      .single();
    if (error || !briefing) throw new Error(error?.message ?? "Could not save the briefing.");

    const openByAccount = new Map<string, string>();
    [...metrics.openOpps].forEach((o) => { if (!openByAccount.has(o.account_id)) openByAccount.set(o.account_id, o.id); });

    if (out.actions.length) {
      const rows = out.actions.map((a) => {
        const accountId = acctByName.get(a.account_name.toLowerCase()) ?? null;
        return {
          org_id: ctx.org.id, briefing_id: briefing.id, account_id: accountId,
          opportunity_id: accountId ? openByAccount.get(accountId) ?? null : null,
          title: a.title, reason: a.reason, expected_outcome: a.expected_outcome, definition_of_done: a.definition_of_done,
          priority: a.priority, owner_rep_id: repByName.get(a.owner_name.toLowerCase()) ?? null,
          due_date: isoDay(addDays(new Date(), a.due_in_days)), source: "briefing", created_by: ctx.user.id,
        };
      });
      await ctx.supabase.from("actions").insert(rows);
    }
    return briefing.id as string;
  });

  if (!res.ok) {
    // Surface "no data" as a client error (credits are refunded by withCredits).
    return res.response;
  }
  return NextResponse.json({ id: res.value });
}
