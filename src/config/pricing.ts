/**
 * Single source of truth for plans shown in the product and on the marketing site.
 * Credit allowances are also stored in the `plans` table (supabase/migrations/0001_schema.sql),
 * which is what the database uses to refresh credits each billing cycle — keep both in sync.
 *
 * Payment links come from environment variables (no checkout is built into the app):
 *   STARTER_PAYMENT_LINK, PRO_PAYMENT_LINK
 */
export type PlanId = "free" | "starter" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number;
  monthlyCredits: number;
  blurb: string;
  points: string[];
  envLink?: "STARTER_PAYMENT_LINK" | "PRO_PAYMENT_LINK";
}

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceUsd: 0,
    monthlyCredits: 200,
    blurb: "Run the full loop on your own data and see what it finds.",
    points: ["Every module included", "200 credits a month", "Unlimited historical data", "Unlimited team members"],
  },
  {
    id: "starter",
    name: "Starter",
    priceUsd: 47,
    monthlyCredits: 4000,
    blurb: "Room to run a briefing every day and work follow-up campaigns.",
    points: ["Every module included", "4,000 credits a month", "Unlimited historical data", "Unlimited team members"],
    envLink: "STARTER_PAYMENT_LINK",
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 97,
    monthlyCredits: 11000,
    blurb: "Built for the heaviest users: daily briefings plus regular conversation analysis.",
    points: ["Every module included", "11,000 credits a month", "Unlimited historical data", "Unlimited team members"],
    envLink: "PRO_PAYMENT_LINK",
  },
];

export const planById = (id: string): Plan => plans.find((p) => p.id === id) ?? plans[0];

/** Server-side only: resolve the hosted payment link for a plan, if configured. */
export function paymentLinkFor(id: PlanId): string | null {
  const plan = planById(id);
  if (!plan.envLink) return null;
  const url = process.env[plan.envLink];
  if (!url || !/^https:\/\//i.test(url)) return null;
  return url;
}

/**
 * Credits drawn by each AI operation. Adjust here; the numbers are shown in the Usage page.
 * Confirm these with the product owner before making public claims about them.
 */
export const creditCosts = {
  briefing: 50,
  question: 5,
  conversation_text: 15,
  conversation_audio: 30,
  follow_up_draft: 4,
  lead_scoring: 10,
} as const;

export type CreditOperation = keyof typeof creditCosts;

export const operationLabels: Record<string, string> = {
  briefing: "Sales briefing",
  question: "AI question",
  conversation_text: "Conversation analysis",
  conversation_audio: "Conversation analysis (audio)",
  follow_up_draft: "Follow-up draft",
  lead_scoring: "Lead scoring",
  plan_allocation: "Plan allocation",
  period_refresh: "Monthly refresh",
  plan_change: "Plan change",
};

export const LOW_CREDIT_THRESHOLD = 0.15;
