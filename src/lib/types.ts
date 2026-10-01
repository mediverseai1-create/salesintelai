export type Role = "owner" | "admin" | "member";

export interface Org {
  id: string;
  name: string;
  cadence: string;
  plan_id: string;
  subscription_status: string;
}

export interface Rep {
  id: string;
  name: string;
  email: string | null;
  region: string | null;
  user_id: string | null;
  active: boolean;
}

export interface Stage {
  id: string;
  name: string;
  position: number;
  kind: "open" | "won" | "lost";
  probability: number | null;
}

export interface Account {
  id: string;
  name: string;
  industry: string | null;
  region: string | null;
  size_band: string | null;
  website: string | null;
  status: "prospect" | "customer" | "dormant" | "churned";
  owner_rep_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  last_interaction_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Opportunity {
  id: string;
  account_id: string;
  name: string;
  amount: number;
  stage_id: string | null;
  status: "open" | "won" | "lost";
  probability: number | null;
  owner_rep_id: string | null;
  product: string | null;
  region: string | null;
  motion: string | null;
  expected_close_date: string | null;
  created_on: string;
  closed_at: string | null;
  last_activity_at: string | null;
  loss_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  industry: string | null;
  size_band: string | null;
  region: string | null;
  source: string | null;
  status: "new" | "contacted" | "qualified" | "unqualified" | "converted";
  owner_rep_id: string | null;
  account_id: string | null;
  score: number | null;
  score_reason: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

export interface Finding {
  id: string;
  conversation_id: string;
  summary: string | null;
  intent: string | null;
  sentiment: "positive" | "neutral" | "negative" | "mixed" | null;
  objections: string[];
  commitments: { owner?: string; text: string; due?: string | null }[];
  competitors: string[];
  decision_criteria: string[];
  risks: string[];
  next_action: string | null;
  follow_up_required: boolean;
  follow_up_by: string | null;
}

export interface Conversation {
  id: string;
  account_id: string | null;
  opportunity_id: string | null;
  lead_id: string | null;
  title: string;
  source_type: "transcript" | "audio" | "notes";
  content: string | null;
  file_path: string | null;
  occurred_at: string;
  status: "pending" | "analyzed" | "failed";
  error: string | null;
  created_at: string;
}

export interface ActionItem {
  id: string;
  briefing_id: string | null;
  account_id: string | null;
  opportunity_id: string | null;
  conversation_id: string | null;
  lead_id: string | null;
  title: string;
  description: string | null;
  reason: string | null;
  expected_outcome: string | null;
  definition_of_done: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "done" | "dismissed";
  owner_rep_id: string | null;
  due_date: string | null;
  source: "briefing" | "conversation" | "follow_up" | "manual" | "system";
  completed_at: string | null;
  created_at: string;
}

export interface CreditStatus {
  allocated: number;
  used: number;
  remaining: number;
  period_start: string;
  period_end: string;
  low: boolean;
}
