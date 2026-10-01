import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth/context";
import { loadWorkspaceData } from "@/lib/intel/load";
import { computeMetrics } from "@/lib/intel/metrics";
import { suggestActions } from "@/lib/intel/nba";
import { cadenceById } from "@/config/site";
import { addDays, isoDay } from "@/lib/utils";

/** Rule-based Next Best Actions from the workspace's own data. No AI, no credits. */
export async function POST() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const data = await loadWorkspaceData(ctx.supabase, ctx.org.id);
  if (data.opps.length === 0 && data.findings.length === 0)
    return NextResponse.json({ error: "Import pipeline data or add conversations first." }, { status: 400 });

  const metrics = computeMetrics(data, cadenceById(ctx.org.cadence).days);
  const drafts = suggestActions(metrics, data.findings);

  // Skip anything already open for the same record.
  const openKeys = new Set(
    data.actions.filter((a) => a.status === "open" || a.status === "in_progress")
      .map((a) => `${a.source}|${a.opportunity_id ?? ""}|${a.account_id ?? ""}|${a.conversation_id ?? ""}|${a.title}`),
  );
  const fresh = drafts.filter((d) => !openKeys.has(`${d.source}|${d.opportunity_id ?? ""}|${d.account_id ?? ""}|${d.conversation_id ?? ""}|${d.title}`));
  if (fresh.length) {
    const { error } = await ctx.supabase.from("actions").insert(fresh.map((d) => ({
      org_id: ctx.org.id, title: d.title, reason: d.reason, expected_outcome: d.expected_outcome, definition_of_done: d.definition_of_done,
      priority: d.priority, due_date: isoDay(addDays(new Date(), d.due_in_days)), account_id: d.account_id, opportunity_id: d.opportunity_id,
      conversation_id: d.conversation_id ?? null, owner_rep_id: d.owner_rep_id, source: d.source, created_by: ctx.user.id,
    })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ created: fresh.length, skipped: drafts.length - fresh.length });
}
