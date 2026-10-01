import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReanalyzeButton } from "@/components/conversation-form";
import { Badge, Button, Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { aiReady } from "@/lib/app-data";
import { requireContext } from "@/lib/auth/context";
import type { Finding } from "@/lib/types";
import { fmtDate, fmtDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversation" };
export const dynamic = "force-dynamic";

const List = ({ title, items }: { title: string; items: string[] }) => (
  <div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
    {items.length ? <ul className="mt-2 space-y-1.5 text-sm">{items.map((x) => <li key={x} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 bg-accent" />{x}</li>)}</ul> : <p className="mt-2 text-sm text-muted">None identified.</p>}
  </div>
);

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const { data: c } = await ctx.supabase.from("conversations").select("*, accounts(id, name)").eq("id", id).eq("org_id", ctx.org.id).maybeSingle();
  if (!c) notFound();
  const { data: f } = await ctx.supabase.from("conversation_findings").select("*").eq("conversation_id", id).maybeSingle();
  const { data: actions } = await ctx.supabase.from("actions").select("id, title, status, due_date, priority").eq("conversation_id", id).order("created_at");
  const acc = (Array.isArray(c.accounts) ? c.accounts[0] : c.accounts) as { id: string; name: string } | null;
  const finding = f as Finding | null;

  return (
    <>
      <PageHeader title={c.title} sub={`${fmtDateTime(c.occurred_at)} · ${c.source_type}`} actions={<Button href="/app/conversations" variant="ghost">← Conversations</Button>} />
      {c.status === "failed" && <div className="mb-6"><Notice tone="bad" title="Analysis did not complete">{c.error ?? "Try again."} Credits for failed runs are refunded.</Notice></div>}
      {acc && <p className="mb-6 text-sm">Account: <Link className="underline" href={`/app/accounts/${acc.id}`}>{acc.name}</Link></p>}
      {finding ? (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader title="Summary" aside={finding.sentiment && <Badge tone={finding.sentiment === "positive" ? "good" : finding.sentiment === "negative" ? "bad" : "neutral"}>{finding.sentiment}</Badge>} />
            <div className="space-y-6 p-5">
              <p>{finding.summary}</p>
              <div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Customer intent</h3><p className="mt-2 text-sm">{finding.intent || "—"}</p></div>
              <div className="grid gap-6 sm:grid-cols-2"><List title="Objections" items={finding.objections} /><List title="Competitors mentioned" items={finding.competitors} /><List title="Decision criteria" items={finding.decision_criteria} /><List title="Risks" items={finding.risks} /></div>
              <div><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Commitments</h3>
                {finding.commitments.length ? <ul className="mt-2 space-y-1.5 text-sm">{finding.commitments.map((x, i) => <li key={i}><strong>{x.owner || "Team"}:</strong> {x.text}{x.due ? ` — by ${fmtDate(x.due)}` : ""}</li>)}</ul> : <p className="mt-2 text-sm text-muted">None identified.</p>}</div>
            </div>
          </Card>
          <div className="space-y-6">
            <Card><CardHeader title="Next action" /><div className="p-5 text-sm"><p>{finding.next_action || "—"}</p>
              <p className="mt-3 text-muted">{finding.follow_up_required ? `Follow-up required${finding.follow_up_by ? ` by ${fmtDate(finding.follow_up_by)}` : ""}.` : "No follow-up required."}</p></div></Card>
            <Card><CardHeader title="Actions created" aside={<Link href="/app/actions" className="text-sm underline">Queue</Link>} />
              {actions?.length ? <ul className="divide-y divide-line text-sm">{actions.map((a) => <li key={a.id} className="flex justify-between gap-3 px-5 py-3"><span>{a.title}</span><Badge tone={a.status === "done" ? "good" : "neutral"}>{a.status}</Badge></li>)}</ul> : <p className="p-5 text-sm text-muted">No actions created from this conversation.</p>}</Card>
          </div>
        </div>
      ) : (
        <Card className="p-5"><p className="mb-4 text-sm text-ink-soft">No findings yet.</p><ReanalyzeButton id={id} disabled={!aiReady() || !c.content} /></Card>
      )}
      {c.content && (
        <details className="mt-6 border border-line bg-paper"><summary className="cursor-pointer px-5 py-3 text-sm font-semibold">Transcript</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-line p-5 text-sm text-ink-soft">{c.content}</pre></details>
      )}
      {finding && <div className="mt-6"><ReanalyzeButton id={id} disabled={!aiReady() || !c.content} /></div>}
    </>
  );
}
