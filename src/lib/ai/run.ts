import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getContext, type AppContext } from "@/lib/auth/context";
import { serverEnv } from "@/lib/env";
import { creditCosts, type CreditOperation } from "@/config/pricing";
import { AiNotConfiguredError, AiOutputError } from "@/lib/ai/gemini";

export type GuardResult =
  | { ok: true; ctx: AppContext }
  | { ok: false; response: NextResponse };

const fail = (status: number, error: string, code: string) =>
  ({ ok: false, response: NextResponse.json({ error, code }, { status }) }) as const;

/** Authenticate the caller and check the server is able to run AI + spend credits. */
export async function guardAi(): Promise<GuardResult> {
  const ctx = await getContext();
  if (!ctx) return fail(401, "Sign in to continue.", "unauthenticated");
  if (!serverEnv.geminiConfigured())
    return fail(503, "AI is not configured yet. An administrator must set GEMINI_API_KEY on the server.", "ai_not_configured");
  if (!serverEnv.serviceRoleConfigured())
    return fail(503, "Credit metering is not configured (SUPABASE_SERVICE_ROLE_KEY).", "metering_not_configured");
  return { ok: true, ctx };
}

/**
 * Spend credits atomically, run the AI work, and refund if it fails.
 * Credits are only ever spent for the caller's own (membership-verified) workspace.
 */
export async function withCredits<T>(
  ctx: AppContext,
  operation: CreditOperation,
  meta: Record<string, unknown>,
  work: () => Promise<T>,
  cost: number = creditCosts[operation],
): Promise<{ ok: true; value: T; cost: number } | { ok: false; response: NextResponse }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_credits", {
    _org: ctx.org.id,
    _user: ctx.user.id,
    _operation: operation,
    _amount: cost,
    _meta: meta,
  });
  if (error) return { ok: false, response: NextResponse.json({ error: "Could not reserve credits.", code: "credits_error" }, { status: 500 }) };
  if (!data?.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Not enough credits. This action needs ${cost}; ${data?.remaining ?? 0} remaining this period.`,
          code: "insufficient_credits",
        },
        { status: 402 },
      ),
    };
  }
  try {
    return { ok: true, value: await work(), cost };
  } catch (e) {
    await admin.rpc("refund_credits", {
      _org: ctx.org.id,
      _user: ctx.user.id,
      _operation: operation,
      _amount: cost,
      _meta: { reason: "failed", ...meta },
    });
    const message =
      e instanceof AiNotConfiguredError || e instanceof AiOutputError
        ? e.message
        : e instanceof Error
          ? e.message
          : "AI request failed.";
    console.error(`[ai:${operation}]`, message);
    return { ok: false, response: NextResponse.json({ error: `${message} Credits were refunded.`, code: "ai_failed" }, { status: 502 }) };
  }
}
