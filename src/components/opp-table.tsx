"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Field, Notice, Table, inputCls, selectCls, td, th } from "@/components/ui";
import { fmtDate, money } from "@/lib/utils";

export interface OppRow {
  id: string; name: string; account_id: string; accountName: string; amount: number; stage_id: string | null; stageName: string | null;
  status: "open" | "won" | "lost"; probability: number | null; ownerName: string | null; owner_rep_id: string | null;
  expected_close_date: string | null; daysQuiet: number | null; stalled: boolean; overdue: boolean;
}
interface Opt { id: string; name: string }

export function OppTable({ rows, stages, reps, accounts, orgId }: { rows: OppRow[]; stages: Opt[]; reps: Opt[]; accounts: Opt[]; orgId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [owner, setOwner] = useState("");
  const [show, setShow] = useState<"open" | "all">("open");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => rows.filter((r) =>
    (show === "all" || r.status === "open") &&
    (!stage || r.stage_id === stage) && (!owner || r.owner_rep_id === owner) &&
    (!q || `${r.name} ${r.accountName}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, stage, owner, show]);

  async function changeStage(id: string, stage_id: string) {
    setError(null);
    const { error } = await createClient().from("opportunities").update({ stage_id: stage_id || null }).eq("id", id);
    if (error) setError(error.message); else router.refresh();
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const amount = Number(f.get("amount"));
    if (!f.get("account_id") || !(amount >= 0)) return setError("Choose an account and enter a valid amount.");
    setBusy(true); setError(null);
    const { error } = await createClient().from("opportunities").insert({
      org_id: orgId, account_id: f.get("account_id"), name: String(f.get("name") || "").trim() || "New opportunity", amount,
      stage_id: f.get("stage_id") || null, owner_rep_id: f.get("owner_rep_id") || null, expected_close_date: f.get("expected_close_date") || null,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setAdding(false); router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
        <div className="min-w-48 flex-1"><input aria-label="Search opportunities" className={inputCls} placeholder="Search deals or accounts" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select aria-label="Stage" className={`${selectCls} w-40`} value={stage} onChange={(e) => setStage(e.target.value)}><option value="">All stages</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select aria-label="Owner" className={`${selectCls} w-40`} value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">All owners</option>{reps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select aria-label="Status" className={`${selectCls} w-36`} value={show} onChange={(e) => setShow(e.target.value as "open" | "all")}><option value="open">Open deals</option><option value="all">Open + closed</option></select>
        <Button variant="secondary" onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "Add opportunity"}</Button>
      </div>
      {error && <div className="p-4"><Notice tone="bad">{error}</Notice></div>}
      {adding && (
        <form onSubmit={add} className="grid gap-4 border-b border-line bg-cream/60 p-4 md:grid-cols-3">
          <Field label="Name"><input name="name" className={inputCls} /></Field>
          <Field label="Account"><select name="account_id" className={selectCls} required><option value="">Select…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
          <Field label="Amount (USD)"><input name="amount" type="number" min="0" step="any" className={inputCls} required /></Field>
          <Field label="Stage"><select name="stage_id" className={selectCls}><option value="">—</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Owner"><select name="owner_rep_id" className={selectCls}><option value="">Unassigned</option>{reps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Expected close"><input name="expected_close_date" type="date" className={inputCls} /></Field>
          <div className="md:col-span-3"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save opportunity"}</Button></div>
        </form>
      )}
      <Table>
        <thead><tr><th className={th}>Opportunity</th><th className={th}>Account</th><th className={`${th} text-right`}>Amount</th><th className={th}>Stage</th><th className={th}>Owner</th><th className={th}>Expected close</th><th className={th}>Signals</th></tr></thead>
        <tbody>
          {filtered.slice(0, 300).map((r) => (
            <tr key={r.id}>
              <td className={`${td} font-medium`}>{r.name}</td>
              <td className={td}><Link href={`/app/accounts/${r.account_id}`} className="underline-offset-2 hover:underline">{r.accountName}</Link></td>
              <td className={`${td} tabular text-right`}>{money(r.amount)}</td>
              <td className={td}>
                <select aria-label={`Stage for ${r.name}`} className="h-8 rounded-sm border border-line bg-paper px-2 text-sm" value={r.stage_id ?? ""} onChange={(e) => changeStage(r.id, e.target.value)}>
                  <option value="">—</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {r.probability != null && <span className="ml-2 text-xs text-muted">{r.probability}%</span>}
              </td>
              <td className={td}>{r.ownerName ?? <span className="text-muted">—</span>}</td>
              <td className={td}>{fmtDate(r.expected_close_date)}</td>
              <td className={td}><div className="flex flex-wrap gap-1">
                {r.status !== "open" && <Badge tone={r.status === "won" ? "good" : "bad"}>{r.status}</Badge>}
                {r.stalled && <Badge tone="bad">stalled {r.daysQuiet}d</Badge>}
                {r.overdue && r.status === "open" && <Badge tone="warn">past close date</Badge>}
              </div></td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td className={`${td} py-10 text-center text-muted`} colSpan={7}>No opportunities match these filters.</td></tr>}
        </tbody>
      </Table>
      {filtered.length > 300 && <p className="p-3 text-xs text-muted">Showing the first 300 of {filtered.length}. Narrow with the filters above.</p>}
    </Card>
  );
}
