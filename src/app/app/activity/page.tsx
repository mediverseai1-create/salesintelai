import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireContext } from "@/lib/auth/context";
import { fmtDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireContext();
  const { data: logs } = await ctx.supabase.from("activity_logs").select("id, summary, event, user_id, created_at").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(200);
  const ids = [...new Set((logs ?? []).map((l) => l.user_id).filter(Boolean))] as string[];
  const { data: profiles } = ids.length ? await ctx.supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const who = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));
  return (
    <>
      <PageHeader title="Activity" sub="An audit trail of key changes in this workspace, recorded by the database." />
      {!logs?.length ? <EmptyState title="No activity yet" body="Imports, briefings, conversations, action updates and team changes will appear here." /> : (
        <Card className="divide-y divide-line">{logs.map((l) => (
          <div key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm"><span>{l.summary}</span><span className="text-xs text-muted">{l.user_id ? who.get(l.user_id) ?? "Member" : "System"} · {fmtDateTime(l.created_at)}</span></div>))}</Card>
      )}
    </>
  );
}
