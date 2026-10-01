"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHeader, Notice, Table, selectCls, td, th } from "@/components/ui";
import { entities, type EntityId } from "@/lib/import/entities";

interface Upload { id: string; headers: string[]; total: number; preview: Record<string, string>[]; mapping: Record<string, string>; warnings: string[] }
interface Result { total: number; imported: number; errorRows: number; errors: { row: number; message: string }[] }

export function ImportWizard() {
  const router = useRouter();
  const [entity, setEntity] = useState<EntityId>("opportunities");
  const [up, setUp] = useState<Upload | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<"upload" | "confirm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const def = entities[entity];
  const missing = def.fields.filter((f) => f.required && !mapping[f.key]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("entity", entity);
    setBusy("upload"); setError(null); setResult(null);
    const res = await fetch("/api/imports", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body.error ?? "Upload failed.");
    setUp(body); setMapping(body.mapping); router.refresh();
  }

  async function confirm() {
    if (!up) return;
    setBusy("confirm"); setError(null);
    const res = await fetch(`/api/imports/${up.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mapping }) });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(body.error ?? "Import failed."); return; }
    setResult(body); setUp(null); router.refresh();
  }

  const reset = () => { setUp(null); setResult(null); setError(null); };

  return (
    <Card>
      <CardHeader title="Import data" sub="Upload → map columns → preview → confirm. The file is validated and stored on the server before anything is analysed." />
      <div className="space-y-6 p-5">
        {error && <Notice tone="bad">{error}</Notice>}
        {result && (
          <Notice tone={result.errorRows ? "warn" : "good"} title={`Imported ${result.imported.toLocaleString()} of ${result.total.toLocaleString()} rows`}>
            {result.errorRows ? `${result.errorRows} rows were skipped.` : "All rows imported."} Your Overview, Pipeline and Insights now reflect this data.
            {result.errors.length > 0 && <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-auto pl-5 text-xs">{result.errors.slice(0, 40).map((x, i) => <li key={i}>Row {x.row}: {x.message}</li>)}</ul>}
            <div className="mt-3"><Button size="sm" variant="secondary" onClick={reset}>Import another file</Button></div>
          </Notice>
        )}
        {!up && !result && (
          <form onSubmit={upload} className="grid gap-4 md:grid-cols-[14rem_1fr_auto] md:items-end">
            <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">What are you importing?</span>
              <select className={selectCls} value={entity} onChange={(e) => setEntity(e.target.value as EntityId)}>{(Object.keys(entities) as EntityId[]).map((k) => <option key={k} value={k}>{entities[k].label}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">CSV file (up to 10 MB / 20,000 rows)</span>
              <input name="file" type="file" required accept=".csv,.tsv,.txt,text/csv" className={`${selectCls} pt-1.5`} /></label>
            <Button type="submit" disabled={busy === "upload"}>{busy === "upload" ? "Uploading…" : "Upload & validate"}</Button>
            <p className="text-sm text-ink-soft md:col-span-3">{def.blurb} Expected columns include: {def.fields.filter((f) => f.required).map((f) => <strong key={f.key}>{f.label}</strong>).reduce<React.ReactNode[]>((a, n, i) => (i ? [...a, ", ", n] : [n]), [])} (required) and {def.fields.filter((f) => !f.required).slice(0, 5).map((f) => f.label).join(", ")}…. Re-importing the same file adds the records again; use “Undo” in the history to remove an import.</p>
          </form>
        )}
        {up && (
          <>
            <Notice tone="neutral" title={`${up.total.toLocaleString()} rows found`}>Match each field to a column in your file. Required fields are marked. Unmatched optional fields are simply left empty.</Notice>
            {up.warnings.length > 0 && <Notice tone="warn">{up.warnings.join(" · ")}</Notice>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {def.fields.map((f) => (
                <label key={f.key} className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">{f.label}{f.required && <span className="text-accent"> *</span>}</span>
                  <select className={selectCls} value={mapping[f.key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}><option value="">— not mapped —</option>{up.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select>
                  {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}</label>
              ))}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Preview (first {up.preview.length} rows, as they will be read)</h3>
              <div className="border border-line"><Table>
                <thead><tr>{def.fields.filter((f) => mapping[f.key]).map((f) => <th key={f.key} className={th}>{f.label}</th>)}</tr></thead>
                <tbody>{up.preview.map((row, i) => <tr key={i}>{def.fields.filter((f) => mapping[f.key]).map((f) => <td key={f.key} className={td}>{row[mapping[f.key]] || <span className="text-muted">—</span>}</td>)}</tr>)}</tbody></Table></div>
            </div>
            {missing.length > 0 && <Notice tone="warn">Map the required field{missing.length > 1 ? "s" : ""}: {missing.map((m) => m.label).join(", ")}.</Notice>}
            <div className="flex gap-3"><Button onClick={confirm} disabled={busy === "confirm" || missing.length > 0}>{busy === "confirm" ? "Importing…" : `Confirm import of ${up.total.toLocaleString()} rows`}</Button><Button variant="ghost" onClick={reset}>Cancel</Button></div>
          </>
        )}
      </div>
    </Card>
  );
}

export function UndoImport({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <Button size="sm" variant="danger" disabled={busy} onClick={async () => {
    if (!confirm("Remove every record created by this import? Records you've edited since will also be removed.")) return;
    setBusy(true);
    const res = await fetch(`/api/imports/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh(); else alert((await res.json().catch(() => ({}))).error ?? "Could not undo.");
  }}>Undo</Button>;
}

export const importStatusTone = { uploaded: "neutral", processing: "accent", completed: "good", failed: "bad" } as const;
export { Badge };
