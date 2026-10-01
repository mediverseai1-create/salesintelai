import type { Metrics } from "@/lib/intel/metrics";
import type { FindingRow } from "@/lib/intel/metrics";
import { money } from "@/lib/utils";

export interface ActionDraft {
  title: string;
  reason: string;
  expected_outcome: string;
  definition_of_done: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_in_days: number;
  account_id: string | null;
  opportunity_id: string | null;
  conversation_id?: string | null;
  owner_rep_id: string | null;
  source: "system" | "conversation";
}

/**
 * Rule-based Next Best Actions: transparent, repeatable, and free of AI credits.
 * Each recommendation is derived from a specific record and states why it exists.
 */
export function suggestActions(m: Metrics, findings: FindingRow[] = []): ActionDraft[] {
  const out: ActionDraft[] = [];
  const seen = new Set<string>();
  const add = (key: string, d: ActionDraft) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push(d);
  };

  const sizeRank = [...m.openOpps].sort((a, b) => b.amount - a.amount);
  const bigThreshold = sizeRank[Math.floor(sizeRank.length / 4)]?.amount ?? Infinity;

  m.openOpps
    .filter((o) => o.stalled)
    .slice(0, 10)
    .forEach((o) =>
      add(`stall:${o.id}`, {
        title: `Re-engage ${o.accountName} on "${o.name}"`,
        reason: `No activity for ${o.daysQuiet} days on ${money(o.amount)} open${o.stageName ? ` in ${o.stageName}` : ""}.`,
        expected_outcome: "A confirmed next step, or a clear decision to close the deal out.",
        definition_of_done: "Contact made, next step and date logged on the opportunity.",
        priority: o.amount >= bigThreshold ? "high" : "medium",
        due_in_days: 3,
        account_id: o.account_id, opportunity_id: o.id, owner_rep_id: o.owner_rep_id, source: "system",
      }),
    );

  m.openOpps
    .filter((o) => o.overdue && !o.stalled)
    .slice(0, 8)
    .forEach((o) =>
      add(`overdue:${o.id}`, {
        title: `Update or close "${o.name}" for ${o.accountName}`,
        reason: `Expected close date ${o.expected_close_date} has passed; ${money(o.amount)} is still open.`,
        expected_outcome: "Accurate forecast: a realistic close date or a closed status.",
        definition_of_done: "Close date confirmed with the buyer or the opportunity is marked won/lost.",
        priority: "medium", due_in_days: 2,
        account_id: o.account_id, opportunity_id: o.id, owner_rep_id: o.owner_rep_id, source: "system",
      }),
    );

  m.declining.slice(0, 6).forEach((a) =>
    add(`decline:${a.id}`, {
      title: `Call ${a.name}: ${a.declining!.reason.toLowerCase()}`,
      reason: a.declining!.detail,
      expected_outcome: "Understand what changed and open a new opportunity or recover the relationship.",
      definition_of_done: "Conversation held and either an opportunity is created or the reason for the drop is recorded.",
      priority: a.wonRevenue > 0 ? "high" : "medium", due_in_days: 5,
      account_id: a.id, opportunity_id: null, owner_rep_id: a.ownerRepId, source: "system",
    }),
  );

  m.accounts
    .filter((a) => a.negativeSentiment && a.openCount > 0)
    .slice(0, 5)
    .forEach((a) =>
      add(`neg:${a.id}`, {
        title: `Address concerns raised by ${a.name}`,
        reason: `A recent conversation was negative and ${a.openCount} deal(s) worth ${money(a.openValue)} are open.`,
        expected_outcome: "Objections resolved or escalated before the deal cools.",
        definition_of_done: "Follow-up held that addresses the objections raised on the call.",
        priority: "high", due_in_days: 2,
        account_id: a.id, opportunity_id: null, owner_rep_id: a.ownerRepId, source: "system",
      }),
    );

  // Commitments and next actions captured from conversations
  findings
    .filter((f) => f.follow_up_required)
    .slice(0, 10)
    .forEach((f) =>
      add(`conv:${f.conversation_id}`, {
        title: f.next_action ? f.next_action : `Follow up: ${f.conversation.title}`,
        reason: `Captured from the conversation "${f.conversation.title}"${f.follow_up_by ? `; follow-up due ${f.follow_up_by}` : ""}.`,
        expected_outcome: "The commitment made on the call is honoured and logged.",
        definition_of_done: "Follow-up sent or completed and recorded against the account.",
        priority: "high", due_in_days: 2,
        account_id: f.conversation.account_id, opportunity_id: f.conversation.opportunity_id, conversation_id: f.conversation_id,
        owner_rep_id: null, source: "conversation",
      }),
    );

  return out;
}
