import type { Metadata } from "next";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { PasswordForm, ProfileForm, StageForm, WorkspaceForm } from "@/components/settings-forms";
import { requireContext } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireContext();
  const { data: stages } = await ctx.supabase.from("pipeline_stages").select("id, name, kind, probability, position").eq("org_id", ctx.org.id).order("position");
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Card><CardHeader title="Your profile" /><ProfileForm userId={ctx.user.id} fullName={ctx.profile.full_name ?? ""} jobTitle={ctx.profile.job_title ?? ""} email={ctx.profile.email ?? ctx.user.email ?? ""} /></Card>
        <Card><CardHeader title="Password" /><PasswordForm /></Card>
        <Card><CardHeader title="Workspace" sub={`Your role: ${ctx.role}`} /><WorkspaceForm orgId={ctx.org.id} name={ctx.org.name} cadence={ctx.org.cadence} canManage={ctx.canManage} /></Card>
        <Card><CardHeader title="Pipeline stages" sub="Probabilities weight the pipeline value. Closed stages are fixed in meaning (won / lost)." /><StageForm stages={stages ?? []} canManage={ctx.canManage} /></Card>
      </div>
    </>
  );
}
