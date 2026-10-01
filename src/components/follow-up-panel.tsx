"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, CardHeader, Notice, inputCls } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export interface Candidate { type: "account" | "lead"; id: string; name: string; reason: string; detail: string }
export interface Draft { id: string; recipient: string | null; subject: string | null; body: string; reason: string | null; status: string; created_at: string }

export function FollowUpPanel({ candidates, drafts, aiReady, unit }: { candidates: Candidate[]; drafts: Draft[]; aiReady: boolean; unit: number }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const key = (c: Candidate) => `${c.type}:${c.id}`;
  const toggle = (c: Candidate) => setPicked((p) => { const n = new Set(p); if (n.has(key(c))) n.delete(key(c)); else n.add(key(c)); return n; });
  const chosen = candidates.filter((c) => picked.has(key(c))).slice(0, 10);

  async function draft() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/follow-ups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targets: chosen.map((c) => ({ type: c.type, id: c.id, reason: c.reason })), instruction: instruction || undefined }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ tone: "bad", text: body.error ?? "Could not draft messages." });
    setMsg({ tone: "good", text: `${body.count} drafts written and added to the action queue.` }); setPicked(new Set()); router.refresh();
  }

  async function copy(d: Draft) {
    await navigator.clipboard.writeText(`${d.subject ? `Subject: ${d.subject}\n\n` : ""}${d.body}`);
    await createClient().from("follow_up_drafts").update({ status: "copied" }).eq("id", d.id);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader title="Who needs a follow-up" sub={`${candidates.length} candidates. Select up to 10 — ${unit} credits per draft.`} />
        {!aiReady && <div className="p-4"><Notice tone="warn" title="AI is not configured">Drafting needs GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY on the server. You can still see who needs a follow-up.</Notice></div>}
        {candidates.length === 0 ? <p className="p-8 text-center text-sm text-muted">No one is overdue for a follow-up with the current threshold.</p> : (
          <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
            {candidates.map((c) => (
              <li key={key(c)}><label className="flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-cream/50">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={picked.has(key(c))} onChange={() => toggle(c)} />
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{c.name}</span><Badge>{c.type}</Badge></div><div className="text-sm text-ink-soft">{c.reason}</div><div className="text-xs text-muted">{c.detail}</div></div>
              </label></li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-3 border-t border-line p-4">
          <div className="min-w-60 flex-1"><input className={inputCls} placeholder="Optional campaign instruction, e.g. “offer a 20-minute catch-up call”" value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={300} aria-label="Campaign instruction" /></div>
          <Button onClick={draft} disabled={busy || !aiReady || chosen.length === 0}>{busy ? "Writing…" : `Draft ${chosen.length || ""} message${chosen.length === 1 ? "" : "s"}`}</Button>
        </div>
        {msg && <div className="px-4 pb-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      </Card>

      <section>
        <h2 className="display mb-3 text-3xl">Drafts</h2>
        <Notice tone="neutral">Messages are not sent from here — no email integration is connected. Copy a draft into your email or CRM; the matching action in the queue tracks completion.</Notice>
        {drafts.length === 0 ? <p className="mt-4 text-sm text-muted">No drafts yet.</p> : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {drafts.map((d) => (
              <Card key={d.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3"><div><div className="font-semibold">{d.recipient ?? "Recipient"}</div><div className="text-xs text-muted">{d.reason} · {timeAgo(d.created_at)}</div></div><Badge tone={d.status === "copied" ? "good" : "neutral"}>{d.status}</Badge></div>
                <div className="flex-1 p-5 text-sm">{d.subject && <p className="mb-2 font-medium">{d.subject}</p>}<p className="whitespace-pre-wrap text-ink-soft">{d.body}</p></div>
                <div className="border-t border-line p-3"><Button size="sm" variant="secondary" onClick={() => copy(d)}>Copy to clipboard</Button></div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
