import type { Account, ActionItem, Finding, Lead, Opportunity, Rep, Stage } from "@/lib/types";

/**
 * Deterministic revenue metrics. Everything shown in Insights, Dashboard and fed to the AI as
 * "facts" is computed here from the workspace's own records — nothing is estimated or invented.
 * Revenue = value of opportunities in a won stage, dated by their close date.
 */

export interface FindingRow extends Finding {
  conversation: { title: string; account_id: string | null; opportunity_id: string | null; occurred_at: string };
}

export interface WorkspaceData {
  opps: Opportunity[];
  accounts: Account[];
  reps: Rep[];
  stages: Stage[];
  findings: FindingRow[];
  actions: ActionItem[];
  leads: Lead[];
  activities: { account_id: string | null; rep_id: string | null; occurred_at: string }[];
}

export interface Win { start: string; end: string } // [start, end) as YYYY-MM-DD

export interface Windows {
  days: number;
  cur: Win;
  prev: Win;
  prev2: Win;
  today: string;
}

export const STALL_DAYS = 21;

const day = (d: Date) => d.toISOString().slice(0, 10);
const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return day(d);
};
const diffDays = (a: string, b: string) =>
  Math.floor((new Date(`${b.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${a.slice(0, 10)}T00:00:00Z`).getTime()) / 86400000);

export function makeWindows(days: number, now = new Date()): Windows {
  const today = day(now);
  const end = shift(today, 1); // include today
  return {
    days,
    today,
    cur: { start: shift(end, -days), end },
    prev: { start: shift(end, -2 * days), end: shift(end, -days) },
    prev2: { start: shift(end, -3 * days), end: shift(end, -2 * days) },
  };
}

const inW = (d: string | null | undefined, w: Win) => !!d && d.slice(0, 10) >= w.start && d.slice(0, 10) < w.end;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const delta = (cur: number, prev: number) => ({
  cur,
  prev,
  change: cur - prev,
  changePct: prev > 0 ? (cur - prev) / prev : null,
});

export interface Breakdown {
  key: string;
  revenue: number;
  revenuePrev: number;
  revenuePrev2: number;
  change: number;
  changePct: number | null;
  wonCount: number;
  lostCount: number;
  winRate: number | null;
  openCount: number;
  openValue: number;
  share: number; // share of current-window revenue
  trend: "up" | "down" | "flat" | "dip" | "direction-down";
}

export interface AccountStat {
  id: string;
  name: string;
  region: string | null;
  industry: string | null;
  status: string;
  ownerRepId: string | null;
  wonRevenue: number;
  wonCount: number;
  lastWonAt: string | null;
  openValue: number;
  openCount: number;
  products: string[];
  lastActivityAt: string | null;
  daysQuiet: number | null;
  negativeSentiment: boolean;
  pendingFollowUp: boolean;
  declining: null | { reason: string; detail: string };
}

export interface OppView extends Opportunity {
  accountName: string;
  ownerName: string | null;
  stageName: string | null;
  daysQuiet: number | null;
  stalled: boolean;
  overdue: boolean;
}

