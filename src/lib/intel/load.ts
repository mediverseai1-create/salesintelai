import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceData, FindingRow } from "@/lib/intel/metrics";
import type { Account, ActionItem, Lead, Opportunity, Rep, Stage } from "@/lib/types";

const LIMIT = 20000;

/** Load a workspace's data under the caller's RLS session (never crosses organizations). */
export async function loadWorkspaceData(supabase: SupabaseClient, orgId: string): Promise<WorkspaceData> {
  const [opps, accounts, reps, stages, findings, actions, leads, activities] = await Promise.all([
    supabase.from("opportunities").select("*").eq("org_id", orgId).limit(LIMIT),
    supabase.from("accounts").select("*").eq("org_id", orgId).limit(LIMIT),
    supabase.from("sales_reps").select("*").eq("org_id", orgId).limit(1000),
    supabase.from("pipeline_stages").select("*").eq("org_id", orgId).order("position"),
    supabase
      .from("conversation_findings")
      .select("*, conversation:conversations(title, account_id, opportunity_id, occurred_at)")
      .eq("org_id", orgId)
      .limit(5000),
    supabase.from("actions").select("*").eq("org_id", orgId).limit(LIMIT),
    supabase.from("leads").select("*").eq("org_id", orgId).limit(LIMIT),
    supabase.from("activities").select("account_id, rep_id, occurred_at").eq("org_id", orgId).limit(LIMIT),
  ]);

  const firstError = [opps, accounts, reps, stages, findings, actions, leads, activities].find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  return {
    opps: (opps.data ?? []) as Opportunity[],
    accounts: (accounts.data ?? []) as Account[],
    reps: (reps.data ?? []) as Rep[],
    stages: (stages.data ?? []) as Stage[],
    findings: ((findings.data ?? []) as Array<FindingRow & { conversation: FindingRow["conversation"] | FindingRow["conversation"][] }>)
      .map((f) => ({ ...f, conversation: Array.isArray(f.conversation) ? f.conversation[0] : f.conversation }))
      .filter((f) => f.conversation) as FindingRow[],
    actions: (actions.data ?? []) as ActionItem[],
    leads: (leads.data ?? []) as Lead[],
    activities: (activities.data ?? []) as WorkspaceData["activities"],
  };
}
