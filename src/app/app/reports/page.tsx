import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageHeader, inputCls, selectCls } from "@/components/ui";
import { requireContext } from "@/lib/auth/context";
import { fmtDate, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const clean = (s: string) => s.replace(/[%,()\\]/g, " ").trim();

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; cadence?: string }> }) {
  const sp = await searchParams;
  const q = clean(sp.q ?? "");
  const type = sp.type ?? "all";
  const ctx = await requireContext();

  let bq = ctx.supabase.from("briefings").select("id, title, summary, cadence, period_start, period_end, created_at, status").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(100);
  if (q) bq = bq.or(`title.ilike.%${q}%,summary.ilike.%${q}%,search_text.ilike.%${q}%`);
  if (sp.cadence) bq = bq.eq("cadence", sp.cadence);
  let aq = ctx.supabase.from("ai_queries").select("id, question, answer, created_at").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(100);
  if (q) aq = aq.or(`question.ilike.%${q}%,answer.ilike.%${q}%`);

  const [{ data: briefings }, { data: queries }, { data: actions }] = await Promise.all([
    type === "questions" ? { data: [] } : bq,
    type === "briefings" ? { data: [] } : aq,
    ctx.supabase.from("actions").select("briefing_id, status").eq("org_id", ctx.org.id).not("briefing_id", "is", null).limit(5000),
  ]);
  const stat = new Map<string, { n: number; done: number }>();
  actions?.forEach((a) => { const s = stat.get(a.briefing_id) ?? { n: 0, done: 0 }; s.n++; if (a.status === "done") s.done++; stat.set(a.briefing_id, s); });
  const none = !briefings?.length && !queries?.length;

  return (
    <>
      <PageHeader title="Report history" sub="Every briefing, strategy, action plan and answer is kept and searchable. Generating a new briefing never replaces an old one." />
      <form className="mb-6 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-60 flex-1"><input name="q" defaultValue={sp.q ?? ""} className={inputCls} placeholder="Search reports, strategies, actions and questions" aria-label="Search history" /></div>
        <select name="type" defaultValue={type} className={`${selectCls} w-44`} aria-label="Type"><option value="all">All</option><option value="briefings">Briefings</option><option value="questions">Questions</option></select>
        <select name="cadence" defaultValue={sp.cadence ?? ""} className={`${selectCls} w-40`} aria-label="Briefing type"><option value="">Any rhythm</option>{["daily", "weekly", "biweekly", "monthly", "quarterly", "biannual", "annual"].map((c) => <option key={c}>{c}</option>)}</select>
        <Button type="submit" variant="secondary">Filter</Button>
        {(q || sp.cadence || type !== "all") && <Button href="/app/reports" variant="ghost">Clear</Button>}
      </form>
      {none ? <EmptyState title={q ? "Nothing matches that search" : "No history yet"} body={q ? "Try different words or clear the filters." : "Generate a briefing or ask a question and it will be kept here."} action={!q ? <Button href="/app/briefings">Go to briefings</Button> : undefined} /> : (
        <div className="space-y-8">
          {!!briefings?.length && (
            <section><h2 className="display mb-3 text-3xl">Briefings, strategies and action plans</h2>
              <Card className="divide-y divide-line">{briefings.map((b) => { const s = stat.get(b.id); return (
                <Link key={b.id} href={`/app/briefings/${b.id}`} className="grid gap-2 p-5 hover:bg-cream/50 md:grid-cols-[12rem_1fr_auto]">
                  <div className="text-xs text-muted"><div className="font-semibold text-ink">{fmtDate(b.created_at)}</div>{fmtDate(b.period_start)} – {fmtDate(b.period_end)}</div>
                  <div><div className="flex items-center gap-2"><Badge tone="accent">{b.cadence}</Badge><span className="font-semibold">{b.title}</span></div><p className="mt-1 line-clamp-2 text-sm text-ink-soft">{b.summary}</p></div>
                  <div className="text-xs text-muted md:text-right">{s ? `${s.n} actions · ${s.done} done` : "No actions"}<div><Badge tone={s && s.n > 0 && s.done === s.n ? "good" : "neutral"}>{s && s.n > 0 ? (s.done === s.n ? "complete" : "in progress") : b.status}</Badge></div></div>
                </Link>); })}</Card></section>
          )}
          {!!queries?.length && (
            <section><h2 className="display mb-3 text-3xl">Questions and answers</h2>
              <Card className="divide-y divide-line">{queries.map((x) => <div key={x.id} className="p-5"><div className="text-xs text-muted">{timeAgo(x.created_at)}</div><div className="mt-1 font-semibold">{x.question}</div><p className="mt-1 text-sm text-ink-soft">{x.answer}</p></div>)}</Card></section>
          )}
        </div>
      )}
    </>
  );
}
