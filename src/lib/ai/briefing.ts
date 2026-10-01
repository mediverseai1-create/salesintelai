import "server-only";
import { z } from "zod";
import type { AppContext } from "@/lib/auth/context";
import { generateJson, GROUNDING_RULES } from "@/lib/ai/gemini";
import { buildFacts } from "@/lib/ai/facts";
import { loadWorkspaceData } from "@/lib/intel/load";
import { computeMetrics } from "@/lib/intel/metrics";
import { computeFindings } from "@/lib/intel/findings";
import { cadenceById } from "@/config/site";

const Para = z.object({
  text: z.string().describe("Plain-English paragraph. State 'More data is required' if the facts cannot support it."),
  evidence: z.array(z.string()).describe("Exact figures from FACTS that support the paragraph."),
});
const Point = z.object({ point: z.string(), evidence: z.array(z.string()) });

export const BriefingSchema = z.object({
  title: z.string(),
  executive_summary: z.string(),
  report: z.object({
    revenue_movement: Para, pipeline_movement: Para, win_loss_trends: Para, conversion_changes: Para,
    rep_performance: Para, account_performance: Para, regional_team_performance: Para,
    risks: z.array(Point), opportunities: z.array(Point), changes_since_previous: Para,
  }),
  strategy: z.object({
    increase_effort: z.array(Point), decrease_effort: z.array(Point), working_segments: z.array(Point),
    winning_motions: z.array(Point), patterns_to_repeat: z.array(Point), interventions_required: z.array(Point),
  }),
  actions: z.array(z.object({
    account_name: z.string().describe("Exact name from valid_account_names"),
    owner_name: z.string().describe("Exact name from valid_owner_names, or empty string"),
    title: z.string(),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    reason: z.string(), expected_outcome: z.string(), definition_of_done: z.string(),
    due_in_days: z.number().int().min(0).max(60),
  })).max(12),
  next_run_checks: z.array(z.string()).describe("What to check on the next run"),
});
export type BriefingOut = z.infer<typeof BriefingSchema>;

export class NoDataError extends Error {}

export async function generateBriefing(ctx: AppContext, cadenceId: string) {
  const cadence = cadenceById(cadenceId);
  const data = await loadWorkspaceData(ctx.supabase, ctx.org.id);
  if (data.opps.length === 0) throw new NoDataError("Import pipeline data before generating a briefing.");

  const metrics = computeMetrics(data, cadence.days);
  const findings = computeFindings(metrics);
  const { data: prevRows } = await ctx.supabase
    .from("briefings").select("title, summary, created_at").eq("org_id", ctx.org.id)
    .eq("cadence", cadence.id).order("created_at", { ascending: false }).limit(1);
  const facts = buildFacts(metrics, findings, cadence.label, prevRows?.[0] ?? null);

  const { data: out, model } = await generateJson({
    system: `${GROUNDING_RULES}\nYou write a ${cadence.label} sales briefing with three deliverables: a Report (what happened), a Strategy (where to put effort, built from the team's own wins), and an Action Plan (specific account-level actions with owner, priority, deadline and definition of done). Focus: ${cadence.blurb}`,
    prompt: `FACTS (JSON):\n${JSON.stringify(facts)}\n\nWrite the briefing. Action plan: 5-10 actions, each tied to a real account from valid_account_names and, where sensible, an owner from valid_owner_names. Prefer actions from stalled deals, declining customers, negative-sentiment accounts, pending follow-ups and the strongest open deals. If previous_briefing is null, say there is no earlier briefing to compare to.`,
    schema: BriefingSchema,
    temperature: 0.3,
  });

  return { out, model, metrics, findings, cadence, data };
}

export function briefingSearchText(o: BriefingOut): string {
  const paras = Object.values(o.report).flatMap((v) => (Array.isArray(v) ? v.map((x) => x.point) : [v.text]));
  const strat = Object.values(o.strategy).flat().map((x) => x.point);
  return [o.title, o.executive_summary, ...paras, ...strat, ...o.actions.map((a) => `${a.account_name} ${a.title}`)].join("\n");
}
