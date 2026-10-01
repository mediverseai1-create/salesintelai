import type { Metadata } from "next";
import { InviteForm, MemberRow, RevokeInvite } from "@/components/team-controls";
import { Badge, Card, CardHeader, Notice, PageHeader, Table, td, th } from "@/components/ui";
import { loadIntel } from "@/lib/app-data";
import { fmtDate, money, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { ctx, metrics: m, data } = await loadIntel();
  const { data: members } = await ctx.supabase.from("organization_members").select("user_id, role, created_at").eq("org_id", ctx.org.id).order("created_at");
  const ids = (members ?? []).map((x) => x.user_id);
  const { data: profiles } = await ctx.supabase.from("profiles").select("id, full_name, email, job_title").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const prof = new Map((profiles ?? []).map((p) => [p.id, p]));
  const { data: invites } = ctx.canManage ? await ctx.supabase.from("organization_invites").select("id, email, role, created_at").eq("org_id", ctx.org.id).eq("status", "pending") : { data: [] };
  const comparable = m.reps.filter((r) => r.comparable).length;

  return (
    <>
      <PageHeader title="Team" sub="Who has access, and how each rep is performing — built to support coaching, not to rank people." />
      <Card>
        <CardHeader title="Members" sub="Owner: billing, team and settings. Admin: data, reports and settings. Member: works the pipeline, accounts and actions." />
        <Table><thead><tr><th className={th}>Person</th><th className={th}>Joined</th><th className={th}>Role</th></tr></thead>
          <tbody>{(members ?? []).map((x) => { const p = prof.get(x.user_id); return (
            <tr key={x.user_id}><td className={td}><div className="font-medium">{p?.full_name || p?.email || "Member"}{x.user_id === ctx.user.id && <span className="ml-2 text-xs text-muted">(you)</span>}</div><div className="text-xs text-muted">{p?.email}{p?.job_title ? ` · ${p.job_title}` : ""}</div></td><td className={td}>{fmtDate(x.created_at)}</td>
              <td className={td}><MemberRow orgId={ctx.org.id} userId={x.user_id} role={x.role} isOwner={ctx.isOwner} canManage={ctx.canManage} isSelf={x.user_id === ctx.user.id} /></td></tr>); })}</tbody></Table>
      </Card>

      {ctx.canManage ? (
        <Card className="mt-6">
          <CardHeader title="Invite a teammate" sub="Unlimited team members on every plan." />
          <InviteForm orgId={ctx.org.id} isOwner={ctx.isOwner} />
          {!!invites?.length && <ul className="divide-y divide-line border-t border-line text-sm">{invites.map((i) => <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-2.5"><span>{i.email} <Badge>{i.role}</Badge> <span className="text-xs text-muted">pending since {fmtDate(i.created_at)}</span></span><RevokeInvite id={i.id} /></li>)}</ul>}
        </Card>
      ) : <div className="mt-6"><Notice tone="neutral">Owners and admins can invite teammates and manage roles.</Notice></div>}

      <h2 className="display mb-2 mt-12 text-3xl">Rep performance</h2>
      <p className="mb-4 max-w-3xl text-sm text-ink-soft">Revenue and win rate cover the current {m.windows.days}-day period for revenue and all closed deals for win rate and cycle time. Reps with fewer than 5 closed deals are marked “limited data” — treat their rates as indicative only.{comparable < 2 && " There are not yet enough reps with comparable history for side-by-side conclusions."}</p>
      {m.reps.length === 0 ? <p className="text-sm text-muted">No reps yet. They are created from imported owners or when teammates join.</p> : (
        <Card><Table>
          <thead><tr><th className={th}>Rep</th><th className={`${th} text-right`}>Revenue</th><th className={`${th} text-right`}>Open pipeline</th><th className={`${th} text-right`}>Win rate</th><th className={`${th} text-right`}>Avg cycle</th><th className={`${th} text-right`}>Activity</th><th className={`${th} text-right`}>Stalled</th><th className={`${th} text-right`}>Actions</th></tr></thead>
          <tbody>{[...m.reps].sort((a, b) => b.revenue - a.revenue).map((r) => (
            <tr key={r.id}><td className={td}><div className="font-medium">{r.name}</div><div className="text-xs text-muted">{r.region}{!r.comparable && <span className="ml-1"><Badge tone="warn">limited data</Badge></span>}</div></td>
              <td className={`${td} tabular text-right`}>{money(r.revenue)}<div className="text-xs text-muted">{r.revenuePrev ? `${money(r.revenuePrev)} before` : ""}</div></td>
              <td className={`${td} tabular text-right`}>{money(r.openValue)}<div className="text-xs text-muted">{r.openCount} deals</div></td>
              <td className={`${td} tabular text-right`}>{pct(r.winRate)}<div className="text-xs text-muted">{r.wonCount}W / {r.lostCount}L</div></td>
              <td className={`${td} tabular text-right`}>{r.avgCycleDays != null ? `${Math.round(r.avgCycleDays)}d` : "—"}</td>
              <td className={`${td} tabular text-right`}>{data.activities.length ? r.activityCount : "—"}</td>
              <td className={`${td} tabular text-right`}>{r.stalledCount ? <Badge tone="bad">{r.stalledCount}</Badge> : 0}</td>
              <td className={`${td} tabular text-right`}>{r.openActions}{r.overdueActions ? <span className="text-bad"> ({r.overdueActions} overdue)</span> : ""}</td></tr>))}</tbody>
        </Table></Card>
      )}
    </>
  );
}
