import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountEditor } from "@/components/account-editor";
import { Badge, Button, Card, CardHeader, PageHeader, Stat, Table, td, th } from "@/components/ui";
import { loadIntel } from "@/lib/app-data";
import type { Account } from "@/lib/types";
import { fmtDate, money, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, data, metrics: m } = await loadIntel();
  const account = data.accounts.find((a) => a.id === id);
  if (!account) notFound();
  const stat = m.accounts.find((a) => a.id === id)!;
  const stageName = new Map(data.stages.map((s) => [s.id, s.name]));
  const repName = new Map(data.reps.map((r) => [r.id, r.name]));
  const opps = data.opps.filter((o) => o.account_id === id).sort((a, b) => (b.closed_at ?? b.created_on).localeCompare(a.closed_at ?? a.created_on));
  const actions = data.actions.filter((a) => a.account_id === id).sort((a, b) => a.status.localeCompare(b.status));
  const convs = data.findings.filter((f) => f.conversation.account_id === id);
  const { data: allConvs } = await ctx.supabase.from("conversations").select("id, title, occurred_at, status").eq("account_id", id).order("occurred_at", { ascending: false }).limit(10);
  const { data: activities } = await ctx.supabase.from("activities").select("id, kind, subject, occurred_at").eq("account_id", id).order("occurred_at", { ascending: false }).limit(10);
  const { data: drafts } = await ctx.supabase.from("follow_up_drafts").select("id, subject, created_at, status").eq("account_id", id).order("created_at", { ascending: false }).limit(5);

  return (
    <>
      <PageHeader
        title={account.name}
        sub={[account.industry, account.region, repName.get(account.owner_rep_id ?? "") && `Owner: ${repName.get(account.owner_rep_id ?? "")}`].filter(Boolean).join(" · ") || "Account"}
        actions={<Button href="/app/accounts" variant="ghost">← Accounts</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone={account.status === "customer" ? "good" : "neutral"}>{account.status}</Badge>
        {stat.declining && <Badge tone="bad">Declining: {stat.declining.reason}</Badge>}
        {stat.negativeSentiment && <Badge tone="bad">Negative recent call</Badge>}
        {stat.pendingFollowUp && <Badge tone="warn">Follow-up due</Badge>}
        {stat.wonCount >= 1 && stat.products.length === 1 && stat.openCount === 0 && <Badge tone="good">Expansion candidate</Badge>}
      </div>
      {stat.declining && <p className="mb-4 text-sm text-ink-soft">{stat.declining.detail}</p>}
      <Card className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <Stat label="Won revenue" value={money(stat.wonRevenue, true)} sub={`${stat.wonCount} deals`} />
        <Stat label="Open pipeline" value={money(stat.openValue, true)} sub={`${stat.openCount} deals`} />
        <Stat label="Last interaction" value={<span className="text-3xl">{stat.lastActivityAt ? timeAgo(stat.lastActivityAt) : "none"}</span>} />
        <Stat label="Open actions" value={actions.filter((a) => a.status === "open" || a.status === "in_progress").length} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Opportunities" />
          {opps.length ? (
            <Table><thead><tr><th className={th}>Deal</th><th className={`${th} text-right`}>Value</th><th className={th}>Stage</th><th className={th}>Date</th></tr></thead>
              <tbody>{opps.map((o) => <tr key={o.id}><td className={td}>{o.name}<div className="text-xs text-muted">{o.product}</div></td><td className={`${td} tabular text-right`}>{money(Number(o.amount))}</td><td className={td}><Badge tone={o.status === "won" ? "good" : o.status === "lost" ? "bad" : "neutral"}>{o.stage_id ? stageName.get(o.stage_id) : o.status}</Badge></td><td className={td}>{fmtDate(o.closed_at ?? o.expected_close_date ?? o.created_on)}</td></tr>)}</tbody></Table>
          ) : <p className="p-5 text-sm text-muted">No opportunities for this account.</p>}
        </Card>
        <Card>
          <CardHeader title="Related actions" aside={<Link className="text-sm underline" href="/app/actions">Open queue</Link>} />
          {actions.length ? (
            <ul className="divide-y divide-line text-sm">{actions.slice(0, 8).map((a) => <li key={a.id} className="flex justify-between gap-3 px-5 py-3"><span className={a.status === "done" ? "text-muted line-through" : ""}>{a.title}</span><Badge tone={a.status === "done" ? "good" : "neutral"}>{a.status.replace("_", " ")}</Badge></li>)}</ul>
          ) : <p className="p-5 text-sm text-muted">No actions yet.</p>}
        </Card>
        <Card>
          <CardHeader title="Conversations" aside={<Link className="text-sm underline" href="/app/conversations">Add</Link>} />
          {allConvs?.length ? (
            <ul className="divide-y divide-line text-sm">{allConvs.map((c) => {
              const f = convs.find((x) => x.conversation_id === c.id);
              return <li key={c.id} className="px-5 py-3"><Link href={`/app/conversations/${c.id}`} className="font-medium hover:underline">{c.title}</Link> <span className="text-xs text-muted">{fmtDate(c.occurred_at)}</span>{f?.summary && <p className="mt-1 text-xs text-ink-soft">{f.summary}</p>}</li>;
            })}</ul>
          ) : <p className="p-5 text-sm text-muted">No conversations linked.</p>}
        </Card>
        <Card>
          <CardHeader title="Activity and follow-ups" />
          <ul className="divide-y divide-line text-sm">
            {(activities ?? []).map((a) => <li key={a.id} className="px-5 py-2.5"><Badge>{a.kind}</Badge> <span className="ml-2">{a.subject ?? "—"}</span><span className="ml-2 text-xs text-muted">{fmtDate(a.occurred_at)}</span></li>)}
            {(drafts ?? []).map((d) => <li key={d.id} className="px-5 py-2.5">Draft: {d.subject} <span className="text-xs text-muted">{timeAgo(d.created_at)}</span></li>)}
            {!activities?.length && !drafts?.length && <li className="px-5 py-4 text-muted">Nothing logged yet.</li>}
          </ul>
        </Card>
      </div>

      <Card className="mt-6"><CardHeader title="Account details" /><AccountEditor account={account as Account} reps={data.reps.map((r) => ({ id: r.id, name: r.name }))} canDelete={ctx.canManage} /></Card>
    </>
  );
}
