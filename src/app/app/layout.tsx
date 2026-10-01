import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getCredits, requireContext } from "@/lib/auth/context";

export const metadata: Metadata = { title: { default: "Workspace", template: "%s · SalesIntel AI" }, robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const credits = await getCredits();
  return (
    <AppShell
      orgName={ctx.org.name}
      userName={ctx.profile.full_name || ctx.profile.email || "Account"}
      role={ctx.role}
      credits={credits ? { remaining: credits.remaining, allocated: credits.allocated, low: credits.low } : null}
    >
      {children}
    </AppShell>
  );
}
