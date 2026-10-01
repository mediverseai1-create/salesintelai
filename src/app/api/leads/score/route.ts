import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAi, withCredits } from "@/lib/ai/run";
import { generateJson, GROUNDING_RULES } from "@/lib/ai/gemini";

export const maxDuration = 90;

const Out = z.object({
  scores: z.array(z.object({ lead_id: z.string(), score: z.number().int().min(0).max(100), reason: z.string() })),
});

/** Score unscored leads against an ideal customer profile derived from the workspace's own won deals. */
export async function POST() {
  const g = await guardAi();
  if (!g.ok) return g.response;
  const { ctx } = g;

  const { data: leads } = await ctx.supabase.from("leads").select("id, name, company, title, industry, size_band, region, source, status")
    .eq("org_id", ctx.org.id).is("score", null).limit(25);
  if (!leads?.length) return NextResponse.json({ error: "No unscored leads to evaluate.", code: "nothing_to_do" }, { status: 400 });

  const { data: won } = await ctx.supabase.from("opportunities").select("amount, closed_at, created_on, account_id, product, motion, accounts(industry, size_band, region)")
    .eq("org_id", ctx.org.id).eq("status", "won").limit(2000);
  if (!won || won.length < 3)
    return NextResponse.json({ error: "Lead scoring needs at least 3 closed-won deals to learn who already buys. Import more opportunity history first.", code: "no_icp" }, { status: 400 });

  const tally = (pick: (w: NonNullable<typeof won>[number]) => string | null | undefined) => {
    const m = new Map<string, { n: number; rev: number }>();
    won.forEach((w) => { const k = pick(w); if (!k) return; const v = m.get(k) ?? { n: 0, rev: 0 }; v.n++; v.rev += Number(w.amount); m.set(k, v); });
    return [...m.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, 8).map(([k, v]) => ({ value: k, wins: v.n, revenue: Math.round(v.rev) }));
  };
  const acc = (w: NonNullable<typeof won>[number]) => (Array.isArray(w.accounts) ? w.accounts[0] : w.accounts) as { industry?: string; size_band?: string; region?: string } | null;
  const icp = {
    closed_won_deals: won.length,
    industries: tally((w) => acc(w)?.industry), size_bands: tally((w) => acc(w)?.size_band), regions: tally((w) => acc(w)?.region),
    products: tally((w) => w.product), motions: tally((w) => w.motion),
  };

  const res = await withCredits(ctx, "lead_scoring", { leads: leads.length }, async () => {
    const { data } = await generateJson({
      system: `${GROUNDING_RULES}\nScore each lead 0-100 on fit to the ideal customer profile (ICP), which is derived from this workspace's closed-won deals. Use only the attributes provided; when a lead has little data, score conservatively and say what is missing. Reasons must cite the ICP evidence.`,
      prompt: `ICP (from won deals, JSON):\n${JSON.stringify(icp)}\n\nLEADS (JSON):\n${JSON.stringify(leads)}`,
      schema: Out,
    });
    const ids = new Set(leads.map((l) => l.id));
    let n = 0;
    for (const s of data.scores) {
      if (!ids.has(s.lead_id)) continue;
      const { error } = await ctx.supabase.from("leads").update({ score: s.score, score_reason: s.reason }).eq("id", s.lead_id).eq("org_id", ctx.org.id);
      if (!error) n++;
    }
    return { scored: n };
  });
  if (!res.ok) return res.response;
  return NextResponse.json(res.value);
}
