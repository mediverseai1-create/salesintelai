import type { Metadata } from "next";
import { ActionsBoard } from "@/components/actions-board";
import { Card, PageHeader, Stat } from "@/components/ui";
import { requireContext } from "@/lib/auth/context";
import type { ActionItem } from "@/lib/types";
import { isoDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Actions" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireContext();
  const [{ data: actions }, { data: reps }, { data: accounts }] = await Promise.all([
    ctx.supabase.from("actions").select("*").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(3000),
    ctx.supabase.from("sales_reps").select("id, name").eq("org_id", ctx.org.id).order("name"),
    ctx.supabase.from("accounts").select("id, name").eq("org_id", ctx.org.id).order("name").limit(5000),
  ]);
  const list = (actions ?? []) as ActionItem[];
  const today = isoDay(new Date());
  const active = list.filter((a) => a.status === "open" || a.status === "in_progress");
  return (
    <>
      <PageHeader title="Next Best Actions" sub="A queue of work, not advice. Every item has a reason, an owner, a deadline and a definition of done." />
      <Card className="mb-6 grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <Stat label="Open" value={active.length} />
        <Stat label="Overdue" value={active.filter((a) => a.due_date && a.due_date < today).length} tone={active.some((a) => a.due_date && a.due_date < today) ? "bad" : undefined} />
        <Stat label="Unassigned" value={active.filter((a) => !a.owner_rep_id).length} />
        <Stat label="Completed" value={list.filter((a) => a.status === "done").length} />
      </Card>
      <ActionsBoard actions={list} reps={reps ?? []} accounts={accounts ?? []} orgId={ctx.org.id} />
    </>
  );
}
