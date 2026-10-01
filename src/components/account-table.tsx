"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Field, Notice, Table, inputCls, selectCls, td, th } from "@/components/ui";
import { money, timeAgo } from "@/lib/utils";

export interface AccountRow {
  id: string; name: string; status: string; industry: string | null; region: string | null; ownerName: string | null;
  wonRevenue: number; openValue: number; openCount: number; daysQuiet: number | null; lastActivityAt: string | null;
  flags: { label: string; tone: "bad" | "warn" | "good" }[];
}

export function AccountTable({ rows, reps, orgId }: { rows: AccountRow[]; reps: { id: string; name: string }[]; orgId: string }) {
  const router = useRouter();
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [flag, setFlag] = useState("");
  const [adding, setAdding] = useState(false); const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => rows.filter((r) =>
    (!status || r.status === status) && (!flag || r.flags.some((f) => f.label === flag)) &&
    (!q || `${r.name} ${r.industry ?? ""} ${r.region ?? ""}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, status, flag]);
  const flagLabels = [...new Set(rows.flatMap((r) => r.flags.map((f) => f.label)))];

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await createClient().from("accounts").insert({
      org_id: orgId, name: String(f.get("name")).trim(), industry: f.get("industry") || null, region: f.get("region") || null,
      status: f.get("status"), owner_rep_id: f.get("owner_rep_id") || null,
    });
    if (error) return setError(error.code === "23505" ? "An account with that name already exists." : error.message);
    setAdding(false); setError(null); router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
        <div className="min-w-48 flex-1"><input aria-label="Search accounts" className={inputCls} placeholder="Search accounts, industry, region" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select aria-label="Status" className={`${selectCls} w-40`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["prospect", "customer", "dormant", "churned"].map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Signal" className={`${selectCls} w-48`} value={flag} onChange={(e) => setFlag(e.target.value)}><option value="">All signals</option>{flagLabels.map((s) => <option key={s}>{s}</option>)}</select>
        <Button variant="secondary" onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "Add account"}</Button>
      </div>
      {error && <div className="p-4"><Notice tone="bad">{error}</Notice></div>}
      {adding && (
        <form onSubmit={add} className="grid gap-4 border-b border-line bg-cream/60 p-4 md:grid-cols-3">
          <Field label="Account name"><input name="name" required minLength={2} className={inputCls} /></Field>
          <Field label="Industry"><input name="industry" className={inputCls} /></Field>
          <Field label="Region"><input name="region" className={inputCls} /></Field>
          <Field label="Status"><select name="status" className={selectCls} defaultValue="prospect">{["prospect", "customer", "dormant", "churned"].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Owner"><select name="owner_rep_id" className={selectCls}><option value="">Unassigned</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          <div className="flex items-end"><Button type="submit">Save account</Button></div>
        </form>
      )}
      <Table>
        <thead><tr><th className={th}>Account</th><th className={th}>Status</th><th className={th}>Owner</th><th className={`${th} text-right`}>Won revenue</th><th className={`${th} text-right`}>Open</th><th className={th}>Last interaction</th><th className={th}>Signals</th></tr></thead>
        <tbody>
          {filtered.slice(0, 300).map((r) => (
            <tr key={r.id}>
              <td className={td}><Link href={`/app/accounts/${r.id}`} className="font-medium hover:underline">{r.name}</Link><div className="text-xs text-muted">{[r.industry, r.region].filter(Boolean).join(" · ")}</div></td>
              <td className={td}><Badge tone={r.status === "customer" ? "good" : r.status === "churned" ? "bad" : "neutral"}>{r.status}</Badge></td>
              <td className={td}>{r.ownerName ?? <span className="text-muted">—</span>}</td>
              <td className={`${td} tabular text-right`}>{money(r.wonRevenue)}</td>
              <td className={`${td} tabular text-right`}>{r.openCount ? `${money(r.openValue)} (${r.openCount})` : "—"}</td>
              <td className={td}>{r.lastActivityAt ? timeAgo(r.lastActivityAt) : <span className="text-muted">none</span>}</td>
              <td className={td}><div className="flex flex-wrap gap-1">{r.flags.map((f) => <Badge key={f.label} tone={f.tone}>{f.label}</Badge>)}</div></td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td className={`${td} py-10 text-center text-muted`} colSpan={7}>No accounts match.</td></tr>}
        </tbody>
      </Table>
    </Card>
  );
}
