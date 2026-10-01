import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { OnboardingForm } from "@/components/onboarding-form";
import { getContext } from "@/lib/auth/context";
import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function Page() {
  if (!supabaseConfigured) redirect("/setup");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (await getContext()) redirect("/app"); // already in a workspace (including via invite)
  return (
    <main className="mx-auto max-w-xl px-6 py-14">
      <Logo />
      <div className="eyebrow mb-3 mt-12">Step 1 of 1</div>
      <h1 className="display text-5xl">Set up your workspace.</h1>
      <p className="mb-8 mt-3 text-ink-soft">A workspace holds your pipeline, calls, briefings and team. Its data is isolated from every other workspace.</p>
      <OnboardingForm />
    </main>
  );
}
