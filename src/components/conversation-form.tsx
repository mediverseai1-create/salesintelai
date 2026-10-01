"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Notice, inputCls, selectCls, textareaCls } from "@/components/ui";

export function ConversationForm({ accounts, aiReady, cost }: { accounts: { id: string; name: string }[]; aiReady: boolean; cost: { text: number; audio: number } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (file instanceof File && file.size === 0) fd.delete("file");
    const local = String(fd.get("occurred_local") || "");
    fd.delete("occurred_local");
    if (local) fd.set("occurred_at", new Date(local).toISOString());
    setBusy(true); setError(null);
    const res = await fetch("/api/conversations", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error ?? "Upload failed."); if (body.id) router.refresh(); return; }
    form.reset(); router.push(`/app/conversations/${body.id}`); router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 p-5 md:grid-cols-2">
      {!aiReady && <div className="md:col-span-2"><Notice tone="warn" title="AI is not configured">Analysis needs GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY on the server.</Notice></div>}
      {error && <div className="md:col-span-2"><Notice tone="bad">{error}</Notice></div>}
      <Field label="Title"><input name="title" required minLength={2} maxLength={160} className={inputCls} placeholder="Discovery call — Acme" /></Field>
      <Field label="Account (optional)"><select name="account_id" className={selectCls}><option value="">Not linked</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
      <Field label="When"><input name="occurred_local" type="datetime-local" className={inputCls} /></Field>
      <Field label="File" hint={`Transcript (.txt .md .vtt .srt) or audio (.mp3 .wav .m4a .aac .ogg .flac, up to 15 MB). Text costs ${cost.text} credits, audio ${cost.audio}.`}>
        <input name="file" type="file" accept=".txt,.md,.vtt,.srt,.mp3,.wav,.m4a,.aac,.ogg,.flac" className={inputCls + " pt-1.5"} />
      </Field>
      <div className="md:col-span-2"><Field label="Or paste transcript / call notes"><textarea name="text" className={textareaCls} rows={6} maxLength={200000} /></Field></div>
      <div className="md:col-span-2 flex items-center gap-3"><Button type="submit" disabled={busy || !aiReady}>{busy ? "Analyzing… this can take a minute" : "Analyze conversation"}</Button></div>
    </form>
  );
}

export function ReanalyzeButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button variant="secondary" disabled={busy || disabled} onClick={async () => {
        setBusy(true); setError(null);
        const res = await fetch(`/api/conversations/${id}/analyze`, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return setError(body.error ?? "Analysis failed.");
        router.refresh();
      }}>{busy ? "Analyzing…" : "Run analysis again"}</Button>
      {error && <div className="mt-3"><Notice tone="bad">{error}</Notice></div>}
    </div>
  );
}
