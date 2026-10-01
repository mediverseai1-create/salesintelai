"use client";
import { useState } from "react";
import { cadences } from "@/config/site";
import { cn } from "@/lib/utils";

export function RhythmTabs() {
  const [active, setActive] = useState<string>("weekly");
  const current = cadences.find((c) => c.id === active)!;
  return (
    <div>
      <div role="tablist" aria-label="Reporting rhythm" className="scroll-thin -mx-4 flex gap-0 overflow-x-auto border-b border-ink px-4 md:mx-0 md:px-0">
        {cadences.map((c) => (
          <button
            key={c.id}
            role="tab"
            id={`tab-${c.id}`}
            aria-selected={active === c.id}
            aria-controls="rhythm-panel"
            onClick={() => setActive(c.id)}
            className={cn(
              "shrink-0 border-b-4 px-4 py-3 text-sm font-medium transition-colors md:px-5",
              active === c.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div id="rhythm-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="grid gap-6 py-10 md:grid-cols-[auto_1fr] md:items-end md:gap-12">
        <div className="numeral text-7xl leading-none md:text-8xl">{current.days}<span className="text-2xl text-muted md:text-3xl"> {current.days === 1 ? "day" : "days"}</span></div>
        <div>
          <h3 className="display text-3xl">{current.label} briefing</h3>
          <p className="mt-2 max-w-xl text-ink-soft">{current.blurb}</p>
          <p className="mt-3 text-sm text-muted">Each run compares the period against the one before it.</p>
        </div>
      </div>
    </div>
  );
}
