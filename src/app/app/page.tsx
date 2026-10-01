import Link from "next/link";
import { RevenueByMonth } from "@/components/charts";
import { Badge, Button, Card, CardHeader, EmptyState, Notice, PageHeader, Stat } from "@/components/ui";
import { aiReady, getCredits, loadIntel } from "@/lib/app-data";
import { fmtDate, money, pct, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const priorityTone = { urgent: "bad", high: "warn", medium: "neutral", low: "neutral" } as const;

export default async function Overview() {
  const { ctx, data, metrics: m, cadence } = await loadIntel();
  const credits = await getCredits();
  const { data: briefings } = await ctx.supabase.from("briefings").select("id, title, summary, cadence, period_start, period_end, strategy, created_at").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(1);
  const latest = briefings?.[0];
  const acct = new Map(data.accounts.map((a) => [a.id, a.name]));
  const openActions = data.actions.filter((a) => a.status === "open" || a.status === "in_progress")
    .sort((a, b) => ["urgent", "high", "medium", "low"].indexOf(a.priority) - ["urgent", "high", "medium", "low"].indexOf(b.priority) || (a.due_date ?? "9").localeCompare(b.due_date ?? "9")).slice(0, 5);
  const { data: convs } = await ctx.supabase.from("conversations").select("id, title, occurred_at, status, account_id, conversation_findings(sentiment, summary)").eq("org_id", ctx.org.id).order("occurred_at", { ascending: false }).limit(4);

  const empty = data.opps.length === 0;
  const strategyPoints: string[] = latest ? ((latest.strategy as { increase_effort?: { point: string }[] })?.increase_effort ?? []).slice(0, 3).map((p) => p.point) : [];
  const atRisk = m.pipeline.stalledCount + m.pipeline.overdueCount;

  return (
    <>
      <PageHeader
        title="Overview"
        sub={`${ctx.org.name} · ${cadence.label} rhythm · ${fmtDate(m.windows.cur.start)} – ${fmtDate(m.windows.today)}`}
        actions={<><Button href="/app/briefings">Briefings</Button><Button href="/app/imports" variant="secondary">Import data</Button></>}
      />
      <div className="mb-6 space-y-3">
        {credits?.low && <Notice tone="warn" title="Credits are running low">{credits.remaining.toLocaleString()} of {credits.allocated.toLocaleString()} credits remain this period. <Link href="/app/usage" className="underline">View usage and plans</Link>.</Notice>}
        {!aiReady() && <Notice tone="neutral" title="AI is not configured">Briefings, questions and conversation analysis need GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY set on the server. Everything else works without them.</Notice>}
      </div>

      {empty ? (
        <>
          <EmptyState
            title="No pipeline data yet"
            body="Upload your sales data to begin generating revenue intelligence. Start with an export of your opportunities (deal, account, amount, stage, owner, dates)."
            action={ctx.canManage ? <Button href="/app/imports">Import opportunities</Button> : <span className="text-sm text-muted">Ask an owner or admin to import data.</span>}
          />
          <ol className="mt-8 grid gap-px border border-ink bg-ink md:grid-cols-4">
            {[["Import", "Upload opportunities, accounts and leads as CSV."], ["Review", "Check Pipeline and Insights, calculated from your records."], ["Brief", "Choose your rhythm and generate your first briefing."], ["Act", "Work the action queue to done."]].map(([t, b], i) => (
              <li key={t} className="bg-paper p-5"><div className="numeral text-4xl text-accent">0{i + 1}</div><div className="mt-2 font-semibold">{t}</div><p className="mt-1 text-sm text-ink-soft">{b}</p></li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <Card className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <Stat label="Revenue" value={money(m.revenue.cur, true)} tone={m.revenue.change >= 0 ? "good" : "bad"}
              sub={m.revenue.prev > 0 ? `${m.revenue.change >= 0 ? "▲" : "▼"} ${pct(Math.abs(m.revenue.changePct ?? 0))} vs previous period` : "No prior period to compare"} />
            <Stat label="Open pipeline" value={money(m.pipeline.openValue, true)} sub={`${m.pipeline.openCount} deals · ${money(m.pipeline.weightedValue, true)} weighted`} />
            <Stat label="Win rate" value={pct(m.winLoss.winRate)} sub={m.winLoss.won + m.winLoss.lost > 0 ? `${m.winLoss.won} won · ${m.winLoss.lost} lost this period` : "No closed deals this period"} />
            <Stat label="At-risk deals" value={atRisk} tone={atRisk ? "bad" : undefined} sub={`${m.pipeline.stalledCount} stalled · ${m.pipeline.overdueCount} past close date`} />
          </Card>
          <Card className="mt-px grid divide-y divide-line border-t-0 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <Stat label="Active opportunities" value={m.pipeline.openCount} />
            <Stat label="Open actions" value={m.actions.open} sub={m.actions.overdue ? `${m.actions.overdue} overdue` : "None overdue"} tone={m.actions.overdue ? "bad" : undefined} />
            <Stat label="Completed actions" value={m.actions.done} sub={`${m.actions.doneInWindow} this period`} />
            <Stat label="Data freshness" value={<span className="text-3xl">{timeAgo(m.dataFreshness.latestOpportunityUpdate)}</span>} sub={m.dataFreshness.latestWonClose ? `Latest close: ${fmtDate(m.dataFreshness.latestWonClose)}` : "No closed-won deals yet"} />
          </Card>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Latest briefing" aside={latest && <Link className="text-sm underline" href={`/app/briefings/${latest.id}`}>Open</Link>} />
              <div className="p-5">
                {latest ? (
                  <>
                    <Badge tone="accent">{latest.cadence}</Badge>
                    <h3 className="display mt-3 text-3xl">{latest.title}</h3>
                    <p className="mt-2 text-sm text-ink-soft">{latest.summary}</p>
                    <p className="mt-3 text-xs text-muted">Generated {timeAgo(latest.created_at)} · {fmtDate(latest.period_start)} – {fmtDate(latest.period_end)}</p>
                  </>
                ) : (
                  <EmptyState title="No briefing generated yet" body="Choose your reporting rhythm and generate your first briefing." action={<Button href="/app/briefings">Go to briefings</Button>} />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Current strategic priorities" sub="From the latest briefing" />
              <div className="p-5">
                {strategyPoints.length ? <ul className="space-y-3 text-sm">{strategyPoints.map((p) => <li key={p} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 bg-accent" />{p}</li>)}</ul>
                  : <p className="text-sm text-muted">Priorities appear here once a briefing has been generated.</p>}
              </div>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Revenue by month" sub="Closed-won, last 12 months" />
              <div className="p-5">{m.monthlyRevenue.some((x) => x.revenue > 0) ? <RevenueByMonth data={m.monthlyRevenue} /> : <p className="py-10 text-center text-sm text-muted">No closed-won revenue with close dates yet.</p>}</div>
            </Card>
            <Card>
              <CardHeader title="Next best actions" aside={<Link className="text-sm underline" href="/app/actions">All actions</Link>} />
              {openActions.length ? (
                <ul className="divide-y divide-line">
                  {openActions.map((a) => (
                    <li key={a.id} className="px-5 py-3 text-sm">
                      <div className="flex items-start justify-between gap-3"><span className="font-medium">{a.title}</span><Badge tone={priorityTone[a.priority]}>{a.priority}</Badge></div>
                      <div className="mt-1 text-xs text-muted">{a.account_id ? acct.get(a.account_id) : "No account"} · due {fmtDate(a.due_date)}</div>
                    </li>
                  ))}
                </ul>
              ) : <div className="p-5"><p className="text-sm text-muted">No open actions. Generate suggestions from your data on the Actions page.</p></div>}
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader title="Recent conversations" aside={<Link className="text-sm underline" href="/app/conversations">All conversations</Link>} />
            {convs?.length ? (
              <ul className="divide-y divide-line">
                {convs.map((c) => {
                  const f = (Array.isArray(c.conversation_findings) ? c.conversation_findings[0] : c.conversation_findings) as { sentiment: string | null; summary: string | null } | undefined;
                  return (
                    <li key={c.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                      <div className="min-w-0"><Link href={`/app/conversations/${c.id}`} className="font-medium underline-offset-2 hover:underline">{c.title}</Link><p className="truncate text-xs text-muted">{f?.summary ?? (c.status === "failed" ? "Analysis failed" : "Awaiting analysis")}</p></div>
                      {f?.sentiment && <Badge tone={f.sentiment === "positive" ? "good" : f.sentiment === "negative" ? "bad" : "neutral"}>{f.sentiment}</Badge>}
                    </li>
                  );
                })}
              </ul>
            ) : <div className="p-5"><p className="text-sm text-muted">No conversations yet. Upload supported conversation data to begin extracting sales intelligence.</p></div>}
          </Card>
        </>
      )}
    </>
  );
}
