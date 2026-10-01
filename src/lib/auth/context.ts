import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { LOW_CREDIT_THRESHOLD } from "@/config/pricing";
import type { CreditStatus, Org, Role } from "@/lib/types";

export interface AppContext {
  supabase: SupabaseClient;
  user: User;
  profile: { id: string; email: string | null; full_name: string | null; job_title: string | null };
  org: Org;
  role: Role;
  canManage: boolean;
  isOwner: boolean;
}

/** Resolve the signed-in user and their workspace, or null (no redirects) — for route handlers. */
export const getContext = cache(async (): Promise<AppContext | null> => {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Join any workspace this verified email was invited to.
  await supabase.rpc("accept_pending_invites");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, created_at, organizations(id, name, cadence, plan_id, subscription_status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const first = memberships?.find((m) => m.organizations);
  if (!first) return null;
  const org = (Array.isArray(first.organizations) ? first.organizations[0] : first.organizations) as Org;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, job_title")
    .eq("id", user.id)
    .maybeSingle();

  const role = first.role as Role;
  return {
    supabase,
    user,
    profile: profile ?? { id: user.id, email: user.email ?? null, full_name: null, job_title: null },
    org,
    role,
    canManage: role === "owner" || role === "admin",
    isOwner: role === "owner",
  };
});

/** For pages: redirect to sign-in or onboarding when needed. */
export async function requireContext(): Promise<AppContext> {
  if (!supabaseConfigured) redirect("/setup");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const ctx = await getContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

export const getCredits = cache(async (): Promise<CreditStatus | null> => {
  const ctx = await getContext();
  if (!ctx) return null;
  await ctx.supabase.rpc("refresh_credits", { _org: ctx.org.id });
  const { data } = await ctx.supabase
    .from("credit_balances")
    .select("allocated, used, period_start, period_end")
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (!data) return null;
  const remaining = Math.max(data.allocated - data.used, 0);
  return {
    ...data,
    remaining,
    low: data.allocated > 0 ? remaining / data.allocated <= LOW_CREDIT_THRESHOLD : true,
  };
});
