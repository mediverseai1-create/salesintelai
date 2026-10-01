export const site = {
  name: "SalesIntel AI",
  domain: "salesintelai.digital",
  // Company details shown in the footer and legal pages. Override via environment.
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "SalesIntel AI",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@salesintelai.digital",
};

export const cadences = [
  { id: "daily", label: "Daily", days: 1, blurb: "Immediate changes, urgent risks, new opportunities and the actions due today." },
  { id: "weekly", label: "Weekly", days: 7, blurb: "Team performance, pipeline movement, coaching priorities and next actions." },
  { id: "biweekly", label: "Biweekly", days: 14, blurb: "Emerging patterns and changes in performance across a fortnight." },
  { id: "monthly", label: "Monthly", days: 30, blurb: "Broader trends: revenue movement, pipeline health and strategic priorities." },
  { id: "quarterly", label: "Quarterly", days: 91, blurb: "Strategic performance, progress against target and the major revenue patterns." },
  { id: "biannual", label: "Biannual", days: 182, blurb: "Larger organizational trends and the strategic shifts behind them." },
  { id: "annual", label: "Annual", days: 365, blurb: "Year-level performance, the patterns that held and next year's plan." },
] as const;

export type CadenceId = (typeof cadences)[number]["id"];

export const cadenceById = (id: string) => cadences.find((c) => c.id === id) ?? cadences[1];
