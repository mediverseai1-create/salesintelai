import type { Metadata } from "next";
import { AccountTable, type AccountRow } from "@/components/account-table";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { loadIntel } from "@/lib/app-data";

export const metadata: Metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { ctx, data, metrics: m } = await loadIntel();
  const repName = new Map(data.reps.map((r) => [r.id, r.name]));
  const rows: AccountRow[] = m.accounts.map((a) => {
    const flags: AccountRow["flags"] = [];
    if (a.declining) flags.push({ label: "Declining", tone: "bad" });
    if (a.negativeSentiment) flags.push({ label: "Negative call", tone: "bad" });
    if (a.pendingFollowUp) flags.push({ label: "Follow-up due", tone: "warn" });
    if (a.openCount > 0 && a.daysQuiet != null && a.daysQuiet >= 21) flags.push({ label: "Gone quiet", tone: "warn" });
    if (a.wonCount >= 1 && a.products.length === 1 && a.openCount === 0) flags.push({ label: "Expansion candidate", tone: "good" });
    return {
      id: a.id, name: a.name, status: a.status, industry: a.industry, region: a.region, ownerName: a.ownerRepId ? repName.get(a.ownerRepId) ?? null : null,
      wonRevenue: a.wonRevenue, openValue: a.openValue, openCount: a.openCount, daysQuiet: a.daysQuiet, lastActivityAt: a.lastActivityAt, flags,
    };
  }).sort((a, b) => b.wonRevenue + b.openValue - (a.wonRevenue + a.openValue));

  return (
    <>
      <PageHeader title="Accounts" sub="Every customer and prospect with revenue, open deals, last interaction and risk or opportunity signals." />
      {rows.length === 0 ? (
        <EmptyState title="No accounts yet" body="Import accounts or opportunities (accounts are created automatically from deals), or add one manually." action={<><Button href="/app/imports">Import data</Button></>} />
      ) : null}
      <AccountTable rows={rows} reps={data.reps.map((r) => ({ id: r.id, name: r.name }))} orgId={ctx.org.id} />
    </>
  );
}
