import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui";
import { serverEnv, supabaseConfigured } from "@/lib/env";
import { paymentLinkFor } from "@/config/pricing";

export const metadata: Metadata = { title: "Setup", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function Setup() {
  // Only visible while the app is unconfigured or in development.
  if (supabaseConfigured && process.env.NODE_ENV === "production") notFound();

  const rows: [string, boolean, string][] = [
    ["Supabase URL + anon key", supabaseConfigured, "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY — enables sign-in and all workspace data."],
    ["Supabase service-role key", serverEnv.serviceRoleConfigured(), "SUPABASE_SERVICE_ROLE_KEY — server-only; required to meter AI credits."],
    ["Gemini API key", serverEnv.geminiConfigured(), "GEMINI_API_KEY — server-only; required for briefings, questions and conversation analysis."],
    ["Starter payment link", !!paymentLinkFor("starter"), "STARTER_PAYMENT_LINK — https URL from your payment provider."],
    ["Pro payment link", !!paymentLinkFor("pro"), "PRO_PAYMENT_LINK — https URL from your payment provider."],
  ];
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Logo />
      <h1 className="display mt-10 text-5xl">Setup checklist</h1>
      <p className="mt-3 text-ink-soft">Copy <code>.env.example</code> to <code>.env.local</code>, fill in the values, run the SQL in <code>supabase/migrations</code>, and restart.</p>
      <ul className="mt-8 divide-y divide-line border-y border-ink">
        {rows.map(([name, ok, hint]) => (
          <li key={name} className="flex items-start justify-between gap-4 py-4">
            <div><div className="font-medium">{name}</div><div className="mt-1 text-sm text-muted">{hint}</div></div>
            <Badge tone={ok ? "good" : "warn"}>{ok ? "Configured" : "Missing"}</Badge>
          </li>
        ))}
      </ul>
    </main>
  );
}
