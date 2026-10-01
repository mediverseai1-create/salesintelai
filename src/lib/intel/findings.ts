import type { Metrics, Breakdown } from "@/lib/intel/metrics";
import { money, pct } from "@/lib/utils";

export interface SixFinding {
  key: "trends" | "high_value" | "underperformance" | "declining" | "revenue_at_risk" | "room_to_grow";
  n: number;
  title: string;
  looksFor: string;
  status: "ready" | "insufficient";
  headline: string;
  evidence: { label: string; value: string }[];
  items: { title: string; detail: string; tone?: "good" | "bad" | "neutral"; href?: string }[];
  needs?: string;
}

const signed = (n: number, f: (x: number) => string) => `${n >= 0 ? "+" : "−"}${f(Math.abs(n))}`;
const dir = (b: Breakdown) =>
  b.trend === "direction-down" ? "down two periods running — a direction, not a dip" : b.trend === "dip" ? "a dip against the previous period" : "slightly lower";

function insufficient(base: Pick<SixFinding, "key" | "n" | "title" | "looksFor">, needs: string): SixFinding {
  return { ...base, status: "insufficient", headline: "More data is required for this finding.", evidence: [], items: [], needs };
}

/** The six things every briefing looks for, computed from the workspace's own data. */
export function computeFindings(m: Metrics): SixFinding[] {
  const out: SixFinding[] = [];
  const closedTotal = m.byRegion.reduce((s, r) => s + r.wonCount + r.lostCount, 0);
  const totalWon = m.byRegion.reduce((s, r) => s + r.wonCount, 0);

  // 1 ── Trends and patterns
  {
    const base = { key: "trends", n: 1, title: "Trends and patterns", looksFor: "Where revenue is heading, which months, products or accounts drove the change, repeat buying patterns." } as const;
    if (totalWon < 3) out.push(insufficient(base, "Import at least 3 closed-won opportunities with close dates to see revenue trends."));
    else {
      const r = m.revenue;
      const items: SixFinding["items"] = [];
      const drivers = [...m.byRegion.map((b) => ({ k: "Region", b })), ...m.byProduct.filter((b) => b.key !== "Unassigned").map((b) => ({ k: "Product", b }))]
        .filter((x) => x.b.change !== 0)
        .sort((a, b) => Math.abs(b.b.change) - Math.abs(a.b.change))
        .slice(0, 4);
      drivers.forEach(({ k, b }) =>
        items.push({
          title: `${k}: ${b.key}`,
          detail: `${money(b.revenue)} this period vs ${money(b.revenuePrev)} before (${signed(b.change, (x) => money(x))}).`,
          tone: b.change >= 0 ? "good" : "bad",
        }),
      );
      const repeat = m.accounts.filter((a) => a.wonCount >= 2);
      if (repeat.length) items.push({ title: "Repeat buyers", detail: `${repeat.length} of ${m.accounts.filter((a) => a.wonCount >= 1).length} customers have bought more than once.`, tone: "neutral" });
      const best = [...m.monthlyRevenue].sort((a, b) => b.revenue - a.revenue)[0];
      out.push({
        ...base, status: "ready",
        headline:
          r.prev > 0
            ? `Revenue is ${money(r.cur)} this period, ${signed(r.change, (x) => money(x))} (${signed(r.changePct ?? 0, (x) => pct(x))}) against the previous period.`
            : `Revenue is ${money(r.cur)} this period. There is no prior-period revenue to compare against yet.`,
        evidence: [
          { label: "This period", value: money(r.cur) },
          { label: "Previous period", value: money(r.prev) },
          { label: "Deals won", value: `${r.wonCount} (${r.wonCountPrev} before)` },
          ...(best && best.revenue > 0 ? [{ label: "Best month (12 mo)", value: `${best.month} · ${money(best.revenue)}` }] : []),
        ],
        items,
      });
    }
  }

  // 2 ── High-value opportunities
  {
    const base = { key: "high_value", n: 2, title: "High-value opportunities", looksFor: "Customers buying one thing who could buy more, products selling in one region and not another, segments with the strongest return." } as const;
    const items: SixFinding["items"] = [];
    const single = m.accounts.filter((a) => a.wonCount >= 1 && a.products.length === 1 && a.openCount === 0).sort((a, b) => b.wonRevenue - a.wonRevenue).slice(0, 4);
    single.forEach((a) => items.push({ title: `${a.name} buys only ${a.products[0]}`, detail: `${money(a.wonRevenue)} won across ${a.wonCount} deal${a.wonCount > 1 ? "s" : ""}, nothing open — a candidate to expand.`, tone: "good", href: `/app/accounts/${a.id}` }));

    m.productRegionGaps.slice(0, 3).forEach((g) =>
      items.push({ title: `${g.product}: strong in ${g.strongRegion}, absent in ${g.missingRegion}`, detail: `${g.wins} wins (${money(g.revenue)}) in ${g.strongRegion}; no wins in ${g.missingRegion}.`, tone: "good" }),
    );
    const top = m.openOpps
      .map((o) => ({ o, w: o.amount * ((o.probability ?? 0) / 100) }))
      .filter((x) => x.w > 0)
      .sort((a, b) => b.w - a.w)
      .slice(0, 3);
    top.forEach(({ o, w }) => items.push({ title: `${o.accountName} — ${o.name}`, detail: `${money(o.amount)} open at ${o.probability}% (weighted ${money(w)})${o.ownerName ? `, owned by ${o.ownerName}` : ""}.`, tone: "good", href: `/app/accounts/${o.account_id}` }));

    const seg = m.byIndustry.filter((s) => s.key !== "Unassigned" && s.wonCount + s.lostCount >= 3 && s.winRate != null).sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];
    if (seg) items.push({ title: `Strongest segment: ${seg.key}`, detail: `${pct(seg.winRate)} win rate over ${seg.wonCount + seg.lostCount} closed deals.`, tone: "good" });

    if (!items.length) out.push(insufficient(base, "Needs product data on won deals, open opportunities with probabilities, or industry on accounts."));
    else out.push({ ...base, status: "ready", headline: `${items.length} places to look for more revenue in the data you have.`, evidence: [{ label: "Open pipeline", value: money(m.pipeline.openValue) }, { label: "Weighted", value: money(m.pipeline.weightedValue) }], items });
  }

  // 3 ── Underperformance
  {
    const base = { key: "underperformance", n: 3, title: "Underperformance", looksFor: "Products, customers, regions and reps falling behind, how far and since when, and whether it is a dip or a direction." } as const;
    const lagging: SixFinding["items"] = [];
    const consider = (kind: string, rows: Breakdown[]) =>
      rows.filter((b) => b.key !== "Unassigned" && b.revenuePrev > 0 && b.revenue < b.revenuePrev * 0.95).forEach((b) =>
        lagging.push({ title: `${kind}: ${b.key}`, detail: `${money(b.revenue)} vs ${money(b.revenuePrev)} previously (${signed(b.change, (x) => money(x))}, ${signed(b.changePct ?? 0, (x) => pct(x))}) — ${dir(b)}.`, tone: "bad" }),
      );
    consider("Region", m.byRegion);
    consider("Product", m.byProduct);
    m.reps.filter((r) => r.revenuePrev > 0 && r.revenue < r.revenuePrev * 0.95).forEach((r) =>
      lagging.push({ title: `Rep: ${r.name}`, detail: `${money(r.revenue)} vs ${money(r.revenuePrev)} previously (${signed(r.revenue - r.revenuePrev, (x) => money(x))}).`, tone: "bad" }),
    );
    const hasPrior = m.revenue.prev > 0;
    if (!hasPrior) out.push(insufficient(base, "Needs closed-won revenue in at least two consecutive reporting periods to measure who is falling behind."));
    else
      out.push({
        ...base, status: "ready",
        headline: lagging.length ? `${lagging.length} segment${lagging.length > 1 ? "s are" : " is"} behind the previous period.` : "No region, product or rep is materially behind the previous period.",
        evidence: [{ label: "Revenue change", value: `${signed(m.revenue.change, (x) => money(x))}` }, { label: "Win rate", value: `${pct(m.winLoss.winRate)} (${pct(m.winLoss.winRatePrev)} before)` }],
        items: lagging.slice(0, 8),
      });
  }

  // 4 ── Declining customers
  {
    const base = { key: "declining", n: 4, title: "Declining customers", looksFor: "Smaller orders or longer gaps between them, customers who stopped buying, who to call first and why." } as const;
    const repeat = m.accounts.filter((a) => a.wonCount >= 2).length;
    if (repeat === 0) out.push(insufficient(base, "Needs customers with at least two closed-won deals to detect slowing or lapsed buying."));
    else
      out.push({
        ...base, status: "ready",
        headline: m.declining.length ? `${m.declining.length} of ${repeat} repeat customers show declining buying — call ${m.declining[0].name} first.` : `None of the ${repeat} repeat customers shows declining buying right now.`,
        evidence: [{ label: "Repeat customers", value: String(repeat) }, { label: "Declining", value: String(m.declining.length) }, { label: "Revenue exposed", value: money(m.declining.reduce((s, a) => s + a.wonRevenue, 0)) }],
        items: m.declining.slice(0, 8).map((a) => ({ title: `${a.name} — ${a.declining!.reason}`, detail: `${a.declining!.detail} Lifetime won: ${money(a.wonRevenue)}.`, tone: "bad" as const, href: `/app/accounts/${a.id}` })),
      });
  }

  // 5 ── Revenue at risk
  {
    const base = { key: "revenue_at_risk", n: 5, title: "Revenue at risk", looksFor: "Too much revenue with too few customers, repeat business slowing down, regions or products carrying more weight than they should." } as const;
    const items: SixFinding["items"] = [];
    const c = m.concentration;
    if (c.topAccount && c.topAccount.share >= 0.25) items.push({ title: "Customer concentration", detail: `${c.topAccount.name} is ${pct(c.topAccount.share)} of won revenue (${c.basis}); the top three customers are ${pct(c.top3Share)}.`, tone: "bad" });
    if (c.topRegion && m.byRegion.length > 1 && c.topRegion.share >= 0.5) items.push({ title: "Regional dependence", detail: `${c.topRegion.name} carries ${pct(c.topRegion.share)} of won revenue (${c.basis}).`, tone: "bad" });
    if (m.pipeline.stalledCount) items.push({ title: "Stalled pipeline", detail: `${m.pipeline.stalledCount} open deals worth ${money(m.pipeline.stalledValue)} have had no activity for 21+ days.`, tone: "bad" });
    if (m.pipeline.overdueCount) items.push({ title: "Past expected close date", detail: `${m.pipeline.overdueCount} open deals worth ${money(m.pipeline.overdueValue)} are past their expected close date.`, tone: "bad" });
    const negOpen = m.accounts.filter((a) => a.negativeSentiment && a.openCount > 0);
    if (negOpen.length) items.push({ title: "Negative call sentiment on open deals", detail: `${negOpen.map((a) => a.name).slice(0, 4).join(", ")}${negOpen.length > 4 ? "…" : ""} — recent conversations were negative while deals remain open (${money(negOpen.reduce((s, a) => s + a.openValue, 0))}).`, tone: "bad" });
    if (m.declining.length) items.push({ title: "Repeat business slowing", detail: `${m.declining.length} repeat customers are buying less or less often (${money(m.declining.reduce((s, a) => s + a.wonRevenue, 0))} lifetime).`, tone: "bad" });
    const hasBasis = m.concentration.revenueBasis > 0 || m.pipeline.openCount > 0;
    if (!hasBasis) out.push(insufficient(base, "Needs closed-won revenue or open pipeline to assess exposure."));
    else
      out.push({
        ...base, status: "ready",
        headline: items.length ? `${items.length} risk signal${items.length > 1 ? "s" : ""} found in the data.` : "No concentration, stall or slowdown signals crossed their thresholds.",
        evidence: [
          { label: "Top customer share", value: c.topAccount ? pct(c.topAccount.share) : "—" },
          { label: "Stalled value", value: money(m.pipeline.stalledValue) },
          { label: "Overdue value", value: money(m.pipeline.overdueValue) },
        ],
        items,
      });
  }

  // 6 ── Room to grow
  {
    const base = { key: "room_to_grow", n: 6, title: "Room to grow", looksFor: "Best-performing motions named, where the same approach could be repeated, what to scale first." } as const;
    const items: SixFinding["items"] = [];
    const motions = m.byMotion.filter((x) => x.key !== "Unassigned" && x.wonCount + x.lostCount >= 3 && x.winRate != null).sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
    motions.slice(0, 3).forEach((x) => items.push({ title: `Motion: ${x.key}`, detail: `${pct(x.winRate)} win rate over ${x.wonCount + x.lostCount} closed deals; ${x.openCount} open worth ${money(x.openValue)}.`, tone: "good" }));
    const totalOpen = m.pipeline.openValue || 1;
    m.byIndustry
      .filter((s) => s.key !== "Unassigned" && s.wonCount + s.lostCount >= 4 && (s.winRate ?? 0) >= 0.4 && s.openValue / totalOpen < 0.15)
      .slice(0, 2)
      .forEach((s) => items.push({ title: `Under-fished segment: ${s.key}`, detail: `Wins ${pct(s.winRate)} of the time but holds only ${pct(s.openValue / totalOpen)} of open pipeline — scale this first.`, tone: "good" }));
    const reg = m.byRegion.filter((r) => r.key !== "Unassigned" && r.wonCount + r.lostCount >= 3 && r.winRate != null).sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];
    if (reg) items.push({ title: `Strongest region: ${reg.key}`, detail: `${pct(reg.winRate)} win rate; ${money(reg.revenue)} this period.`, tone: "good" });
    if (closedTotal < 5 || !items.length) out.push(insufficient(base, "Needs at least 5 closed deals, with motion/source, industry or region filled in, to name what works."));
    else out.push({ ...base, status: "ready", headline: `Best-performing motion: ${motions[0]?.key ?? "see segments below"}.`, evidence: [{ label: "Closed deals analysed", value: String(closedTotal) }, { label: "Avg cycle", value: m.winLoss.avgCycleDays != null ? `${Math.round(m.winLoss.avgCycleDays)} days` : "—" }], items });
  }

  return out;
}
