"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cadences } from "@/config/site";
import { Button, Notice, selectCls } from "@/components/ui";

export function BriefingGenerator({ defaultCadence, aiReady, hasData, cost }: { defaultCadence: string; aiReady: boolean; hasData: boolean; cost: number }) {
  const router = useRouter();
  const [cadence, setCadence] = useState(defaultCadence);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = cadences.find((c) => c.id === cadence)!;

  async function run() {
    setBusy(true); setError(null);
    const res = await fetch("/api/briefings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cadence }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Could not generate the briefing.");
    router.push(`/app/briefings/${body.id}`); router.refresh();
  }

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">Reporting rhythm</span>
          <select className={`${selectCls} w-48`} value={cadence} onChange={(e) => setCadence(e.target.value)}>{cadences.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        </label>
        <Button size="lg" onClick={run} disabled={busy || !aiReady || !hasData}>{busy ? "Reading your data… up to a minute" : "Generate briefing"}</Button>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">{current.blurb} Compares the last {current.days} {current.days === 1 ? "day" : "days"} with the {current.days} before. Uses {cost} credits.</p>
      <div className="mt-4 space-y-3">
        {!hasData && <Notice tone="neutral">Import pipeline data before generating your first briefing.</Notice>}
        {!aiReady && <Notice tone="warn" title="AI is not configured">Set GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY on the server to enable briefings.</Notice>}
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </div>
  );
}
