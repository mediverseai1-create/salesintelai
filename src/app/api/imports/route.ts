import { NextResponse } from "next/server";
import { getContext } from "@/lib/auth/context";
import { entities, suggestMapping, type EntityId } from "@/lib/import/entities";
import { MAX_FILE, MAX_ROWS, parseCsv } from "@/lib/import/process";

/** Step 1 — Upload & validate: store the file in private Storage, parse server-side, return headers + preview. */
export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (!ctx.canManage) return NextResponse.json({ error: "Only owners and admins can import data." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const entity = form?.get("entity") as EntityId | null;
  if (!(file instanceof File) || !entity || !(entity in entities))
    return NextResponse.json({ error: "Choose a data type and a CSV file." }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "tsv", "txt"].includes(ext ?? "")) return NextResponse.json({ error: "Upload a .csv file." }, { status: 415 });
  if (file.size === 0) return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  if (file.size > MAX_FILE) return NextResponse.json({ error: "Files are limited to 10 MB." }, { status: 413 });

  const text = await file.text();
  const { headers, rows, parseErrors } = parseCsv(text);
  if (!headers.length || !rows.length) return NextResponse.json({ error: "No header row or data rows found in this file." }, { status: 400 });
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Files are limited to ${MAX_ROWS.toLocaleString()} rows. Split the file and import in parts.` }, { status: 413 });

  const { data: imp, error } = await ctx.supabase
    .from("imports")
    .insert({ org_id: ctx.org.id, entity, filename: file.name.slice(0, 200), status: "uploaded", total_rows: rows.length, headers, created_by: ctx.user.id })
    .select("id").single();
  if (error || !imp) return NextResponse.json({ error: error?.message ?? "Could not start the import." }, { status: 500 });

  const path = `${ctx.org.id}/${imp.id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const up = await ctx.supabase.storage.from("imports").upload(path, text, { contentType: "text/csv" });
  if (up.error) {
    await ctx.supabase.from("imports").delete().eq("id", imp.id);
    return NextResponse.json({ error: "Could not store the file securely. Try again." }, { status: 500 });
  }
  await ctx.supabase.from("imports").update({ storage_path: path }).eq("id", imp.id);

  return NextResponse.json({
    id: imp.id, headers, total: rows.length, preview: rows.slice(0, 8),
    mapping: suggestMapping(entity, headers), warnings: parseErrors.map((e) => e.message),
  });
}
