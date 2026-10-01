"use client";
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, Field, Notice, inputCls, selectCls, textareaCls } from "@/components/ui";
import type { ActionItem } from "@/lib/types";
import { fmtDate, fmtDateTime, isoDay } from "@/lib/utils";

interface Opt { id: string; name: string }
const tone = { urgent: "bad", high: "warn", medium: "neutral", low: "neutral" } as const;
const sourceLabel: Record<string, string> = { briefing: "Briefing", conversation: "Conversation", follow_up: "Follow-up", manual: "Manual", system: "Data rule" };

export function ActionsBoard({ actions, reps, accounts, orgId }: { actions: ActionItem[]; reps: Opt[]; accounts: Opt[]; orgId: string }) {
  const router = useRouter();
  const sb = createClient();
  const today = isoDay(new Date());
  const [q, setQ] = useState(""); const [status, setStatus] = useState("active"); const [priority, setPriority] = useState(""); const [owner, setOwner] = useState(""); const [source, setSource] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, { id: string; body: string; created_at: string }[]>>({});
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const acctName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const filtered = useMemo(() => actions.filter((a) =>
    (status === "all" || (status === "active" ? a.status === "open" || a.status === "in_progress" : a.status === status)) &&
    (!priority || a.priority === priority) && (!owner || (owner === "none" ? !a.owner_rep_id : a.owner_rep_id === owner)) && (!source || a.source === source) &&
    (!q || `${a.title} ${a.reason ?? ""} ${acctName.get(a.account_id ?? "") ?? ""}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => ["urgent", "high", "medium", "low"].indexOf(a.priority) - ["urgent", "high", "medium", "low"].indexOf(b.priority) || (a.due_date ?? "9").localeCompare(b.due_date ?? "9")), [actions, q, status, priority, owner, source, acctName]);

  async function patch(id: string, values: Record<string, unknown>) {
    const { error } = await sb.from("actions").update(values).eq("id", id);
    if (error) setMsg({ tone: "bad", text: error.message }); else router.refresh();
  }

  async function toggle(id: string) {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next && !notes[id]) {
      const { data } = await sb.from("action_notes").select("id, body, created_at").eq("action_id", id).order("created_at");
      setNotes((n) => ({ ...n, [id]: data ?? [] }));
    }
  }

  async function addNote(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") || "").trim();
    if (!body) return;
    const { data, error } = await sb.from("action_notes").insert({ org_id: orgId, action_id: id, user_id: (await sb.auth.getUser()).data.user?.id, body }).select("id, body, created_at").single();
    if (error) return setMsg({ tone: "bad", text: error.message });
    setNotes((n) => ({ ...n, [id]: [...(n[id] ?? []), data] })); form.reset();
  }

  async function suggest() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/actions/suggest", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ tone: "bad", text: body.error ?? "Could not generate suggestions." });
    setMsg({ tone: "good", text: body.created ? `Added ${body.created} actions from your data (${body.skipped} already in the queue).` : "Nothing new: every recommendation is already in the queue." });
    router.refresh();
  }

  async function addManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await sb.from("actions").insert({
      org_id: orgId, title: String(f.get("title")).trim(), reason: f.get("reason") || null, priority: f.get("priority"), account_id: f.get("account_id") || null,
      owner_rep_id: f.get("owner_rep_id") || null, due_date: f.get("due_date") || null, expected_outcome: f.get("expected_outcome") || null,
      definition_of_done: f.get("definition_of_done") || null, source: "manual", created_by: (await sb.auth.getUser()).data.user?.id,
    });
    if (error) return setMsg({ tone: "bad", text: error.message });
    setAdding(false); router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
        <div className="min-w-48 flex-1"><input aria-label="Search actions" className={inputCls} placeholder="Search actions, reasons, accounts" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select aria-label="Status" className={`${selectCls} w-36`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active</option><option value="done">Done</option><option value="dismissed">Dismissed</option><option value="all">All</option></select>
        <select aria-label="Priority" className={`${selectCls} w-36`} value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">Any priority</option>{["urgent", "high", "medium", "low"].map((p) => <option key={p}>{p}</option>)}</select>
        <select aria-label="Owner" className={`${selectCls} w-40`} value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Any owner</option><option value="none">Unassigned</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select aria-label="Source" className={`${selectCls} w-40`} value={source} onChange={(e) => setSource(e.target.value)}><option value="">Any source</option>{Object.entries(sourceLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <Button variant="secondary" onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "Add action"}</Button>
        <Button onClick={suggest} disabled={busy}>{busy ? "Working…" : "Suggest from my data"}</Button>
      </div>
      {msg && <div className="p-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {adding && (
        <form onSubmit={addManual} className="grid gap-4 border-b border-line bg-cream/60 p-4 md:grid-cols-3">
          <div className="md:col-span-2"><Field label="Action"><input name="title" required minLength={3} className={inputCls} /></Field></div>
          <Field label="Priority"><select name="priority" className={selectCls} defaultValue="medium">{["urgent", "high", "medium", "low"].map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Account"><select name="account_id" className={selectCls}><option value="">None</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
          <Field label="Owner"><select name="owner_rep_id" className={selectCls}><option value="">Unassigned</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          <Field label="Due"><input name="due_date" type="date" className={inputCls} /></Field>
          <Field label="Reason"><input name="reason" className={inputCls} /></Field>
          <Field label="Expected outcome"><input name="expected_outcome" className={inputCls} /></Field>
          <Field label="Definition of done"><input name="definition_of_done" className={inputCls} /></Field>
          <div><Button type="submit">Save action</Button></div>
        </form>
      )}
      {filtered.length === 0 ? <p className="p-10 text-center text-sm text-muted">No actions match. Use “Suggest from my data” or generate a briefing to fill the queue.</p> : (
        <ul className="divide-y divide-line">
          {filtered.map((a) => {
            const done = a.status === "done";
            const overdue = !done && a.due_date && a.due_date < today;
            return (
              <Fragment key={a.id}>
                <li className="grid gap-3 p-4 md:grid-cols-[auto_1fr_auto] md:items-start">
                  <input type="checkbox" aria-label={`Mark "${a.title}" complete`} className="mt-1 h-5 w-5 accent-[var(--accent)]" checked={done} onChange={(e) => patch(a.id, { status: e.target.checked ? "done" : "open" })} />
                  <div className="min-w-0">
                    <button onClick={() => toggle(a.id)} aria-expanded={openId === a.id} className={`text-left font-medium hover:underline ${done ? "text-muted line-through" : ""}`}>{a.title}</button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      {a.account_id && <Link className="underline" href={`/app/accounts/${a.account_id}`}>{acctName.get(a.account_id) ?? "Account"}</Link>}
                      <Badge>{sourceLabel[a.source]}</Badge><Badge tone={tone[a.priority]}>{a.priority}</Badge>
                      {overdue && <Badge tone="bad">overdue</Badge>}{a.status === "in_progress" && <Badge tone="accent">in progress</Badge>}
                    </div>
                    {a.reason && <p className="mt-2 text-sm text-ink-soft">{a.reason}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select aria-label="Owner" className="h-8 w-32 rounded-sm border border-line bg-paper px-2 text-sm" value={a.owner_rep_id ?? ""} onChange={(e) => patch(a.id, { owner_rep_id: e.target.value || null })}><option value="">Unassigned</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                    <input aria-label="Due date" type="date" className="h-8 rounded-sm border border-line bg-paper px-2 text-sm" value={a.due_date ?? ""} onChange={(e) => patch(a.id, { due_date: e.target.value || null })} />
                    <select aria-label="Priority" className="h-8 rounded-sm border border-line bg-paper px-2 text-sm" value={a.priority} onChange={(e) => patch(a.id, { priority: e.target.value })}>{["urgent", "high", "medium", "low"].map((p) => <option key={p}>{p}</option>)}</select>
                  </div>
                </li>
                {openId === a.id && (
                  <li className="space-y-4 border-t border-line bg-cream/50 px-4 py-4 text-sm md:pl-14">
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <div><dt className="text-xs uppercase tracking-wider text-muted">Expected outcome</dt><dd>{a.expected_outcome ?? "—"}</dd></div>
                      <div><dt className="text-xs uppercase tracking-wider text-muted">Definition of done</dt><dd>{a.definition_of_done ?? "—"}</dd></div>
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      {a.status !== "in_progress" && !done && <Button size="sm" variant="secondary" onClick={() => patch(a.id, { status: "in_progress" })}>Start</Button>}
                      {a.status !== "dismissed" ? <Button size="sm" variant="ghost" onClick={() => patch(a.id, { status: "dismissed" })}>Dismiss</Button> : <Button size="sm" variant="ghost" onClick={() => patch(a.id, { status: "open" })}>Reopen</Button>}
                      {a.opportunity_id && <Button size="sm" variant="ghost" href="/app/pipeline">View deal in pipeline</Button>}
                      {a.conversation_id && <Button size="sm" variant="ghost" href={`/app/conversations/${a.conversation_id}`}>View conversation</Button>}
                      {a.briefing_id && <Button size="sm" variant="ghost" href={`/app/briefings/${a.briefing_id}`}>View briefing</Button>}
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Notes</h3>
                      <ul className="mt-2 space-y-2">{(notes[a.id] ?? []).map((n) => <li key={n.id} className="border-l-2 border-accent pl-3">{n.body}<div className="text-xs text-muted">{fmtDateTime(n.created_at)}</div></li>)}{notes[a.id]?.length === 0 && <li className="text-muted">No notes yet.</li>}</ul>
                      <form onSubmit={(e) => addNote(a.id, e)} className="mt-3 flex gap-2"><textarea name="body" aria-label="Add a note" rows={1} className={`${textareaCls} min-h-10 flex-1`} placeholder="Add a note" /><Button type="submit" variant="secondary">Add</Button></form>
                    </div>
                    <p className="text-xs text-muted">Created {fmtDate(a.created_at)}{a.completed_at ? ` · completed ${fmtDate(a.completed_at)}` : ""}</p>
                  </li>
                )}
              </Fragment>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