export interface Metrics {
  generatedAt: string;
  windows: Windows;
  counts: { opportunities: number; accounts: number; reps: number; conversations: number; leads: number };
  dataFreshness: { latestOpportunityUpdate: string | null; latestWonClose: string | null };
  revenue: ReturnType<typeof delta> & { prev2: number; wonCount: number; wonCountPrev: number; avgDeal: number | null };
  pipeline: {
    openCount: number;
    openValue: number;
    weightedValue: number;
    created: ReturnType<typeof delta> & { createdCount: number; createdCountPrev: number };
    stalledCount: number;
    stalledValue: number;
    overdueCount: number;
    overdueValue: number;
    byStage: { stage: string; kind: string; count: number; value: number }[];
  };
  winLoss: {
    won: number; lost: number; wonPrev: number; lostPrev: number;
    winRate: number | null; winRatePrev: number | null;
    avgCycleDays: number | null; avgCycleDaysPrev: number | null;
    lossReasons: { reason: string; count: number }[];
  };
  funnel: { stage: string; reached: number; conversionFromPrev: number | null }[];
  byRegion: Breakdown[];
  byProduct: Breakdown[];
  byMotion: Breakdown[];
  byIndustry: Breakdown[];
  reps: RepStat[];
  accounts: AccountStat[];
  openOpps: OppView[];
  concentration: { topAccount: { name: string; share: number } | null; top3Share: number | null; topRegion: { name: string; share: number } | null; basis: string; revenueBasis: number };
  declining: AccountStat[];
  conversations: {
    total: number; analyzed: number; recent30: number;
    sentiment: Record<string, number>;
    topObjections: { text: string; count: number }[];
    competitors: { name: string; count: number }[];
    pendingFollowUps: number;
  };
  actions: { open: number; overdue: number; done: number; doneInWindow: number };
  recentChanges: { wonInWindow: { name: string; account: string; amount: number }[]; lostInWindow: { name: string; account: string; amount: number }[]; newInWindow: number };
  monthlyRevenue: { month: string; revenue: number }[];
  productRegionGaps: { product: string; strongRegion: string; missingRegion: string; wins: number; revenue: number }[];
}

export interface RepStat {
  id: string;
  name: string;
  region: string | null;
  revenue: number;
  revenuePrev: number;
  openCount: number;
  openValue: number;
  stalledCount: number;
  wonCount: number;
  lostCount: number;
  winRate: number | null;
  avgCycleDays: number | null;
  activityCount: number;
  openActions: number;
  overdueActions: number;
  comparable: boolean; // enough closed deals to compare meaningfully
}

const norm = (s: string | null | undefined, fallback = "Unassigned") => (s && s.trim() ? s.trim() : fallback);

function trendOf(cur: number, prev: number, prev2: number): Breakdown["trend"] {
  if (prev === 0 && cur === 0) return "flat";
  if (cur < prev && prev < prev2) return "direction-down";
  if (cur < prev * 0.9) return "dip";
  if (cur > prev * 1.1) return "up";
  if (cur < prev) return "down";
  return "flat";
}

