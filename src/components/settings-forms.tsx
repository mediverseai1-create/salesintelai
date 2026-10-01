"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cadences } from "@/config/site";
import { Button, Field, Notice, inputCls, selectCls } from "@/components/ui";

type Msg = { tone: "good" | "bad"; text: string } | null;

export function ProfileForm({ userId, fullName, jobTitle, email }: { userId: string; fullName: string; jobTitle: string; email: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <form className="grid gap-4 p-5 md:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const { error } = await createClient().from("profiles").update({ full_name: String(f.get("full_name")).trim(), job_title: String(f.get("job_title")).trim() || null }).eq("id", userId);
      setMsg(error ? { tone: "bad", text: error.message } : { tone: "good", text: "Profile saved." }); if (!error) router.refresh();
    }}>
      {msg && <div className="md:col-span-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <Field label="Full name"><input name="full_name" defaultValue={fullName} required minLength={2} className={inputCls} /></Field>
      <Field label="Job title"><input name="job_title" defaultValue={jobTitle} className={inputCls} /></Field>
      <Field label="Email" hint="Sign-in email can't be changed here."><input value={email} disabled className={inputCls} readOnly /></Field>
      <div className="flex items-end"><Button type="submit">Save profile</Button></div>
    </form>
  );
}

export function PasswordForm() {
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <form className="grid gap-4 p-5 md:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const pw = String(new FormData(form).get("password"));
      if (pw.length < 8) return setMsg({ tone: "bad", text: "Use at least 8 characters." });
      const { error } = await createClient().auth.updateUser({ password: pw });
      setMsg(error ? { tone: "bad", text: error.message } : { tone: "good", text: "Password updated." }); if (!error) form.reset();
    }}>
      {msg && <div className="md:col-span-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <Field label="New password"><input name="password" type="password" autoComplete="new-password" className={inputCls} /></Field>
      <div className="flex items-end"><Button type="submit" variant="secondary">Change password</Button></div>
    </form>
  );
}

export function WorkspaceForm({ orgId, name, cadence, canManage }: { orgId: string; name: string; cadence: string; canManage: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <form className="grid gap-4 p-5 md:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const { error, data } = await createClient().from("organizations").update({ name: String(f.get("name")).trim(), cadence: f.get("cadence") }).eq("id", orgId).select("id");
      setMsg(error ? { tone: "bad", text: error.message } : !data?.length ? { tone: "bad", text: "You don't have permission to change workspace settings." } : { tone: "good", text: "Workspace updated." });
      if (!error) router.refresh();
    }}>
      {msg && <div className="md:col-span-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <Field label="Workspace name"><input name="name" defaultValue={name} required minLength={2} disabled={!canManage} className={inputCls} /></Field>
      <Field label="Reporting rhythm" hint="Sets the default briefing cadence and the period used on Overview and Insights."><select name="cadence" defaultValue={cadence} disabled={!canManage} className={selectCls}>{cadences.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
      {canManage && <div><Button type="submit">Save workspace</Button></div>}
    </form>
  );
}

export function StageForm({ stages, canManage }: { stages: { id: string; name: string; kind: string; probability: number | null }[]; canManage: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const sb = createClient();
  return (
    <div className="p-5">
      {msg && <div className="mb-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <ul className="divide-y divide-line">
        {stages.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <input aria-label="Stage name" defaultValue={s.name} disabled={!canManage} className={`${inputCls} max-w-56`} onBlur={async (e) => {
              const v = e.target.value.trim(); if (!v || v === s.name) return;
              const { error } = await sb.from("pipeline_stages").update({ name: v }).eq("id", s.id); setMsg(error ? { tone: "bad", text: error.message } : { tone: "good", text: "Stage renamed." }); router.refresh();
            }} />
            <span className="w-14 text-xs capitalize text-muted">{s.kind}</span>
            <label className="flex items-center gap-2 text-sm">Probability
              <input aria-label="Probability" type="number" min={0} max={100} defaultValue={s.probability ?? ""} disabled={!canManage || s.kind !== "open"} className="h-9 w-20 rounded-sm border border-line-strong bg-paper px-2" onBlur={async (e) => {
                const v = e.target.value === "" ? null : Number(e.target.value); if (v === s.probability) return;
                const { error } = await sb.from("pipeline_stages").update({ probability: v }).eq("id", s.id); setMsg(error ? { tone: "bad", text: error.message } : { tone: "good", text: "Probability saved." }); router.refresh();
              }} />%</label>
          </li>
        ))}
      </ul>
      {!canManage && <p className="mt-3 text-xs text-muted">Only owners and admins can edit pipeline stages.</p>}
    </div>
  );
}
