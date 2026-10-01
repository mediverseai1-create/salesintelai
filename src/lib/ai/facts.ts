import type { Metrics } from "@/lib/intel/metrics";
import type { SixFinding } from "@/lib/intel/findings";

const r = (n: number | null | undefined) => (n == null ? null : Math.round(n));
const p = (n: number | null | undefined) => (n == null ? null : Math.round(n * 1000) / 10); // percent with 1 decimal

const bd = (rows: Metrics["byRegion"], n = 12) =>
  rows.slice(0, n).map((b) => ({
    name: b.key, revenue: r(b.revenue), revenue_previous: r(b.revenuePrev), change_pct: p(b.changePct),
    won_deals_all_time: b.wonCount, lost_deals_all_time: b.lostCount, win_rate_pct: p(b.winRate),
    open_deals: b.openCount, open_value: r(b.openValue), share_of_period_revenue_pct: p(b.share), trend: b.trend,
  }));

/** Compact, grounded facts handed to the model. Everything here is computed from workspace records. */
export function buildFacts(m: Metrics, findings: SixFinding[], cadence: string, previous?: { title: string; summary: string | null; created_at: string } | null) {
  return {
    cadence,
    reporting_period: { from: m.windows.cur.start, to_exclusive: m.windows.cur.end },
    comparison_period: { from: m.windows.prev.start, to_exclusive: m.windows.prev.end },
    today: m.windows.today,
    record_counts: m.counts,
    revenue_definition: "Revenue = value of opportunities in a won stage, dated by close date.",
    revenue: { ...m.revenue, avgDeal: r(m.revenue.avgDeal), changePct: p(m.revenue.changePct) },
    pipeline: {
      open_deals: m.pipeline.openCount, open_value: r(m.pipeline.openValue), weighted_value: r(m.pipeline.weightedValue),
      new_pipeline_value: r(m.pipeline.created.cur), new_pipeline_value_previous: r(m.pipeline.created.prev),
      new_deals: m.pipeline.created.createdCount, new_deals_previous: m.pipeline.created.createdCountPrev,
      stalled_deals_21d_plus: m.pipeline.stalledCount, stalled_value: r(m.pipeline.stalledValue),
      past_close_date_deals: m.pipeline.overdueCount, past_close_date_value: r(m.pipeline.overdueValue),
      by_stage: m.pipeline.byStage.map((s) => ({ ...s, value: r(s.value) })),
    },
    win_loss: { ...m.winLoss, winRate: p(m.winLoss.winRate), winRatePrev: p(m.winLoss.winRatePrev), avgCycleDays: r(m.winLoss.avgCycleDays), avgCycleDaysPrev: r(m.winLoss.avgCycleDaysPrev) },
    funnel_by_current_stage: m.funnel.map((f) => ({ stage: f.stage, deals_reached: f.reached, conversion_from_previous_stage_pct: p(f.conversionFromPrev) })),
    by_region: bd(m.byRegion), by_product: bd(m.byProduct), by_sales_motion: bd(m.byMotion), by_industry: bd(m.byIndustry),
    reps: m.reps.slice(0, 40).map((x) => ({
      name: x.name, revenue: r(x.revenue), revenue_previous: r(x.revenuePrev), open_deals: x.openCount, open_value: r(x.openValue),
      stalled_deals: x.stalledCount, win_rate_pct: p(x.winRate), closed_deals_total: x.wonCount + x.lostCount,
      enough_closed_deals_to_compare: x.comparable, avg_cycle_days: r(x.avgCycleDays), activities_in_period: x.activityCount,
      open_actions: x.openActions, overdue_actions: x.overdueActions,
    })),
    top_accounts: [...m.accounts].sort((a, b) => b.wonRevenue + b.openValue - (a.wonRevenue + a.openValue)).slice(0, 25).map((a) => ({
      name: a.name, region: a.region, industry: a.industry, status: a.status, lifetime_won: r(a.wonRevenue), won_deals: a.wonCount,
      open_value: r(a.openValue), days_since_last_activity: a.daysQuiet, recent_negative_call: a.negativeSentiment, pending_follow_up: a.pendingFollowUp,
      declining: a.declining ? `${a.declining.reason}: ${a.declining.detail}` : null,
    })),
    largest_open_deals: m.openOpps.slice(0, 20).map((o) => ({
      account: o.accountName, deal: o.name, amount: r(o.amount), stage: o.stageName, probability: o.probability, owner: o.ownerName,
      expected_close: o.expected_close_date, days_since_activity: o.daysQuiet, stalled: o.stalled, past_close_date: o.overdue,
    })),
    concentration: {
      basis: m.concentration.basis,
      top_customer: m.concentration.topAccount ? { name: m.concentration.topAccount.name, share_pct: p(m.concentration.topAccount.share) } : null,
      top3_share_pct: p(m.concentration.top3Share),
      top_region: m.concentration.topRegion ? { name: m.concentration.topRegion.name, share_pct: p(m.concentration.topRegion.share) } : null,
    },
    conversations: m.conversations,
    actions: m.actions,
    recent_changes: m.recentChanges,
    monthly_revenue_last_12_months: m.monthlyRevenue.map((x) => ({ month: x.month, revenue: r(x.revenue) })),
    six_findings: findings.map((f) => ({ n: f.n, title: f.title, status: f.status, headline: f.headline, evidence: f.evidence, items: f.items.map((i) => `${i.title}: ${i.detail}`), needs: f.needs ?? null })),
    previous_briefing: previous ? { title: previous.title, summary: previous.summary, generated: previous.created_at.slice(0, 10) } : null,
    valid_account_names: m.accounts.map((a) => a.name).slice(0, 300),
    valid_owner_names: m.reps.map((x) => x.name),
  };
}
