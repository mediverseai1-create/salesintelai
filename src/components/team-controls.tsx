"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Notice, inputCls, selectCls } from "@/components/ui";

export function InviteForm({ orgId, isOwner }: { orgId: string; isOwner: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const email = String(f.get("email")).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg({ tone: "bad", text: "Enter a valid email address." });
    const { error } = await createClient().from("organization_invites").insert({ org_id: orgId, email, role: f.get("role") });
    if (error) return setMsg({ tone: "bad", text: error.code === "23505" ? "That email has already been invited." : error.message });
    setMsg({ tone: "good", text: `${email} will join this workspace automatically when they sign up or sign in with that address. No email is sent — share the sign-up link with them.` });
    form.reset(); router.refresh();
  }
  return (
    <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
      <Field label="Work email"><input name="email" type="email" required className={inputCls} /></Field>
      <Field label="Role"><select name="role" className={selectCls} defaultValue="member"><option value="member">Member</option>{isOwner && <option value="admin">Admin</option>}</select></Field>
      <Button type="submit">Invite</Button>
      {msg && <div className="sm:col-span-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
    </form>
  );
}

export function MemberRow({ orgId, userId, role, isOwner, canManage, isSelf }: { orgId: string; userId: string; role: string; isOwner: boolean; canManage: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const sb = createClient();
  const canEdit = role !== "owner" && !isSelf;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isOwner && canEdit ? (
        <select aria-label="Role" className="h-8 rounded-sm border border-line bg-paper px-2 text-sm" value={role} onChange={async (e) => {
          const { error } = await sb.rpc("set_member_role", { _org: orgId, _user: userId, _role: e.target.value });
          if (error) setError(error.message); else router.refresh();
        }}><option value="admin">admin</option><option value="member">member</option></select>
      ) : <span className="text-sm capitalize">{role}</span>}
      {canManage && canEdit && (isOwner || role === "member") && (
        <Button size="sm" variant="danger" onClick={async () => {
          if (!confirm("Remove this person from the workspace?")) return;
          const { error } = await sb.rpc("remove_member", { _org: orgId, _user: userId });
          if (error) setError(error.message); else router.refresh();
        }}>Remove</Button>
      )}
      {error && <span role="alert" className="text-xs text-bad">{error}</span>}
    </div>
  );
}

export function RevokeInvite({ id }: { id: string }) {
  const router = useRouter();
  return <Button size="sm" variant="ghost" onClick={async () => { await createClient().from("organization_invites").delete().eq("id", id); router.refresh(); }}>Revoke</Button>;
}
