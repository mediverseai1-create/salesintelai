"use client";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Field, Notice, Table, inputCls, selectCls, td, th } from "@/components/ui";
import type { Lead } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

const statuses = ["new", "contacted", "qualified", "unqualified", "converted"] as const;

export function LeadsBoard({ leads, reps, orgId, aiReady }: { leads: Lead[]; reps: { id: string; name: string }[]; orgId: string; aiReady: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [owner, setOwner] = useState(""); const [sort, setSort] = useState<"recent" | "score">("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [scoring, setScoring] = useState(false);

  const filtered = useMemo(() => leads
    .filter((l) => (!status || l.status === status) && (!owner || l.owner_rep_id === owner) &&
      (!q || `${l.name} ${l.company ?? ""} ${l.email ?? ""} ${l.industry ?? ""}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sort === "score" ? (b.score ?? -1) - (a.score ?? -1) : b.created_at.localeCompare(a.created_at)), [leads, q, status, owner, sort]);

  const sb = createClient();
  async function patch(id: string, values: Partial<Lead>) {
    const { error } = await sb.from("leads").update(values).eq("id", id);
    if (error) setMsg({ tone: "bad", text: error.message }); else router.refresh();
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "").trim();
    const { error } = await sb.from("leads").insert({
      org_id: orgId, name: String(f.get("name")).trim(), company: f.get("company") || null, email: email || null, title: f.get("title") || null,
      industry: f.get("industry") || null, region: f.get("region") || null, source: f.get("source") || null, owner_rep_id: f.get("owner_rep_id") || null,
    });
    if (error) return setMsg({ tone: "bad", text: error.message });
    setAdding(false); setMsg(null); router.refresh();
  }

  async function convert(l: Lead) {
    const name = (l.company || l.name).trim();
    const { data: existing } = await sb.from("accounts").select("id").eq("org_id", orgId).ilike("name", name).maybeSingle();
    let accountId = existing?.id as string | undefined;
    if (!accountId) {
      const { data, error } = await sb.from("accounts").insert({ org_id: orgId, name, industry: l.industry, region: l.region, size_band: l.size_band, status: "prospect", owner_rep_id: l.owner_rep_id, contact_name: l.name, contact_email: l.email }).select("id").single();
      if (error) return setMsg({ tone: "bad", text: error.message });
      accountId = data.id;
    }
    await patch(l.id, { status: "converted", account_id: accountId } as Partial<Lead>);
    setMsg({ tone: "good", text: `${name} is now an account. Add an opportunity from Pipeline.` });
  }

  async function score() {
    setScoring(true); setMsg(null);
    const res = await fetch("/api/leads/score", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setScoring(false);
    if (!res.ok) return setMsg({ tone: "bad", text: body.error ?? "Scoring failed." });
    setMsg({ tone: "good", text: `Scored ${body.scored} leads against your ideal customer profile.` }); router.refresh();
  }

  const unscored = leads.filter((l) => l.score == null).length;

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
        <div className="min-w-48 flex-1"><input aria-label="Search leads" className={inputCls} placeholder="Search name, company, email, industry" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select aria-label="Status" className={`${selectCls} w-40`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Owner" className={`${selectCls} w-40`} value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">All owners</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select aria-label="Sort" className={`${selectCls} w-36`} value={sort} onChange={(e) => setSort(e.target.value as "recent" | "score")}><option value="recent">Newest</option><option value="score">Best fit</option></select>
        <Button variant="secondary" onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "Add lead"}</Button>
        <Button onClick={score} disabled={!aiReady || scoring || unscored === 0} title={aiReady ? undefined : "Requires Gemini configuration"}>{scoring ? "Scoring…" : `Score ${Math.min(unscored, 25)} leads`}</Button>
      </div>
      {msg && <div className="p-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {adding && (
        <form onSubmit={add} className="grid gap-4 border-b border-line bg-cream/60 p-4 md:grid-cols-3">
          <Field label="Name"><input name="name" required minLength={2} className={inputCls} /></Field>
          <Field label="Company"><input name="company" className={inputCls} /></Field>
          <Field label="Email"><input name="email" type="email" className={inputCls} /></Field>
          <Field label="Title"><input name="title" className={inputCls} /></Field>
          <Field label="Industry"><input name="industry" className={inputCls} /></Field>
          <Field label="Region"><input name="region" className={inputCls} /></Field>
          <Field label="Source"><input name="source" className={inputCls} /></Field>
          <Field label="Owner"><select name="owner_rep_id" className={selectCls}><option value="">Unassigned</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          <div className="flex items-end"><Button type="submit">Save lead</Button></div>
        </form>
      )}
      <Table>
        <thead><tr><th className={th}>Lead</th><th className={th}>Fit</th><th className={th}>Status</th><th className={th}>Owner</th><th className={th}>Source</th><th className={th} /></tr></thead>
        <tbody>
          {filtered.slice(0, 300).map((l) => (
            <Fragment key={l.id}>
              <tr>
                <td className={td}><button className="text-left font-medium hover:underline" onClick={() => setOpenId(openId === l.id ? null : l.id)} aria-expanded={openId === l.id}>{l.name}</button><div className="text-xs text-muted">{[l.title, l.company].filter(Boolean).join(" · ")}</div></td>
                <td className={td}>{l.score != null ? <Badge tone={l.score >= 70 ? "good" : l.score >= 40 ? "warn" : "neutral"}>{l.score}</Badge> : <span className="text-xs text-muted">unscored</span>}</td>
                <td className={td}><select aria-label={`Status for ${l.name}`} className="h-8 rounded-sm border border-line bg-paper px-2 text-sm" value={l.status} onChange={(e) => patch(l.id, { status: e.target.value as Lead["status"], ...(e.target.value === "contacted" ? { last_contacted_at: new Date().toISOString() } : {}) })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></td>
                <td className={td}><select aria-label={`Owner for ${l.name}`} className="h-8 rounded-sm border border-line bg-paper px-2 text-sm" value={l.owner_rep_id ?? ""} onChange={(e) => patch(l.id, { owner_rep_id: e.target.value || null })}><option value="">Unassigned</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                <td className={td}>{l.source ?? <span className="text-muted">—</span>}</td>
                <td className={td}>{l.status !== "converted" && <Button size="sm" variant="ghost" onClick={() => convert(l)}>Convert to account</Button>}</td>
              </tr>
              {openId === l.id && (
                <tr key={`${l.id}-d`}><td colSpan={6} className="border-b border-line bg-cream/50 px-4 py-4 text-sm">
                  <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                    {([["Email", l.email], ["Phone", l.phone], ["Industry", l.industry], ["Size", l.size_band], ["Region", l.region], ["Last contacted", l.last_contacted_at ? timeAgo(l.last_contacted_at) : null]] as const).map(([k, v]) => <div key={k}><dt className="text-xs uppercase tracking-wider text-muted">{k}</dt><dd>{v ?? "—"}</dd></div>)}
                  </dl>
                  {l.score_reason && <p className="mt-3"><strong>Why this fit score:</strong> {l.score_reason}</p>}
                  {l.notes && <p className="mt-2 text-ink-soft">{l.notes}</p>}
                </td></tr>
              )}
            </Fragment>
          ))}
          {filtered.length === 0 && <tr><td colSpan={6} className={`${td} py-10 text-center text-muted`}>No leads match.</td></tr>}
        </tbody>
      </Table>
    </Card>
  );
}
