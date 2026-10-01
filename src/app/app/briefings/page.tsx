import type { Metadata } from "next";
import Link from "next/link";
import { BriefingGenerator } from "@/components/briefing-generator";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { aiReady } from "@/lib/app-data";
import { requireContext } from "@/lib/auth/context";
import { creditCosts } from "@/config/pricing";
import { fmtDate, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Briefings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireContext();
  const [{ data: briefings }, { count }] = await Promise.all([
    ctx.supabase.from("briefings").select("id, title, summary, cadence, period_start, period_end, created_at, credits_used").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(50),
    ctx.supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id),
  ]);
  const { data: actionCounts } = await ctx.supabase.from("actions").select("briefing_id, status").eq("org_id", ctx.org.id).not("briefing_id", "is", null).limit(5000);
  const stats = new Map<string, { total: number; done: number }>();
  actionCounts?.forEach((a) => { const s = stats.get(a.briefing_id) ?? { total: 0, done: 0 }; s.total++; if (a.status === "done") s.done++; stats.set(a.briefing_id, s); });

  return (
    <>
      <PageHeader title="Sales Briefing" sub="Every run delivers three things: a report of what happened, a strategy built from your team's own wins, and an action plan with owners and deadlines." />
      <Card><CardHeader title="Generate a briefing" /><BriefingGenerator defaultCadence={ctx.org.cadence} aiReady={aiReady()} hasData={(count ?? 0) > 0} cost={creditCosts.briefing} /></Card>
      <h2 className="display mb-4 mt-10 text-3xl">Previous briefings</h2>
      {!briefings?.length ? <EmptyState title="No briefing generated yet" body="Choose your reporting rhythm and generate your first briefing." /> : (
        <Card className="divide-y divide-line">
          {briefings.map((b) => {
            const s = stats.get(b.id);
            return (
              <Link key={b.id} href={`/app/briefings/${b.id}`} className="block p-5 hover:bg-cream/50">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="accent">{b.cadence}</Badge><span className="text-xs text-muted">{fmtDate(b.period_start)} – {fmtDate(b.period_end)} · generated {timeAgo(b.created_at)}</span></div>
                <h3 className="mt-2 text-lg font-semibold">{b.title}</h3>
                <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-ink-soft">{b.summary}</p>
                {s && <p className="mt-2 text-xs text-muted">{s.done} of {s.total} actions complete</p>}
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
