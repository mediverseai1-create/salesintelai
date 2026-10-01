import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAi, withCredits } from "@/lib/ai/run";
import { analyzeConversation } from "@/lib/ai/conversation";
import { creditCosts } from "@/config/pricing";

export const maxDuration = 120;

const MAX_AUDIO = 15 * 1024 * 1024;
const MAX_TEXT = 200_000;
const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mp3", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", flac: "audio/flac",
};
const TEXT_EXT = ["txt", "md", "vtt", "srt", "csv"];

const Meta = z.object({
  title: z.string().trim().min(2).max(160),
  account_id: z.string().uuid().nullable(),
  opportunity_id: z.string().uuid().nullable(),
  occurred_at: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date"),
  text: z.string().max(MAX_TEXT).optional(),
});

export async function POST(req: Request) {
  const g = await guardAi();
  if (!g.ok) return g.response;
  const { ctx } = g;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  const meta = Meta.safeParse({
    title: form.get("title"),
    account_id: (form.get("account_id") as string) || null,
    opportunity_id: (form.get("opportunity_id") as string) || null,
    occurred_at: (form.get("occurred_at") as string) || new Date().toISOString(),
    text: (form.get("text") as string) || undefined,
  });
  if (!meta.success) return NextResponse.json({ error: meta.error.issues[0]?.message ?? "Invalid details." }, { status: 400 });

  const file = form.get("file");
  let text = meta.data.text?.trim() ?? "";
  let audio: { mimeType: string; base64: string } | undefined;
  let storagePath: string | null = null;
  let sourceType: "transcript" | "audio" | "notes" = text ? "notes" : "transcript";

  if (file instanceof File && file.size > 0) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (AUDIO_TYPES[ext]) {
      if (file.size > MAX_AUDIO) return NextResponse.json({ error: "Audio files are limited to 15 MB." }, { status: 413 });
      const buf = Buffer.from(await file.arrayBuffer());
      audio = { mimeType: AUDIO_TYPES[ext], base64: buf.toString("base64") };
      sourceType = "audio";
    } else if (TEXT_EXT.includes(ext)) {
      if (file.size > MAX_TEXT) return NextResponse.json({ error: "Transcript files are limited to 200 KB." }, { status: 413 });
      text = (await file.text()).trim();
      sourceType = "transcript";
    } else {
      return NextResponse.json({ error: `Unsupported file type .${ext}. Use ${TEXT_EXT.join(", ")} or ${Object.keys(AUDIO_TYPES).join(", ")}.` }, { status: 415 });
    }
  }
  if (!text && !audio) return NextResponse.json({ error: "Paste a transcript or upload a file." }, { status: 400 });

  // RLS makes these lookups fail if the ids belong to another workspace.
  for (const [table, id] of [["accounts", meta.data.account_id], ["opportunities", meta.data.opportunity_id]] as const) {
    if (!id) continue;
    const { data } = await ctx.supabase.from(table).select("id").eq("id", id).eq("org_id", ctx.org.id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Linked record not found in this workspace." }, { status: 400 });
  }

  const { data: conv, error } = await ctx.supabase.from("conversations").insert({
    org_id: ctx.org.id, title: meta.data.title, account_id: meta.data.account_id, opportunity_id: meta.data.opportunity_id,
    source_type: sourceType, content: text || null, occurred_at: new Date(meta.data.occurred_at).toISOString(),
    status: "pending", uploaded_by: ctx.user.id,
  }).select("id, title, account_id, opportunity_id, content, occurred_at").single();
  if (error || !conv) return NextResponse.json({ error: error?.message ?? "Could not save the conversation." }, { status: 500 });

  if (audio && file instanceof File) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    storagePath = `${ctx.org.id}/${conv.id}/${safe}`;
    const up = await ctx.supabase.storage.from("conversations").upload(storagePath, file, { contentType: audio.mimeType });
    if (!up.error) await ctx.supabase.from("conversations").update({ file_path: storagePath }).eq("id", conv.id);
  }

  const op = audio ? "conversation_audio" : "conversation_text";
  const res = await withCredits(ctx, op, { conversation_id: conv.id }, () => analyzeConversation(ctx, conv, audio), creditCosts[op]);
  if (!res.ok) {
    await ctx.supabase.from("conversations").update({ status: "failed", error: "Analysis did not complete. You can retry from the conversation page." }).eq("id", conv.id);
    const body = await res.response.json();
    return NextResponse.json({ ...body, id: conv.id }, { status: res.response.status });
  }
  return NextResponse.json({ id: conv.id });
}
