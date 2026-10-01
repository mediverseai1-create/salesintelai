import type { Metadata } from "next";
import { Badge, Button, Card, CardHeader, Notice, PageHeader, Stat, Table, td, th } from "@/components/ui";
import { getCredits, requireContext } from "@/lib/auth/context";
import { creditCosts, operationLabels, paymentLinkFor, planById, plans } from "@/config/pricing";
import { fmtDate, fmtDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Usage & billing" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireContext();
  const credits = await getCredits();
  const plan = planById(ctx.org.plan_id);
  const { data: tx } = await ctx.supabase.from("credit_transactions").select("id, kind, operation, amount, balance_after, created_at, user_id").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(60);
  const ids = [...new Set((tx ?? []).map((t) => t.user_id).filter(Boolean))] as string[];
  const { data: profiles } = ids.length ? await ctx.supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const who = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));
  const used = credits?.used ?? 0, alloc = credits?.allocated ?? 0;

  return (
    <>
      <PageHeader title="Usage & billing" sub="Credits refresh each billing period. Every AI action draws from the allowance and appears in the history below." />
      {credits?.low && <div className="mb-6"><Notice tone="warn" title="Credits are running low">Only {credits.remaining.toLocaleString()} credits remain until {fmtDate(credits.period_end)}. Upgrade below, or wait for the refresh.</Notice></div>}
      <Card className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <Stat label="Current plan" value={plan.name} sub={plan.priceUsd ? `$${plan.priceUsd}/month` : "Free"} />
        <Stat label="Allocated" value={alloc.toLocaleString()} sub="This billing period" />
        <Stat label="Used" value={used.toLocaleString()} />
        <Stat label="Remaining" value={(credits?.remaining ?? 0).toLocaleString()} tone={credits?.low ? "bad" : undefined} sub={credits ? `Period ${fmtDate(credits.period_start)} – ${fmtDate(credits.period_end)}` : undefined} />
      </Card>
      {credits && <div className="mt-px h-2 bg-line"><div className={credits.low ? "h-2 bg-bad" : "h-2 bg-ink"} style={{ width: `${alloc ? Math.min(100, (used / alloc) * 100) : 0}%` }} /></div>}

      <h2 className="display mb-4 mt-12 text-3xl">Plans</h2>
      {!ctx.isOwner && <div className="mb-4"><Notice tone="neutral">Only the workspace owner can change the plan.</Notice></div>}
      <div className="grid gap-px border border-ink bg-ink md:grid-cols-3">
        {plans.map((p) => {
          const link = paymentLinkFor(p.id);
          const current = p.id === plan.id;
          return (
            <article key={p.id} className="flex flex-col bg-paper p-5">
              <div className="flex items-center justify-between"><h3 className="font-semibold">{p.name}</h3>{current && <Badge tone="good">Current</Badge>}</div>
              <div className="numeral mt-3 text-5xl">${p.priceUsd}<span className="text-sm text-muted"> /mo</span></div>
              <div className="mt-1 text-sm font-semibold text-accent-ink">{p.monthlyCredits.toLocaleString()} credits</div>
              <div className="mt-5 flex-1 text-xs text-muted">
                {p.id === "free" ? "Included with every workspace." : link ? "Opens the secure payment page of our payment provider." : "Payment link not configured yet."}
              </div>
              {p.id !== "free" && !current && ctx.isOwner && (link
                ? <a href={link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-10 items-center justify-center rounded-sm border border-accent bg-accent px-4 text-sm font-medium text-white hover:bg-accent-ink">Pay for {p.name}</a>
                : <Button className="mt-4" disabled>Payment link unavailable</Button>)}
            </article>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">Your plan changes only after the payment provider confirms payment — the app never marks anything as paid on its own. After paying, your plan and credits are applied once confirmation reaches us; contact support if it has not updated.</p>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader title="Usage history" />
          {!tx?.length ? <p className="p-5 text-sm text-muted">No usage yet.</p> : (
            <Table><thead><tr><th className={th}>When</th><th className={th}>What</th><th className={th}>By</th><th className={`${th} text-right`}>Credits</th><th className={`${th} text-right`}>Balance</th></tr></thead>
              <tbody>{tx.map((t) => <tr key={t.id}><td className={td}>{fmtDateTime(t.created_at)}</td><td className={td}>{operationLabels[t.operation ?? ""] ?? t.operation}{t.kind === "refund" && <Badge tone="good"> refund</Badge>}</td><td className={td}>{t.user_id ? who.get(t.user_id) ?? "Member" : "System"}</td>
                <td className={`${td} tabular text-right ${t.amount < 0 ? "" : "text-good"}`}>{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()}</td><td className={`${td} tabular text-right`}>{t.balance_after?.toLocaleString() ?? "—"}</td></tr>)}</tbody></Table>
          )}
        </Card>
        <Card><CardHeader title="Credits per action" />
          <ul className="divide-y divide-line text-sm">{(Object.keys(creditCosts) as (keyof typeof creditCosts)[]).map((k) => <li key={k} className="flex justify-between px-5 py-2.5"><span>{operationLabels[k]}</span><span className="tabular font-semibold">{creditCosts[k]}</span></li>)}</ul>
          <p className="border-t border-line p-4 text-xs text-muted">Failed AI runs are refunded automatically.</p></Card>
      </div>
    </>
  );
}
