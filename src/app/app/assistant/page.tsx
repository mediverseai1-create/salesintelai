import type { Metadata } from "next";
import { Assistant } from "@/components/assistant";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { aiReady } from "@/lib/app-data";
import { requireContext } from "@/lib/auth/context";
import { creditCosts } from "@/config/pricing";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "AI Assistant" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireContext();
  const [{ count }, { data: recent }] = await Promise.all([
    ctx.supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id),
    ctx.supabase.from("ai_queries").select("id, question, answer, created_at").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(8),
  ]);
  return (
    <>
      <PageHeader title="Ask in plain language" sub="Questions are answered from your own pipeline, accounts, reps and conversations, with the supporting figures shown." />
      <Assistant aiReady={aiReady()} hasData={(count ?? 0) > 0} cost={creditCosts.question} />
      {!!recent?.length && (
        <Card className="mt-10"><CardHeader title="Recent questions" sub="Visible to your whole team. Full history is in Reports." />
          <ul className="divide-y divide-line">{recent.map((r) => <li key={r.id} className="px-5 py-3 text-sm"><div className="font-medium">{r.question}</div><p className="mt-0.5 line-clamp-2 text-ink-soft">{r.answer}</p><div className="mt-1 text-xs text-muted">{timeAgo(r.created_at)}</div></li>)}</ul></Card>
      )}
    </>
  );
}
