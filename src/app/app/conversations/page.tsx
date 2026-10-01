import type { Metadata } from "next";
import Link from "next/link";
import { ConversationForm } from "@/components/conversation-form";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader } from "@/components/ui";
import { aiReady } from "@/lib/app-data";
import { requireContext } from "@/lib/auth/context";
import { creditCosts } from "@/config/pricing";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversations" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireContext();
  const [{ data: convs }, { data: accounts }] = await Promise.all([
    ctx.supabase.from("conversations").select("id, title, occurred_at, status, source_type, account_id, accounts(name), conversation_findings(sentiment, summary, next_action, follow_up_required)").eq("org_id", ctx.org.id).order("occurred_at", { ascending: false }).limit(200),
    ctx.supabase.from("accounts").select("id, name").eq("org_id", ctx.org.id).order("name").limit(2000),
  ]);
  return (
    <>
      <PageHeader title="Conversations" sub="Upload a call transcript or recording. Summary, intent, sentiment, objections, commitments, competitors, decision criteria and next action are extracted and fed into account intelligence, the action queue and your briefings." />
      <Notice tone="neutral" title="Supported inputs">Transcripts and notes (text) and audio files up to 15 MB, transcribed and analyzed by Gemini. Video files and very long recordings are not supported yet — upload a transcript instead.</Notice>
      <Card className="mt-6"><CardHeader title="Add a conversation" /><ConversationForm accounts={accounts ?? []} aiReady={aiReady()} cost={{ text: creditCosts.conversation_text, audio: creditCosts.conversation_audio }} /></Card>
      <h2 className="display mb-4 mt-10 text-3xl">History</h2>
      {!convs?.length ? <EmptyState title="No conversations yet" body="Upload supported conversation data to begin extracting sales intelligence." /> : (
        <Card className="divide-y divide-line">
          {convs.map((c) => {
            const f = (Array.isArray(c.conversation_findings) ? c.conversation_findings[0] : c.conversation_findings) as { sentiment: string | null; summary: string | null; next_action: string | null; follow_up_required: boolean } | undefined;
            const acc = (Array.isArray(c.accounts) ? c.accounts[0] : c.accounts) as { name: string } | null;
            return (
              <div key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0 max-w-2xl">
                  <Link href={`/app/conversations/${c.id}`} className="font-semibold hover:underline">{c.title}</Link>
                  <div className="mt-0.5 text-xs text-muted">{fmtDate(c.occurred_at)} · {acc?.name ?? "No account"} · {c.source_type}</div>
                  <p className="mt-2 text-sm text-ink-soft">{f?.summary ?? (c.status === "failed" ? "Analysis did not complete." : "Awaiting analysis.")}</p>
                  {f?.next_action && <p className="mt-1 text-sm"><strong>Next:</strong> {f.next_action}</p>}
                </div>
                <div className="flex gap-1.5">
                  {f?.sentiment && <Badge tone={f.sentiment === "positive" ? "good" : f.sentiment === "negative" ? "bad" : "neutral"}>{f.sentiment}</Badge>}
                  {f?.follow_up_required && <Badge tone="warn">follow-up</Badge>}
                  {c.status === "failed" && <Badge tone="bad">failed</Badge>}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
