import type { Metadata } from "next";
import { FollowUpPanel, type Candidate, type Draft } from "@/components/follow-up-panel";
import { Button, Card, PageHeader } from "@/components/ui";
import { aiReady, loadIntel } from "@/lib/app-data";
import { creditCosts } from "@/config/pricing";
import { daysBetween, fmtDate, isoDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Follow-Up AI" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = [3, 7, 14, 30].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const { ctx, data, metrics: m } = await loadIntel();
  const today = isoDay(new Date());

  const candidates: Candidate[] = [];
  m.accounts
    .filter((a) => a.status !== "churned" && (a.openCount > 0 || a.status === "customer" || a.status === "prospect") && a.daysQuiet != null && a.daysQuiet >= days)
    .sort((a, b) => b.openValue - a.openValue || (b.daysQuiet ?? 0) - (a.daysQuiet ?? 0)).slice(0, 40)
    .forEach((a) => candidates.push({ type: "account", id: a.id, name: a.name, reason: `Quiet for ${a.daysQuiet} days${a.openCount ? ` with ${a.openCount} open deal(s)` : ""}`, detail: a.declining ? a.declining.detail : a.status }));
  data.findings.filter((f) => f.follow_up_required && f.conversation.account_id && (f.follow_up_by ?? today) <= today).slice(0, 15).forEach((f) => {
    const acc = data.accounts.find((a) => a.id === f.conversation.account_id);
    if (acc && !candidates.some((c) => c.id === acc.id && c.type === "account" && c.reason.startsWith("Missed")))
      candidates.unshift({ type: "account", id: acc.id, name: acc.name, reason: `Missed follow-up from “${f.conversation.title}”${f.follow_up_by ? ` (due ${fmtDate(f.follow_up_by)})` : ""}`, detail: f.next_action ?? "" });
  });
  data.leads.filter((l) => ["new", "contacted"].includes(l.status) && (!l.last_contacted_at || daysBetween(new Date(l.last_contacted_at), new Date()) >= days)).slice(0, 30)
    .forEach((l) => candidates.push({ type: "lead", id: l.id, name: l.name + (l.company ? ` · ${l.company}` : ""), reason: l.last_contacted_at ? `Not contacted for ${daysBetween(new Date(l.last_contacted_at), new Date())} days` : "Never contacted", detail: `Lead · ${l.status}` }));

  const { data: drafts } = await ctx.supabase.from("follow_up_drafts").select("id, recipient, subject, body, reason, status, created_at").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(20);
  const commitments = data.findings.flatMap((f) => (f.commitments ?? []).map((c) => ({ ...c, conv: f.conversation.title, due: c.due ?? null }))).filter((c) => c.due && c.due < today);

  return (
    <>
      <PageHeader title="Follow-Up AI" sub="Decides who needs a follow-up and why, then drafts a message from each person's own history — not a template blast." />
      <form className="mb-6 flex items-end gap-3"><label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">Quiet for at least</span>
        <select name="days" defaultValue={days} className="h-10 rounded-sm border border-line-strong bg-paper px-3 text-sm">{[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}</select></label><Button type="submit" variant="secondary">Apply</Button></form>
      {commitments.length > 0 && (
        <Card className="mb-6 border-bad/40"><div className="px-5 py-4"><h2 className="text-sm font-semibold text-bad">Overdue commitments from calls ({commitments.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">{commitments.slice(0, 8).map((c, i) => <li key={i}><strong>{c.owner || "Team"}:</strong> {c.text} <span className="text-muted">— due {fmtDate(c.due)} · {c.conv}</span></li>)}</ul></div></Card>
      )}
      <FollowUpPanel candidates={candidates} drafts={(drafts ?? []) as Draft[]} aiReady={aiReady()} unit={creditCosts.follow_up_draft} />
    </>
  );
}
