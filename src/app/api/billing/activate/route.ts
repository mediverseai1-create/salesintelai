import { NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

const Body = z.object({ org_id: z.string().uuid(), plan: z.enum(["free", "starter", "pro"]) });

/**
 * Operator endpoint: apply a plan after the payment provider has CONFIRMED payment.
 * The app never marks anything paid on its own — payment links are hosted by the provider.
 * Authenticate with:  Authorization: Bearer $BILLING_ADMIN_SECRET
 * (A provider webhook can be pointed here via a small relay once one is chosen.)
 */
export async function POST(req: Request) {
  const secret = process.env.BILLING_ADMIN_SECRET;
  if (!secret || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given), b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  const { error } = await createAdminClient().rpc("set_org_plan", { _org: body.data.org_id, _plan: body.data.plan });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