export function computeMetrics(data: WorkspaceData, days: number, now = new Date()): Metrics {
  const w = makeWindows(days, now);
  const today = w.today;
  const stageById = new Map(data.stages.map((s) => [s.id, s]));
  const repById = new Map(data.reps.map((r) => [r.id, r]));
  const acctById = new Map(data.accounts.map((a) => [a.id, a]));

  const regionOf = (o: Opportunity) => norm(o.region ?? acctById.get(o.account_id)?.region);
  const industryOf = (o: Opportunity) => norm(acctById.get(o.account_id)?.industry);

  const won = data.opps.filter((o) => o.status === "won");
  const lost = data.opps.filter((o) => o.status === "lost");
  const open = data.opps.filter((o) => o.status === "open");

  const wonIn = (win: Win) => won.filter((o) => inW(o.closed_at, win));
  const lostIn = (win: Win) => lost.filter((o) => inW(o.closed_at, win));
  const revIn = (win: Win) => sum(wonIn(win).map((o) => Number(o.amount)));

  // ── Open pipeline views
  const lastActivityOfOpp = new Map<string, string | null>();
  const oppViews: OppView[] = open.map((o) => {
    const ref = o.last_activity_at ?? o.updated_at ?? o.created_at;
    const daysQuiet = ref ? Math.max(diffDays(ref, today), 0) : null;
    lastActivityOfOpp.set(o.id, ref);
    return {
      ...o,
      amount: Number(o.amount),
      accountName: acctById.get(o.account_id)?.name ?? "Unknown account",
      ownerName: o.owner_rep_id ? repById.get(o.owner_rep_id)?.name ?? null : null,
      stageName: o.stage_id ? stageById.get(o.stage_id)?.name ?? null : null,
      daysQuiet,
      stalled: daysQuiet != null && daysQuiet >= STALL_DAYS,
      overdue: !!o.expected_close_date && o.expected_close_date < today,
    };
  });

  const prob = (o: OppView) => (o.probability ?? (o.stage_id ? stageById.get(o.stage_id)?.probability : null) ?? 0) / 100;
  const stalled = oppViews.filter((o) => o.stalled);
  const overdue = oppViews.filter((o) => o.overdue);

  const stagesSorted = [...data.stages].sort((a, b) => a.position - b.position);
  const byStage = stagesSorted
    .filter((s) => s.kind === "open")
    .map((s) => {
      const rows = oppViews.filter((o) => o.stage_id === s.id);
      return { stage: s.name, kind: s.kind, count: rows.length, value: sum(rows.map((o) => o.amount)) };
    });
  const noStage = oppViews.filter((o) => !o.stage_id);
  if (noStage.length) byStage.push({ stage: "No stage", kind: "open", count: noStage.length, value: sum(noStage.map((o) => o.amount)) });

  // Funnel from current stage position (won counts as having passed every open stage).
  const openStages = stagesSorted.filter((s) => s.kind === "open");
  const reachedCount = (idx: number) =>
    data.opps.filter((o) => {
      if (o.status === "won") return true;
      const s = o.stage_id ? stageById.get(o.stage_id) : null;
      if (!s || s.kind === "lost") return false; // lost: furthest stage unknown from snapshot data
      const pos = openStages.findIndex((x) => x.id === s.id);
      return pos >= idx;
    }).length;
  const funnel = openStages.map((s, i) => {
    const reached = reachedCount(i);
    const prevReached = i > 0 ? reachedCount(i - 1) : null;
    return { stage: s.name, reached, conversionFromPrev: prevReached ? reached / prevReached : null };
  });

  // ── Win / loss
  const cycle = (rows: Opportunity[]) => {
    const ds = rows.filter((o) => o.closed_at && o.created_on).map((o) => diffDays(o.created_on, o.closed_at!)).filter((d) => d >= 0);
    return ds.length ? sum(ds) / ds.length : null;
  };
  const wCur = wonIn(w.cur), wPrev = wonIn(w.prev), lCur = lostIn(w.cur), lPrev = lostIn(w.prev);
  const rate = (a: number, b: number) => (a + b > 0 ? a / (a + b) : null);
  const reasonCounts = new Map<string, number>();
  lCur.forEach((o) => o.loss_reason && reasonCounts.set(o.loss_reason, (reasonCounts.get(o.loss_reason) ?? 0) + 1));

  // ── Breakdown helper
  const breakdown = (keyOf: (o: Opportunity) => string): Breakdown[] => {
    const keys = new Set<string>(data.opps.map(keyOf));
    const totalCur = revIn(w.cur);
    return [...keys]
      .map((key) => {
        const m = (o: Opportunity) => keyOf(o) === key;
        const rev = (win: Win) => sum(wonIn(win).filter(m).map((o) => Number(o.amount)));
        const revenue = rev(w.cur), revenuePrev = rev(w.prev), revenuePrev2 = rev(w.prev2);
        const allWon = won.filter(m).length, allLost = lost.filter(m).length;
        const openRows = open.filter(m);
        return {
          key, revenue, revenuePrev, revenuePrev2,
          change: revenue - revenuePrev,
          changePct: revenuePrev > 0 ? (revenue - revenuePrev) / revenuePrev : null,
          wonCount: allWon, lostCount: allLost,
          winRate: rate(allWon, allLost),
          openCount: openRows.length,
          openValue: sum(openRows.map((o) => Number(o.amount))),
          share: totalCur > 0 ? revenue / totalCur : 0,
          trend: trendOf(revenue, revenuePrev, revenuePrev2),
        } satisfies Breakdown;
      })
      .sort((a, b) => b.revenue - a.revenue || b.openValue - a.openValue);
  };

  // ── Reps
  const reps: RepStat[] = data.reps.map((r) => {
    const mine = data.opps.filter((o) => o.owner_rep_id === r.id);
    const mWon = mine.filter((o) => o.status === "won"), mLost = mine.filter((o) => o.status === "lost");
    const mOpenV = oppViews.filter((o) => o.owner_rep_id === r.id);
    const acts = data.actions.filter((a) => a.owner_rep_id === r.id && (a.status === "open" || a.status === "in_progress"));
    return {
      id: r.id, name: r.name, region: r.region,
      revenue: sum(mWon.filter((o) => inW(o.closed_at, w.cur)).map((o) => Number(o.amount))),
      revenuePrev: sum(mWon.filter((o) => inW(o.closed_at, w.prev)).map((o) => Number(o.amount))),
      openCount: mOpenV.length,
      openValue: sum(mOpenV.map((o) => o.amount)),
      stalledCount: mOpenV.filter((o) => o.stalled).length,
      wonCount: mWon.length, lostCount: mLost.length,
      winRate: rate(mWon.length, mLost.length),
      avgCycleDays: cycle(mWon),
      activityCount: data.activities.filter((a) => a.rep_id === r.id && inW(a.occurred_at, w.cur)).length,
      openActions: acts.length,
      overdueActions: acts.filter((a) => a.due_date && a.due_date < today).length,
      comparable: mWon.length + mLost.length >= 5,
    };
  });

  // ── Accounts
  const negByAccount = new Set<string>();
  const pendingFollowByAccount = new Set<string>();
  data.findings.forEach((f) => {
    const acc = f.conversation.account_id;
    if (!acc) return;
    if (f.sentiment === "negative" && diffDays(f.conversation.occurred_at, today) <= 60) negByAccount.add(acc);
    if (f.follow_up_required) pendingFollowByAccount.add(acc);
  });

  const accountStats: AccountStat[] = data.accounts.map((a) => {
    const aw = won.filter((o) => o.account_id === a.id).sort((x, y) => (x.closed_at ?? "").localeCompare(y.closed_at ?? ""));
    const ao = oppViews.filter((o) => o.account_id === a.id);
    const acts = data.activities.filter((x) => x.account_id === a.id).map((x) => x.occurred_at);
    const candidates = [a.last_interaction_at, ...ao.map((o) => o.last_activity_at), ...acts, aw.at(-1)?.closed_at].filter(Boolean) as string[];
    const lastActivityAt = candidates.sort().at(-1) ?? null;

    let declining: AccountStat["declining"] = null;
    if (aw.length >= 2) {
      const dates = aw.map((o) => o.closed_at!).filter(Boolean);
      const gaps = dates.slice(1).map((d, i) => diffDays(dates[i], d)).filter((g) => g > 0);
      const avgGap = gaps.length ? sum(gaps) / gaps.length : null;
      const sinceLast = diffDays(dates.at(-1)!, today);
      const amts = aw.map((o) => Number(o.amount));
      const lastAmt = amts.at(-1)!, priorAvg = sum(amts.slice(0, -1)) / (amts.length - 1);
      if (avgGap && sinceLast > Math.max(avgGap * 1.5, 30) && ao.length === 0) {
        declining = {
          reason: sinceLast > 180 ? "Stopped buying" : "Longer gaps between orders",
          detail: `Last win ${sinceLast} days ago; they usually buy every ~${Math.round(avgGap)} days and nothing is open.`,
        };
      } else if (amts.length >= 3 && lastAmt < priorAvg * 0.75) {
        declining = {
          reason: "Smaller orders",
          detail: `Latest order ${Math.round(lastAmt)} is ${Math.round((1 - lastAmt / priorAvg) * 100)}% below their earlier average of ${Math.round(priorAvg)}.`,
        };
      }
    }
    return {
      id: a.id, name: a.name, region: a.region, industry: a.industry, status: a.status,
      ownerRepId: a.owner_rep_id,
      wonRevenue: sum(aw.map((o) => Number(o.amount))),
      wonCount: aw.length,
      lastWonAt: aw.at(-1)?.closed_at ?? null,
      openValue: sum(ao.map((o) => o.amount)),
      openCount: ao.length,
      products: [...new Set(aw.map((o) => o.product).filter(Boolean) as string[])],
      lastActivityAt,
      daysQuiet: lastActivityAt ? Math.max(diffDays(lastActivityAt, today), 0) : null,
      negativeSentiment: negByAccount.has(a.id),
      pendingFollowUp: pendingFollowByAccount.has(a.id),
      declining,
    };
  });

  // ── Concentration (trailing 365 days, falling back to all-time)
  const yearStart = shift(today, -365);
  let basisWon = won.filter((o) => (o.closed_at ?? "") >= yearStart);
  let basis = "last 12 months";
  if (basisWon.length === 0) { basisWon = won; basis = "all time"; }
  const revenueBasis = sum(basisWon.map((o) => Number(o.amount)));
  const byAcc = new Map<string, number>();
  const byReg = new Map<string, number>();
  basisWon.forEach((o) => {
    byAcc.set(o.account_id, (byAcc.get(o.account_id) ?? 0) + Number(o.amount));
    const r = regionOf(o);
    byReg.set(r, (byReg.get(r) ?? 0) + Number(o.amount));
  });
  const accSorted = [...byAcc.entries()].sort((a, b) => b[1] - a[1]);
  const regSorted = [...byReg.entries()].sort((a, b) => b[1] - a[1]);
  const concentration = {
    topAccount: accSorted[0] && revenueBasis > 0 ? { name: acctById.get(accSorted[0][0])?.name ?? "Unknown", share: accSorted[0][1] / revenueBasis } : null,
    top3Share: revenueBasis > 0 && accSorted.length ? sum(accSorted.slice(0, 3).map((x) => x[1])) / revenueBasis : null,
    topRegion: regSorted[0] && revenueBasis > 0 ? { name: regSorted[0][0], share: regSorted[0][1] / revenueBasis } : null,
    basis, revenueBasis,
  };

  // ── Conversations
  const sentiment: Record<string, number> = {};
  const objections = new Map<string, number>();
  const competitors = new Map<string, number>();
  data.findings.forEach((f) => {
    if (f.sentiment) sentiment[f.sentiment] = (sentiment[f.sentiment] ?? 0) + 1;
    f.objections?.forEach((t) => objections.set(t.trim().toLowerCase(), (objections.get(t.trim().toLowerCase()) ?? 0) + 1));
    f.competitors?.forEach((t) => competitors.set(t.trim(), (competitors.get(t.trim()) ?? 0) + 1));
  });
  const topN = <T,>(m: Map<string, number>, mk: (k: string, c: number) => T) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, c]) => mk(k, c));

  // ── Actions
  const openActs = data.actions.filter((a) => a.status === "open" || a.status === "in_progress");
  const doneActs = data.actions.filter((a) => a.status === "done");

  // ── Monthly revenue series (last 12 months)
  const monthly = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i, 1);
    monthly.set(day(d).slice(0, 7), 0);
  }
  won.forEach((o) => {
    const k = (o.closed_at ?? "").slice(0, 7);
    if (monthly.has(k)) monthly.set(k, (monthly.get(k) ?? 0) + Number(o.amount));
  });


  // Products winning in one region and absent in another
  const prKey = new Map<string, { wins: number; revenue: number }>();
  won.forEach((o) => {
    const p = norm(o.product), r = regionOf(o);
    if (p === "Unassigned" || r === "Unassigned") return;
    const k = p + "||" + r;
    const v = prKey.get(k) ?? { wins: 0, revenue: 0 };
    v.wins += 1; v.revenue += Number(o.amount);
    prKey.set(k, v);
  });
  const knownRegions = [...new Set(won.map(regionOf).filter((r) => r !== "Unassigned"))];
  const productRegionGaps: Metrics["productRegionGaps"] = [];
  [...new Set([...prKey.keys()].map((k) => k.split("||")[0]))].forEach((p) => {
    const strong = knownRegions
      .map((r) => ({ r, v: prKey.get(p + "||" + r) }))
      .filter((x) => x.v && x.v.wins >= 2)
      .sort((a, b) => b.v!.revenue - a.v!.revenue)[0];
    if (!strong) return;
    knownRegions.filter((r) => !prKey.has(p + "||" + r)).forEach((missing) =>
      productRegionGaps.push({ product: p, strongRegion: strong.r, missingRegion: missing, wins: strong.v!.wins, revenue: strong.v!.revenue }),
    );
  });
  productRegionGaps.sort((a, b) => b.revenue - a.revenue);

  const weighted = sum(oppViews.map((o) => o.amount * prob(o)));
  const mapDeal = (o: Opportunity) => ({ name: o.name, account: acctById.get(o.account_id)?.name ?? "Unknown", amount: Number(o.amount) });

  const createdCur = data.opps.filter((o) => inW(o.created_on, w.cur));
  const createdPrev = data.opps.filter((o) => inW(o.created_on, w.prev));

  return {
    generatedAt: now.toISOString(),
    windows: w,
    counts: {
      opportunities: data.opps.length, accounts: data.accounts.length, reps: data.reps.length,
      conversations: data.findings.length, leads: data.leads.length,
    },
    dataFreshness: {
      latestOpportunityUpdate: data.opps.map((o) => o.updated_at).sort().at(-1) ?? null,
      latestWonClose: won.map((o) => o.closed_at).filter(Boolean).sort().at(-1) ?? null,
    },
    revenue: {
      ...delta(revIn(w.cur), revIn(w.prev)),
      prev2: revIn(w.prev2),
      wonCount: wCur.length, wonCountPrev: wPrev.length,
      avgDeal: wCur.length ? revIn(w.cur) / wCur.length : null,
    },
    pipeline: {
      openCount: oppViews.length,
      openValue: sum(oppViews.map((o) => o.amount)),
      weightedValue: weighted,
      created: {
        ...delta(sum(createdCur.map((o) => Number(o.amount))), sum(createdPrev.map((o) => Number(o.amount)))),
        createdCount: createdCur.length, createdCountPrev: createdPrev.length,
      },
      stalledCount: stalled.length, stalledValue: sum(stalled.map((o) => o.amount)),
      overdueCount: overdue.length, overdueValue: sum(overdue.map((o) => o.amount)),
      byStage,
    },
    winLoss: {
      won: wCur.length, lost: lCur.length, wonPrev: wPrev.length, lostPrev: lPrev.length,
      winRate: rate(wCur.length, lCur.length), winRatePrev: rate(wPrev.length, lPrev.length),
      avgCycleDays: cycle(wCur), avgCycleDaysPrev: cycle(wPrev),
      lossReasons: [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
    },
    funnel,
    byRegion: breakdown(regionOf),
    byProduct: breakdown((o) => norm(o.product)),
    byMotion: breakdown((o) => norm(o.motion)),
    byIndustry: breakdown(industryOf),
    reps,
    accounts: accountStats,
    openOpps: oppViews.sort((a, b) => b.amount - a.amount),
    concentration,
    declining: accountStats.filter((a) => a.declining).sort((a, b) => b.wonRevenue - a.wonRevenue),
    conversations: {
      total: data.findings.length,
      analyzed: data.findings.length,
      recent30: data.findings.filter((f) => diffDays(f.conversation.occurred_at, today) <= 30).length,
      sentiment,
      topObjections: topN(objections, (text, count) => ({ text, count })),
      competitors: topN(competitors, (name, count) => ({ name, count })),
      pendingFollowUps: data.findings.filter((f) => f.follow_up_required).length,
    },
    actions: {
      open: openActs.length,
      overdue: openActs.filter((a) => a.due_date && a.due_date < today).length,
      done: doneActs.length,
      doneInWindow: doneActs.filter((a) => inW(a.completed_at, w.cur)).length,
    },
    recentChanges: {
      wonInWindow: wCur.slice(0, 10).map(mapDeal),
      lostInWindow: lCur.slice(0, 10).map(mapDeal),
      newInWindow: createdCur.length,
    },
    monthlyRevenue: [...monthly.entries()].map(([month, revenue]) => ({ month, revenue })),
    productRegionGaps,
  };
}
