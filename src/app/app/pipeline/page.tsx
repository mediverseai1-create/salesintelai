import type { Metadata } from "next";
import Link from "next/link";
import { FunnelBars, StageBars } from "@/components/charts";
import { OppTable, type OppRow } from "@/components/opp-table";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Stat, Table, td, th } from "@/components/ui";
import { loadIntel } from "@/lib/app-data";
import { fmtDate, money, pct, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { ctx, data, metrics: m } = await loadIntel();
  const stageName = new Map(data.stages.map((s) => [s.id, s.name]));
  const repName = new Map(data.reps.map((r) => [r.id, r.name]));
  const acctName = new Map(data.accounts.map((a) => [a.id, a.name]));

  if (data.opps.length === 0)
    return (<><PageHeader title="Pipeline" /><EmptyState title="No pipeline data yet" body="Upload your sales data to begin generating revenue intelligence." action={ctx.canManage ? <Button href="/app/imports">Import opportunities</Button> : undefined} /></>);

  const open = new Map(m.openOpps.map((o) => [o.id, o]));
  const rows: OppRow[] = data.opps.map((o) => {
    const v = open.get(o.id);
    return {
      id: o.id, name: o.name, account_id: o.account_id, accountName: acctName.get(o.account_id) ?? "—", amount: Number(o.amount), stage_id: o.stage_id,
      stageName: o.stage_id ? stageName.get(o.stage_id) ?? null : null, status: o.status, probability: o.probability,
      ownerName: o.owner_rep_id ? repName.get(o.owner_rep_id) ?? null : null, owner_rep_id: o.owner_rep_id, expected_close_date: o.expected_close_date,
      daysQuiet: v?.daysQuiet ?? null, stalled: v?.stalled ?? false, overdue: v?.overdue ?? false,
    };
  }).sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || b.amount - a.amount);

  const { data: events } = await ctx.supabase.from("opportunity_events").select("id, kind, from_value, to_value, amount, created_at, opportunity_id, opportunities(name, accounts(name))").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(12);
  const stalled = m.openOpps.filter((o) => o.stalled).slice(0, 8);

  return (
    <>
      <PageHeader title="Pipeline" sub="Open deals by stage, stage conversion, stalled opportunities and recent changes — all calculated from your imported records." />
      <Card className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <Stat label="Open value" value={money(m.pipeline.openValue, true)} sub={`${m.pipeline.openCount} deals`} />
        <Stat label="Weighted" value={money(m.pipeline.weightedValue, true)} sub="Amount × probability" />
        <Stat label="New this period" value={money(m.pipeline.created.cur, true)} sub={`${m.pipeline.created.createdCount} deals (${m.pipeline.created.createdCountPrev} before)`} />
        <Stat label="Stalled" value={m.pipeline.stalledCount} tone={m.pipeline.stalledCount ? "bad" : undefined} sub={`${money(m.pipeline.stalledValue, true)} · no activity 21d+`} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Open value by stage" /><div className="p-4">{m.pipeline.byStage.length ? <StageBars data={m.pipeline.byStage} /> : <p className="py-10 text-center text-sm text-muted">No open deals.</p>}</div></Card>
        <Card>
          <CardHeader title="Stage conversion" sub="Deals that reached each stage, by current stage. Lost deals aren't counted: their furthest stage isn't in snapshot data." />
          <div className="p-4">
            {m.funnel.length > 1 ? (<>
              <FunnelBars data={m.funnel} />
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">{m.funnel.map((f) => <span key={f.stage}>{f.stage}: {f.conversionFromPrev == null ? "—" : pct(f.conversionFromPrev)}</span>)}</div>
            </>) : <p className="py-10 text-center text-sm text-muted">Needs two or more open stages.</p>}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Stalled opportunities" sub="Open, with no activity for 21+ days" />
          {stalled.length ? (
            <Table><thead><tr><th className={th}>Deal</th><th className={`${th} text-right`}>Value</th><th className={th}>Quiet</th></tr></thead>
              <tbody>{stalled.map((o) => <tr key={o.id}><td className={td}><Link className="font-medium hover:underline" href={`/app/accounts/${o.account_id}`}>{o.accountName}</Link><div className="text-xs text-muted">{o.name}{o.ownerName ? ` · ${o.ownerName}` : ""}</div></td><td className={`${td} tabular text-right`}>{money(o.amount)}</td><td className={td}><Badge tone="bad">{o.daysQuiet}d</Badge></td></tr>)}</tbody></Table>
          ) : <p className="p-5 text-sm text-muted">No stalled deals. Note: stall detection uses last-activity dates; import them for accurate results.</p>}
        </Card>
        <Card>
          <CardHeader title="Recent changes" sub="Stage, amount and status changes recorded since you started using the workspace" />
          {events?.length ? (
            <ul className="divide-y divide-line text-sm">
              {events.map((e) => {
                const opp = (Array.isArray(e.opportunities) ? e.opportunities[0] : e.opportunities) as { name: string; accounts: { name: string } | { name: string }[] } | null;
                const acc = opp ? (Array.isArray(opp.accounts) ? opp.accounts[0]?.name : opp.accounts?.name) : null;
                const what = e.kind === "created" ? "created" : e.kind === "stage_change" ? `moved ${e.from_value ?? "—"} → ${e.to_value}` : e.kind === "amount_change" ? `value ${money(Number(e.from_value))} → ${money(Number(e.to_value))}` : `status ${e.from_value} → ${e.to_value}`;
                return <li key={e.id} className="px-5 py-2.5"><span className="font-medium">{acc ?? "—"}</span> · {opp?.name} <span className="text-ink-soft">{what}</span><span className="ml-2 text-xs text-muted">{timeAgo(e.created_at)}</span></li>;
              })}
            </ul>
          ) : <p className="p-5 text-sm text-muted">No changes recorded yet.</p>}
        </Card>
      </div>

      <h2 className="display mb-4 mt-10 text-3xl">All opportunities</h2>
      <OppTable rows={rows} stages={data.stages.map((s) => ({ id: s.id, name: s.name }))} reps={data.reps.map((r) => ({ id: r.id, name: r.name }))} accounts={data.accounts.map((a) => ({ id: a.id, name: a.name }))} orgId={ctx.org.id} />
      <p className="mt-3 text-xs text-muted">Latest close {fmtDate(m.dataFreshness.latestWonClose)} · data updated {timeAgo(m.dataFreshness.latestOpportunityUpdate)}.</p>
    </>
  );
}
