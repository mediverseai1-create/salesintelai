"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Notice, inputCls, selectCls, textareaCls } from "@/components/ui";
import type { Account } from "@/lib/types";

export function AccountEditor({ account, reps, canDelete }: { account: Account; reps: { id: string; name: string }[]; canDelete: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await createClient().from("accounts").update({
      name: String(f.get("name")).trim(), industry: f.get("industry") || null, region: f.get("region") || null, size_band: f.get("size_band") || null,
      status: f.get("status"), owner_rep_id: f.get("owner_rep_id") || null, contact_name: f.get("contact_name") || null,
      contact_email: f.get("contact_email") || null, notes: f.get("notes") || null,
    }).eq("id", account.id);
    setMsg(error ? { tone: "bad", text: error.message } : { tone: "good", text: "Saved." });
    if (!error) router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete ${account.name} and all of its opportunities? This cannot be undone.`)) return;
    const { error } = await createClient().from("accounts").delete().eq("id", account.id);
    if (error) return setMsg({ tone: "bad", text: error.message });
    router.replace("/app/accounts"); router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-4 p-5 md:grid-cols-2">
      {msg && <div className="md:col-span-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <Field label="Name"><input name="name" defaultValue={account.name} required className={inputCls} /></Field>
      <Field label="Status"><select name="status" defaultValue={account.status} className={selectCls}>{["prospect", "customer", "dormant", "churned"].map((s) => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Industry"><input name="industry" defaultValue={account.industry ?? ""} className={inputCls} /></Field>
      <Field label="Region"><input name="region" defaultValue={account.region ?? ""} className={inputCls} /></Field>
      <Field label="Company size"><input name="size_band" defaultValue={account.size_band ?? ""} className={inputCls} /></Field>
      <Field label="Owner"><select name="owner_rep_id" defaultValue={account.owner_rep_id ?? ""} className={selectCls}><option value="">Unassigned</option>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
      <Field label="Contact name"><input name="contact_name" defaultValue={account.contact_name ?? ""} className={inputCls} /></Field>
      <Field label="Contact email"><input name="contact_email" type="email" defaultValue={account.contact_email ?? ""} className={inputCls} /></Field>
      <div className="md:col-span-2"><Field label="Notes"><textarea name="notes" defaultValue={account.notes ?? ""} className={textareaCls} /></Field></div>
      <div className="flex gap-2 md:col-span-2"><Button type="submit">Save changes</Button>{canDelete && <Button type="button" variant="danger" onClick={remove}>Delete account</Button>}</div>
    </form>
  );
}
