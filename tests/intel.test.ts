import assert from "node:assert/strict";
import { computeMetrics, type WorkspaceData } from "../src/lib/intel/metrics";
import { computeFindings } from "../src/lib/intel/findings";
import { suggestActions } from "../src/lib/intel/nba";

const now = new Date("2026-06-15T12:00:00Z");
const d = (n: number) => new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);
const ts = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

const stages = [
  { id: "s1", name: "Discovery", position: 1, kind: "open", probability: 25 },
  { id: "s2", name: "Proposal", position: 2, kind: "open", probability: 50 },
  { id: "w", name: "Won", position: 3, kind: "won", probability: 100 },
  { id: "l", name: "Lost", position: 4, kind: "lost", probability: 0 },
] as const;
const reps = [
  { id: "r1", name: "Ana", email: null, region: "EMEA", user_id: null, active: true },
  { id: "r2", name: "Ben", email: null, region: "AMER", user_id: null, active: true },
];
const mkAcc = (id: string, name: string, region: string, industry: string) => ({
  id, name, region, industry, size_band: null, website: null, status: "customer" as const, owner_rep_id: "r1",
  contact_name: null, contact_email: null, last_interaction_at: null, notes: null, created_at: ts(400),
});
let oid = 0;
const opp = (account_id: string, amount: number, status: "open" | "won" | "lost", o: Record<string, unknown> = {}) => ({
  id: `o${++oid}`, account_id, name: `Deal ${oid}`, amount, stage_id: status === "won" ? "w" : status === "lost" ? "l" : "s2",
  status, probability: status === "open" ? 50 : null, owner_rep_id: "r1", product: "Alpha", region: null, motion: "Outbound",
  expected_close_date: null, created_on: d(100), closed_at: null, last_activity_at: ts(2), loss_reason: null, notes: null,
  created_at: ts(100), updated_at: ts(2), ...o,
});

const data: WorkspaceData = {
  stages: stages as never, reps,
  accounts: [mkAcc("a1", "Acme", "EMEA", "Software"), mkAcc("a2", "Globex", "AMER", "Retail"), mkAcc("a3", "Initech", "AMER", "Software")],
  opps: [
    // current 7-day window
    opp("a1", 10000, "won", { closed_at: d(2), created_on: d(30) }),
    opp("a2", 4000, "won", { closed_at: d(3), product: "Beta", owner_rep_id: "r2" }),
    // previous window
    opp("a1", 20000, "won", { closed_at: d(10) }),
    opp("a2", 9000, "won", { closed_at: d(12), product: "Beta", owner_rep_id: "r2" }),
    opp("a3", 1000, "lost", { closed_at: d(5), loss_reason: "Price", owner_rep_id: "r2" }),
    // old repeat purchases for declining detection
    opp("a3", 5000, "won", { closed_at: d(400) }),
    opp("a3", 5000, "won", { closed_at: d(300) }),
    // open: one stalled, one overdue
    opp("a1", 15000, "open", { last_activity_at: ts(40), updated_at: ts(40), expected_close_date: d(5) }),
    opp("a2", 8000, "open"),
  ] as never,
  findings: [{
    id: "f1", conversation_id: "c1", summary: "x", intent: "buy", sentiment: "negative", objections: ["price"], commitments: [],
    competitors: ["Rival"], decision_criteria: [], risks: [], next_action: "Send revised quote", follow_up_required: true, follow_up_by: d(-1),
    conversation: { title: "Call with Globex", account_id: "a2", opportunity_id: null, occurred_at: ts(3) },
  }] as never,
  actions: [], leads: [], activities: [],
};

const m = computeMetrics(data, 7, now);
assert.equal(m.revenue.cur, 14000, "current revenue");
assert.equal(m.revenue.prev, 29000, "previous revenue");
assert.equal(Math.round((m.revenue.changePct ?? 0) * 100), -52);
assert.equal(m.pipeline.openCount, 2);
assert.equal(m.pipeline.openValue, 23000);
assert.equal(m.pipeline.stalledCount, 1, "one stalled");
assert.equal(m.pipeline.overdueCount, 1, "one overdue");
assert.equal(m.winLoss.won, 2);
assert.equal(m.winLoss.lost, 1);
assert.ok(Math.abs((m.winLoss.winRate ?? 0) - 2 / 3) < 1e-9);
assert.equal(m.byRegion.find((r) => r.key === "EMEA")?.revenue, 10000);
assert.equal(m.byProduct.find((r) => r.key === "Beta")?.revenue, 4000);
assert.ok(m.declining.some((a) => a.name === "Initech"), "Initech flagged as declining (stopped buying)");
assert.ok(m.concentration.topAccount, "concentration computed");
assert.equal(m.conversations.sentiment.negative, 1);
assert.equal(m.accounts.find((a) => a.id === "a2")?.negativeSentiment, true);

const f = computeFindings(m);
assert.equal(f.length, 6);
assert.equal(f[0].status, "ready");
const under = f.find((x) => x.key === "underperformance")!;
assert.equal(under.status, "ready");
assert.ok(under.items.some((i) => i.title.includes("EMEA")), "EMEA flagged underperforming");

const acts = suggestActions(m, data.findings);
assert.ok(acts.some((a) => a.title.includes("Re-engage Acme")), "stalled action");
assert.ok(acts.some((a) => a.title.includes("Send revised quote")), "conversation action");

// Empty workspace -> everything "insufficient", no fabricated numbers
const empty = computeMetrics({ opps: [], accounts: [], reps: [], stages: [], findings: [], actions: [], leads: [], activities: [] }, 30, now);
const ef = computeFindings(empty);
assert.ok(ef.every((x) => x.status === "insufficient"), "empty workspace gives no findings");
assert.equal(empty.revenue.cur, 0);
console.log("intel engine: all assertions passed");
