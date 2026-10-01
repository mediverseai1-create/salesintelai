export type EntityId = "opportunities" | "accounts" | "leads" | "activities";

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
  hint?: string;
}

export const entities: Record<EntityId, { label: string; blurb: string; fields: FieldDef[] }> = {
  opportunities: {
    label: "Opportunities",
    blurb: "Deals with value, stage and dates. Closed-won deals become revenue; accounts and owners are created automatically if new.",
    fields: [
      { key: "name", label: "Opportunity name", aliases: ["opportunity", "opportunity name", "deal", "deal name", "name"] },
      { key: "account", label: "Account", required: true, aliases: ["account", "account name", "company", "customer", "client"] },
      { key: "amount", label: "Amount", required: true, aliases: ["amount", "value", "deal value", "revenue", "deal amount", "arr", "price"] },
      { key: "stage", label: "Stage", aliases: ["stage", "deal stage", "pipeline stage", "status"] },
      { key: "probability", label: "Probability %", aliases: ["probability", "prob", "win probability", "likelihood"] },
      { key: "owner", label: "Owner (rep)", aliases: ["owner", "rep", "sales rep", "account owner", "assigned to", "salesperson"] },
      { key: "product", label: "Product", aliases: ["product", "product name", "service", "line of business"] },
      { key: "region", label: "Region", aliases: ["region", "territory", "geo", "country", "market"] },
      { key: "motion", label: "Sales motion / source", aliases: ["motion", "sales motion", "source", "lead source", "channel", "type"] },
      { key: "industry", label: "Account industry", aliases: ["industry", "sector", "vertical"] },
      { key: "created_on", label: "Created date", aliases: ["created", "created date", "create date", "created on", "open date"] },
      { key: "expected_close_date", label: "Expected close date", aliases: ["expected close", "expected close date", "close date expected", "forecast close"] },
      { key: "closed_at", label: "Closed date", aliases: ["closed", "closed date", "close date", "won date", "closed at"] },
      { key: "last_activity_at", label: "Last activity date", aliases: ["last activity", "last activity date", "last contacted", "last touch"] },
      { key: "loss_reason", label: "Loss reason", aliases: ["loss reason", "lost reason", "reason lost"] },
    ],
  },
  accounts: {
    label: "Accounts",
    blurb: "Customers and prospects. Existing accounts with the same name are updated.",
    fields: [
      { key: "name", label: "Account name", required: true, aliases: ["account", "account name", "company", "name", "customer", "client"] },
      { key: "industry", label: "Industry", aliases: ["industry", "sector", "vertical"] },
      { key: "region", label: "Region", aliases: ["region", "territory", "country", "geo"] },
      { key: "size_band", label: "Company size", aliases: ["size", "company size", "employees", "size band", "headcount"] },
      { key: "website", label: "Website", aliases: ["website", "url", "domain"] },
      { key: "status", label: "Status", aliases: ["status", "account status", "type"], hint: "prospect, customer, dormant or churned" },
      { key: "owner", label: "Owner (rep)", aliases: ["owner", "rep", "account owner", "sales rep"] },
      { key: "contact_name", label: "Contact name", aliases: ["contact", "contact name", "primary contact"] },
      { key: "contact_email", label: "Contact email", aliases: ["email", "contact email", "primary email"] },
      { key: "last_interaction_at", label: "Last interaction date", aliases: ["last interaction", "last contacted", "last activity", "last touch"] },
      { key: "notes", label: "Notes", aliases: ["notes", "description", "comments"] },
    ],
  },
  leads: {
    label: "Leads",
    blurb: "Structured lead records you already have. No external lead data is added.",
    fields: [
      { key: "name", label: "Lead name", required: true, aliases: ["name", "lead", "lead name", "full name", "contact"] },
      { key: "company", label: "Company", aliases: ["company", "account", "organization", "organisation"] },
      { key: "email", label: "Email", aliases: ["email", "email address"] },
      { key: "phone", label: "Phone", aliases: ["phone", "phone number", "mobile"] },
      { key: "title", label: "Job title", aliases: ["title", "job title", "role", "position"] },
      { key: "industry", label: "Industry", aliases: ["industry", "sector"] },
      { key: "size_band", label: "Company size", aliases: ["size", "company size", "employees"] },
      { key: "region", label: "Region", aliases: ["region", "country", "territory"] },
      { key: "source", label: "Source", aliases: ["source", "lead source", "channel"] },
      { key: "status", label: "Status", aliases: ["status", "lead status"], hint: "new, contacted, qualified, unqualified or converted" },
      { key: "owner", label: "Owner (rep)", aliases: ["owner", "rep", "assigned to"] },
      { key: "last_contacted_at", label: "Last contacted date", aliases: ["last contacted", "last contact", "last activity"] },
      { key: "notes", label: "Notes", aliases: ["notes", "comments", "description"] },
    ],
  },
  activities: {
    label: "Activities",
    blurb: "Calls, emails and meetings logged against accounts. They update last-interaction dates.",
    fields: [
      { key: "account", label: "Account", required: true, aliases: ["account", "account name", "company", "customer"] },
      { key: "occurred_at", label: "Date", required: true, aliases: ["date", "occurred", "occurred at", "activity date", "when"] },
      { key: "kind", label: "Type", aliases: ["type", "kind", "activity type"], hint: "call, email, meeting, note" },
      { key: "subject", label: "Subject", aliases: ["subject", "title", "description", "summary"] },
      { key: "owner", label: "Owner (rep)", aliases: ["owner", "rep", "user", "assigned to"] },
    ],
  },
};

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Suggest a column mapping: field key -> CSV header (or ""). */
export function suggestMapping(entity: EntityId, headers: string[]): Record<string, string> {
  const used = new Set<string>();
  const out: Record<string, string> = {};
  for (const f of entities[entity].fields) {
    const exact = headers.find((h) => !used.has(h) && f.aliases.includes(clean(h)));
    const loose = exact ?? headers.find((h) => !used.has(h) && f.aliases.some((a) => clean(h).includes(a) && a.length > 3));
    if (loose) { out[f.key] = loose; used.add(loose); } else out[f.key] = "";
  }
  return out;
}

export function parseMoney(v: string | undefined): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (!/\d/.test(s)) return null;
  const neg = /^\(.*\)$/.test(s);
  let n = Number(s.replace(/[^0-9.,-]/g, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (/k$/i.test(s)) n *= 1000;
  if (/m$/i.test(s)) n *= 1_000_000;
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

export function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const us = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  let d: Date;
  if (us) {
    const y = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
    d = new Date(Date.UTC(y, Number(us[1]) - 1, Number(us[2])));
  } else d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1990 || y > 2100) return null;
  return d.toISOString();
}

export const dayOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
