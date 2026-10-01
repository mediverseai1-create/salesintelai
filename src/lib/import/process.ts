import "server-only";
import Papa from "papaparse";
import type { AppContext } from "@/lib/auth/context";
import { dayOnly, entities, parseDate, parseMoney, type EntityId } from "@/lib/import/entities";

export const MAX_ROWS = 20000;
export const MAX_FILE = 10 * 1024 * 1024;

export function parseCsv(text: string) {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  return { headers: (res.meta.fields ?? []).filter(Boolean), rows: res.data, parseErrors: res.errors.slice(0, 5) };
}

interface RowError { row: number; message: string }
const chunk = <T,>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const lc = (s: string) => s.trim().toLowerCase();
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate -> map -> store. Runs on the server against the file kept in Storage. */
export async function processImport(ctx: AppContext, importId: string, entity: EntityId, mapping: Record<string, string>, text: string) {
  const sb = ctx.supabase;
  const org = ctx.org.id;
  const { rows } = parseCsv(text);
  if (rows.length > MAX_ROWS) throw new Error(`Files are limited to ${MAX_ROWS.toLocaleString()} rows.`);

  const def = entities[entity];
  const missing = def.fields.filter((f) => f.required && !mapping[f.key]);
  if (missing.length) throw new Error(`Map the required column(s): ${missing.map((m) => m.label).join(", ")}.`);

  const get = (row: Record<string, string>, key: string) => {
    const col = mapping[key];
    return col ? (row[col] ?? "").toString().trim() : "";
  };

  // Existing lookup tables
  const [{ data: reps }, { data: accts }, { data: stages }] = await Promise.all([
    sb.from("sales_reps").select("id, name").eq("org_id", org),
    sb.from("accounts").select("id, name").eq("org_id", org),
    sb.from("pipeline_stages").select("id, name, kind, position").eq("org_id", org),
  ]);
  const repMap = new Map((reps ?? []).map((r) => [lc(r.name), r.id as string]));
  const acctMap = new Map((accts ?? []).map((a) => [lc(a.name), a.id as string]));
  const stageMap = new Map((stages ?? []).map((s) => [lc(s.name), s]));
  let maxPos = Math.max(0, ...(stages ?? []).map((s) => s.position));

  const errors: RowError[] = [];
  const bad = new Set<number>();
  const fail = (i: number, message: string) => { bad.add(i); if (errors.length < 200) errors.push({ row: i + 2, message }); };

  const ensureReps = async (names: string[]) => {
    const fresh = [...new Set(names.filter(Boolean).filter((n) => !repMap.has(lc(n))))];
    for (const part of chunk(fresh)) {
      const { data } = await sb.from("sales_reps").insert(part.map((name) => ({ org_id: org, name }))).select("id, name");
      data?.forEach((r) => repMap.set(lc(r.name), r.id));
    }
  };
  const ensureAccounts = async (names: string[], extra: Map<string, Record<string, unknown>> = new Map()) => {
    const fresh = [...new Set(names.filter(Boolean).filter((n) => !acctMap.has(lc(n))))];
    for (const part of chunk(fresh)) {
      const { data } = await sb.from("accounts").insert(part.map((name) => ({ org_id: org, name, import_id: importId, ...(extra.get(lc(name)) ?? {}) }))).select("id, name");
      data?.forEach((a) => acctMap.set(lc(a.name), a.id));
    }
  };
  const resolveStage = async (name: string) => {
    if (!name) return null;
    const hit = stageMap.get(lc(name));
    if (hit) return hit.id as string;
    const kind = /won|closed.?won|signed/i.test(name) ? "won" : /lost|closed.?lost|dead/i.test(name) ? "lost" : "open";
    const { data } = await sb.from("pipeline_stages").insert({ org_id: org, name, position: ++maxPos, kind, probability: kind === "won" ? 100 : kind === "lost" ? 0 : null }).select("id, name, kind, position").single();
    if (data) { stageMap.set(lc(name), data); return data.id as string; }
    return null;
  };

  let imported = 0;

  if (entity === "opportunities") {
    await ensureReps(rows.map((r) => get(r, "owner")));
    const extra = new Map<string, Record<string, unknown>>();
    rows.forEach((r) => { const a = get(r, "account"), ind = get(r, "industry"), reg = get(r, "region"); if (a && !extra.has(lc(a))) extra.set(lc(a), { industry: ind || null, region: reg || null }); });
    await ensureAccounts(rows.map((r) => get(r, "account")), extra);
    const records: Record<string, unknown>[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const account = get(r, "account");
      if (!account) { fail(i, "Missing account"); continue; }
      const amount = parseMoney(get(r, "amount"));
      if (amount == null || amount < 0) { fail(i, `Invalid amount "${get(r, "amount")}"`); continue; }
      const prob = get(r, "probability") ? Number(get(r, "probability").replace("%", "")) : null;
      if (prob != null && (Number.isNaN(prob) || prob < 0 || prob > 100)) { fail(i, `Invalid probability "${get(r, "probability")}"`); continue; }
      const stageName = get(r, "stage");
      const stageId = await resolveStage(stageName);
      const owner = get(r, "owner");
      const created = dayOnly(parseDate(get(r, "created_on")));
      records.push({
        org_id: org, account_id: acctMap.get(lc(account)), name: get(r, "name") || `${account} opportunity`, amount,
        stage_id: stageId, probability: prob == null ? null : Math.round(prob),
        owner_rep_id: owner ? repMap.get(lc(owner)) ?? null : null,
        product: get(r, "product") || null, region: get(r, "region") || null, motion: get(r, "motion") || null,
        ...(created ? { created_on: created } : {}),
        expected_close_date: dayOnly(parseDate(get(r, "expected_close_date"))),
        closed_at: dayOnly(parseDate(get(r, "closed_at"))),
        last_activity_at: parseDate(get(r, "last_activity_at")),
        loss_reason: get(r, "loss_reason") || null, import_id: importId,
      });
    }
    for (const part of chunk(records)) {
      const { error } = await sb.from("opportunities").insert(part);
      if (error) throw new Error(error.message);
      imported += part.length;
    }
    // Keep account last-interaction fresh from imported activity dates
    const latest = new Map<string, string>();
    records.forEach((rec) => { const d = (rec.last_activity_at as string) ?? null; const id = rec.account_id as string; if (d && (!latest.get(id) || d > latest.get(id)!)) latest.set(id, d); });
    for (const [id, d] of latest) await sb.from("accounts").update({ last_interaction_at: d }).eq("id", id).is("last_interaction_at", null);
  }

  if (entity === "accounts") {
    await ensureReps(rows.map((r) => get(r, "owner")));
    const statuses = ["prospect", "customer", "dormant", "churned"];
    const records: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = get(r, "name");
      if (!name) { fail(i, "Missing account name"); continue; }
      if (seen.has(lc(name))) { fail(i, `Duplicate account "${name}" in file`); continue; }
      seen.add(lc(name));
      const status = lc(get(r, "status"));
      const email = get(r, "contact_email");
      if (email && !emailRe.test(email)) { fail(i, `Invalid email "${email}"`); continue; }
      const owner = get(r, "owner");
      const existing = acctMap.get(lc(name));
      records.push({
        ...(existing ? { id: existing } : {}), org_id: org, name,
        industry: get(r, "industry") || null, region: get(r, "region") || null, size_band: get(r, "size_band") || null,
        website: get(r, "website") || null, ...(statuses.includes(status) ? { status } : {}),
        owner_rep_id: owner ? repMap.get(lc(owner)) ?? null : null,
        contact_name: get(r, "contact_name") || null, contact_email: email || null,
        last_interaction_at: parseDate(get(r, "last_interaction_at")), notes: get(r, "notes") || null,
        ...(existing ? {} : { import_id: importId }),
      });
    }
    for (const part of chunk(records)) {
      const inserts = part.filter((p) => !p.id), updates = part.filter((p) => p.id);
      if (inserts.length) { const { error } = await sb.from("accounts").insert(inserts); if (error) throw new Error(error.message); }
      if (updates.length) { const { error } = await sb.from("accounts").upsert(updates, { onConflict: "id" }); if (error) throw new Error(error.message); }
      imported += part.length;
    }
  }

  if (entity === "leads") {
    await ensureReps(rows.map((r) => get(r, "owner")));
    const statuses = ["new", "contacted", "qualified", "unqualified", "converted"];
    const records: Record<string, unknown>[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = get(r, "name");
      if (!name) { fail(i, "Missing lead name"); continue; }
      const email = get(r, "email");
      if (email && !emailRe.test(email)) { fail(i, `Invalid email "${email}"`); continue; }
      const status = lc(get(r, "status")), owner = get(r, "owner"), company = get(r, "company");
      records.push({
        org_id: org, name, company: company || null, email: email || null, phone: get(r, "phone") || null, title: get(r, "title") || null,
        industry: get(r, "industry") || null, size_band: get(r, "size_band") || null, region: get(r, "region") || null, source: get(r, "source") || null,
        status: statuses.includes(status) ? status : "new", owner_rep_id: owner ? repMap.get(lc(owner)) ?? null : null,
        account_id: company ? acctMap.get(lc(company)) ?? null : null,
        last_contacted_at: parseDate(get(r, "last_contacted_at")), notes: get(r, "notes") || null, import_id: importId,
      });
    }
    for (const part of chunk(records)) {
      const { error } = await sb.from("leads").insert(part);
      if (error) throw new Error(error.message);
      imported += part.length;
    }
  }

  if (entity === "activities") {
    await ensureReps(rows.map((r) => get(r, "owner")));
    const kinds = ["call", "email", "meeting", "note", "other"];
    const records: Record<string, unknown>[] = [];
    const latest = new Map<string, string>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const account = get(r, "account");
      const accountId = account ? acctMap.get(lc(account)) : undefined;
      if (!accountId) { fail(i, `Unknown account "${account}" — import accounts or opportunities first`); continue; }
      const when = parseDate(get(r, "occurred_at"));
      if (!when) { fail(i, `Invalid date "${get(r, "occurred_at")}"`); continue; }
      const kind = lc(get(r, "kind")), owner = get(r, "owner");
      records.push({ org_id: org, account_id: accountId, kind: kinds.includes(kind) ? kind : "other", subject: get(r, "subject") || null, occurred_at: when, rep_id: owner ? repMap.get(lc(owner)) ?? null : null, import_id: importId });
      if (!latest.get(accountId) || when > latest.get(accountId)!) latest.set(accountId, when);
    }
    for (const part of chunk(records)) {
      const { error } = await sb.from("activities").insert(part);
      if (error) throw new Error(error.message);
      imported += part.length;
    }
    for (const [id, d] of latest) await sb.from("accounts").update({ last_interaction_at: d }).eq("id", id).or(`last_interaction_at.is.null,last_interaction_at.lt.${d}`);
  }

  return { total: rows.length, imported, errorRows: bad.size, errors };
}
