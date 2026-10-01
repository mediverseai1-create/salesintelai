import type { Metadata } from "next";
import { LeadsBoard } from "@/components/leads-board";
import { Button, EmptyState, Notice, PageHeader } from "@/components/ui";
import { aiReady } from "@/lib/app-data";
import { requireContext } from "@/lib/auth/context";
import type { Lead } from "@/lib/types";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireContext();
  const [{ data: leads }, { data: reps }] = await Promise.all([
    ctx.supabase.from("leads").select("*").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(5000),
    ctx.supabase.from("sales_reps").select("id, name").eq("org_id", ctx.org.id).order("name"),
  ]);
  return (
    <>
      <PageHeader title="Lead Finder" sub="Organize the leads you already have and score them against an ideal customer profile learned from your own closed-won deals. No external lead database is connected." />
      <Notice tone="neutral" title="What this does">It does not supply new leads from outside sources. Import your lead lists, then score them: fit is judged from industries, sizes and regions that already buy from you.</Notice>
      <div className="mt-6">
        {!leads?.length ? (
          <EmptyState title="No leads yet" body="Import a lead list (name, company, email, industry…) or add a lead manually." action={ctx.canManage ? <Button href="/app/imports">Import leads</Button> : undefined} />
        ) : null}
        <LeadsBoard leads={(leads ?? []) as Lead[]} reps={reps ?? []} orgId={ctx.org.id} aiReady={aiReady()} />
      </div>
    </>
  );
}
