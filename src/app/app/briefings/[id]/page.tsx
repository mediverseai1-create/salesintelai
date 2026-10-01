import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, CardHeader, PageHeader, Table, td, th } from "@/components/ui";
import { requireContext } from "@/lib/auth/context";
import { fmtDate, money, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Briefing" };
export const dynamic = "force-dynamic";

type Para = { text: string; evidence: string[] };
type Point = { point: string; evidence: string[] };

const Evidence = ({ items }: { items: string[] }) => items?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{items.map((e) => <span key={e} className="tabular rounded-sm bg-ink/5 px-1.5 py-0.5 text-xs text-ink-soft">{e}</span>)}</div> : null;
const ParaBlock = ({ title, p }: { title: string; p?: Para }) => p ? <div className="border-t border-line pt-4"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1.5 text-ink-soft">{p.text}</p><Evidence items={p.evidence} /></div> : null;
const PointList = ({ title, items }: { title: string; items?: Point[] }) => items?.length ? (
  <div className="border-t border-line pt-4"><h3 className="text-sm font-semibold">{title}</h3>
    <ul className="mt-2 space-y-3">{items.map((i, n) => <li key={n} className="flex gap-3 text-sm"><span className="mt-2 h-1.5 w-1.5 shrink-0 bg-accent" /><div><p>{i.point}</p><Evidence items={i.evidence} /></div></li>)}</ul></div>
) : null;

const tone = { urgent: "bad", high: "warn", medium: "neutral", low: "neutral" } as const;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const { data: b } = await ctx.supabase.from("briefings").select("*").eq("id", id).eq("org_id", ctx.org.id).maybeSingle();
  if (!b) notFound();
  const { data: actions } = await ctx.supabase.from("actions").select("*, accounts(name), sales_reps(name)").eq("briefing_id", id).order("created_at");
  const r = b.report as Record<string, Para | Point[]>;
  const s = b.strategy as Record<string, Point[]>;
  const m = b.metrics as { revenue?: { cur: number; prev: number; changePct: number | null }; pipeline?: { openValue: number; openCount: number }; winLoss?: { winRate: number | null } };
  const checks = (b.next_checks as string[]) ?? [];

  return (
    <>
      <PageHeader title={b.title} sub={`${b.cadence} briefing · ${fmtDate(b.period_start)} – ${fmtDate(b.period_end)} · compared with ${fmtDate(b.compare_start)} – ${fmtDate(b.compare_end)}`} actions={<Button href="/app/briefings" variant="ghost">← Briefings</Button>} />
      <p className="mb-8 max-w-3xl text-lg leading-relaxed">{b.summary}</p>
      {m?.revenue && (
        <Card className="mb-8 grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4"><div className="text-xs font-semibold uppercase tracking-wider text-muted">Revenue (calculated)</div><div className="numeral mt-1 text-3xl">{money(m.revenue.cur)}</div><div className="text-xs text-muted">{money(m.revenue.prev)} before{m.revenue.changePct != null ? ` (${pct(m.revenue.changePct)})` : ""}</div></div>
          <div className="px-5 py-4"><div className="text-xs font-semibold uppercase tracking-wider text-muted">Open pipeline at generation</div><div className="numeral mt-1 text-3xl">{money(m.pipeline?.openValue)}</div><div className="text-xs text-muted">{m.pipeline?.openCount} deals</div></div>
          <div className="px-5 py-4"><div className="text-xs font-semibold uppercase tracking-wider text-muted">Win rate</div><div className="numeral mt-1 text-3xl">{pct(m.winLoss?.winRate)}</div></div>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="1 · Report" sub="What happened, with the figures behind it" />
          <div className="space-y-4 p-5">
            <ParaBlock title="Revenue movement" p={r.revenue_movement as Para} />
            <ParaBlock title="Pipeline movement" p={r.pipeline_movement as Para} />
            <ParaBlock title="Win / loss trends" p={r.win_loss_trends as Para} />
            <ParaBlock title="Conversion changes" p={r.conversion_changes as Para} />
            <ParaBlock title="Rep performance" p={r.rep_performance as Para} />
            <ParaBlock title="Account performance" p={r.account_performance as Para} />
            <ParaBlock title="Regional and team performance" p={r.regional_team_performance as Para} />
            <PointList title="Risks" items={r.risks as Point[]} />
            <PointList title="Opportunities" items={r.opportunities as Point[]} />
            <ParaBlock title="Changes since the previous briefing" p={r.changes_since_previous as Para} />
          </div>
        </Card>
        <Card>
          <CardHeader title="2 · Strategy" sub="Where to put effort next" />
          <div className="space-y-4 p-5">
            <PointList title="Increase effort" items={s.increase_effort} />
            <PointList title="Decrease effort" items={s.decrease_effort} />
            <PointList title="Segments that are working" items={s.working_segments} />
            <PointList title="Sales motions producing wins" items={s.winning_motions} />
            <PointList title="Patterns to repeat" items={s.patterns_to_repeat} />
            <PointList title="Problems that need intervention" items={s.interventions_required} />
          </div>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="3 · Action plan" sub="Tracked in the action queue" aside={<Link href="/app/actions" className="text-sm underline">Open queue</Link>} />
        {actions?.length ? (
          <Table>
            <thead><tr><th className={th}>Action</th><th className={th}>Account</th><th className={th}>Owner</th><th className={th}>Due</th><th className={th}>Priority</th><th className={th}>Status</th></tr></thead>
            <tbody>{actions.map((a) => {
              const acc = (Array.isArray(a.accounts) ? a.accounts[0] : a.accounts) as { name: string } | null;
              const rep = (Array.isArray(a.sales_reps) ? a.sales_reps[0] : a.sales_reps) as { name: string } | null;
              return (
                <tr key={a.id}><td className={td}><div className="font-medium">{a.title}</div><div className="mt-1 text-xs text-ink-soft"><strong>Why:</strong> {a.reason}</div><div className="mt-0.5 text-xs text-ink-soft"><strong>Expected:</strong> {a.expected_outcome}</div><div className="mt-0.5 text-xs text-ink-soft"><strong>Done when:</strong> {a.definition_of_done}</div></td>
                  <td className={td}>{a.account_id ? <Link className="hover:underline" href={`/app/accounts/${a.account_id}`}>{acc?.name}</Link> : "—"}</td><td className={td}>{rep?.name ?? "Unassigned"}</td><td className={td}>{fmtDate(a.due_date)}</td>
                  <td className={td}><Badge tone={tone[a.priority as keyof typeof tone]}>{a.priority}</Badge></td><td className={td}><Badge tone={a.status === "done" ? "good" : "neutral"}>{a.status.replace("_", " ")}</Badge></td></tr>
              );
            })}</tbody>
          </Table>
        ) : <p className="p-5 text-sm text-muted">No actions were attached to this briefing.</p>}
        {checks.length > 0 && <div className="border-t border-line p-5"><h3 className="text-sm font-semibold">Check on the next run</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">{checks.map((c) => <li key={c}>{c}</li>)}</ul></div>}
      </Card>
      <p className="mt-4 text-xs text-muted">Written by AI from the figures in your workspace at generation time ({b.model}). Review before acting; AI output can contain errors.</p>
    </>
  );
}
