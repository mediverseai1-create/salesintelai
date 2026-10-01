import { NextResponse } from "next/server";
import { guardAi, withCredits } from "@/lib/ai/run";
import { analyzeConversation } from "@/lib/ai/conversation";

export const maxDuration = 120;

/** Re-run analysis for a failed/pending text conversation. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardAi();
  if (!g.ok) return g.response;
  const { ctx } = g;
  const { id } = await params;

  const { data: conv } = await ctx.supabase
    .from("conversations")
    .select("id, title, account_id, opportunity_id, content, occurred_at, source_type, status")
    .eq("id", id).eq("org_id", ctx.org.id).maybeSingle();
  if (!conv) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (!conv.content) return NextResponse.json({ error: "No transcript text stored — upload the audio again to re-analyse." }, { status: 400 });

  const res = await withCredits(ctx, "conversation_text", { conversation_id: id }, () => analyzeConversation(ctx, conv));
  if (!res.ok) return res.response;
  return NextResponse.json({ id });
}
