import { NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@/lib/auth/context";
import type { EntityId } from "@/lib/import/entities";
import { processImport } from "@/lib/import/process";

export const maxDuration = 120;

const Body = z.object({ mapping: z.record(z.string(), z.string()) });

/** Steps 3-5 — Confirm: validate every row, store in Postgres, record the result. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (!ctx.canManage) return NextResponse.json({ error: "Only owners and admins can import data." }, { status: 403 });
  const { id } = await params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid mapping." }, { status: 400 });

  const { data: imp } = await ctx.supabase.from("imports").select("*").eq("id", id).eq("org_id", ctx.org.id).maybeSingle();
  if (!imp) return NextResponse.json({ error: "Import not found." }, { status: 404 });
  if (imp.status !== "uploaded") return NextResponse.json({ error: "This import has already been processed." }, { status: 409 });
  if (!imp.storage_path) return NextResponse.json({ error: "Import file is missing." }, { status: 400 });

  // Only accept columns that exist in the file.
  const headers = new Set<string>(imp.headers as string[]);
  const mapping = Object.fromEntries(Object.entries(body.data.mapping).filter(([, col]) => col === "" || headers.has(col)));

  await ctx.supabase.from("imports").update({ status: "processing", mapping }).eq("id", id);
  try {
    const file = await ctx.supabase.storage.from("imports").download(imp.storage_path);
    if (file.error || !file.data) throw new Error("Could not read the uploaded file.");
    const result = await processImport(ctx, id, imp.entity as EntityId, mapping, await file.data.text());
    await ctx.supabase.from("imports").update({
      status: "completed", imported_rows: result.imported, error_rows: result.errorRows, errors: result.errors, completed_at: new Date().toISOString(),
    }).eq("id", id);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed.";
    await ctx.supabase.from("imports").update({ status: "failed", errors: [{ row: 0, message }], completed_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

/** Undo an import: remove the records it created and the stored file. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (!ctx.canManage) return NextResponse.json({ error: "Only owners and admins can undo imports." }, { status: 403 });
  const { id } = await params;
  const { data: imp } = await ctx.supabase.from("imports").select("id, entity, storage_path").eq("id", id).eq("org_id", ctx.org.id).maybeSingle();
  if (!imp) return NextResponse.json({ error: "Import not found." }, { status: 404 });

  // Children first; accounts created by this import go last (composite FKs cascade/nullify the rest).
  for (const table of ["activities", "opportunities", "leads", "accounts"] as const) {
    const { error } = await ctx.supabase.from(table).delete().eq("org_id", ctx.org.id).eq("import_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (imp.storage_path) await ctx.supabase.storage.from("imports").remove([imp.storage_path]);
  await ctx.supabase.from("imports").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
