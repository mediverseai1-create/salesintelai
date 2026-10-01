import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { loadIntel } from "@/lib/app-data";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { data, metrics: m, findings, cadence, ctx } = await loadIntel();
  if (data.opps.length === 0)
    return (<><PageHeader title="Insights" /><EmptyState title="No pipeline data yet" body="Upload your sales data to begin generating revenue intelligence." action={ctx.canManage ? <Button href="/app/imports">Import opportunities</Button> : undefined} /></>);

  return (
    <>
      <PageHeader title="Six things it finds" sub={`Calculated live from your records for the ${cadence.label.toLowerCase()} rhythm: ${fmtDate(m.windows.cur.start)} – ${fmtDate(m.windows.today)} against the ${cadence.days} days before. No AI credits are used here.`}
        actions={<Button href="/app/briefings">Turn into a briefing</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        {findings.map((f) => (
          <Card key={f.key} className="flex flex-col">
            <div className="flex items-start gap-4 border-b border-line p-5">
              <span className="numeral text-5xl text-accent">0{f.n}</span>
              <div><h2 className="text-lg font-semibold">{f.title}</h2><p className="mt-1 text-xs text-muted">{f.looksFor}</p></div>
            </div>
            <div className="flex-1 p-5">
              {f.status === "insufficient" ? (
                <div className="rounded-sm border border-dashed border-line-strong bg-cream/60 p-4 text-sm"><Badge tone="warn">More data required</Badge><p className="mt-2 text-ink-soft">{f.needs}</p></div>
              ) : (
                <>
                  <p className="font-medium">{f.headline}</p>
                  {f.evidence.length > 0 && <dl className="mt-4 grid grid-cols-2 gap-3">{f.evidence.map((e) => <div key={e.label} className="border-t border-line pt-2"><dt className="text-[11px] uppercase tracking-wider text-muted">{e.label}</dt><dd className="tabular text-sm font-semibold">{e.value}</dd></div>)}</dl>}
                  {f.items.length > 0 && (
                    <ul className="mt-5 space-y-3">{f.items.map((i, n) => (
                      <li key={n} className="flex gap-3 text-sm"><span className={`mt-2 h-1.5 w-1.5 shrink-0 ${i.tone === "bad" ? "bg-bad" : i.tone === "good" ? "bg-good" : "bg-muted"}`} />
                        <div><div className="font-medium">{i.href ? <Link href={i.href} className="hover:underline">{i.title}</Link> : i.title}</div><div className="text-ink-soft">{i.detail}</div></div></li>
                    ))}</ul>
                  )}
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
