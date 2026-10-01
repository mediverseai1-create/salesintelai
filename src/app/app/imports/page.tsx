import type { Metadata } from "next";
import { Badge, Card, Notice, PageHeader, Table, td, th } from "@/components/ui";
import { ImportWizard, UndoImport } from "@/components/import-wizard";
import { requireContext } from "@/lib/auth/context";
import { fmtDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Data imports" };
export const dynamic = "force-dynamic";

const tone = { uploaded: "neutral", processing: "accent", completed: "good", failed: "bad" } as const;

export default async function Page() {
  const ctx = await requireContext();
  const { data: imports } = await ctx.supabase.from("imports").select("*").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(50);
  return (
    <>
      <PageHeader title="Data imports" sub="Bring pipeline, account, lead and activity exports into your workspace. Records are stored in your database and feed every briefing." />
      {ctx.canManage ? <ImportWizard /> : <Notice tone="neutral" title="Owners and admins import data">You can see the import history below.</Notice>}
      <h2 className="display mb-4 mt-12 text-3xl">Import history</h2>
      {!imports?.length ? <p className="text-sm text-muted">No imports yet.</p> : (
        <Card><Table>
          <thead><tr><th className={th}>File</th><th className={th}>Type</th><th className={th}>Status</th><th className={`${th} text-right`}>Rows</th><th className={`${th} text-right`}>Imported</th><th className={`${th} text-right`}>Skipped</th><th className={th}>When</th><th className={th} /></tr></thead>
          <tbody>{imports.map((i) => (
            <tr key={i.id}><td className={td}>{i.filename}</td><td className={`${td} capitalize`}>{i.entity}</td><td className={td}><Badge tone={tone[i.status as keyof typeof tone]}>{i.status}</Badge></td>
              <td className={`${td} tabular text-right`}>{i.total_rows}</td><td className={`${td} tabular text-right`}>{i.imported_rows}</td><td className={`${td} tabular text-right`}>{i.error_rows || "—"}</td><td className={td}>{fmtDateTime(i.created_at)}</td>
              <td className={td}>{ctx.canManage && i.status === "completed" && <UndoImport id={i.id} />}
                {i.status === "failed" && (i.errors as { message: string }[])?.[0] && <span className="text-xs text-bad">{(i.errors as { message: string }[])[0].message}</span>}</td></tr>))}</tbody>
        </Table></Card>
      )}
    </>
  );
}
