"use client";
import { useEffect, useState } from "react";
import { Illustrative } from "@/components/ui";

const QUESTION = "Which region is underperforming, and by how much?";

export function AskDemo() {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let i = 0;
    const t = setInterval(() => {
      i = reduce ? QUESTION.length : i + 1;
      setTyped(QUESTION.slice(0, i));
      if (i >= QUESTION.length) {
        clearInterval(t);
        setTimeout(() => setDone(true), reduce ? 0 : 350);
      }
    }, reduce ? 0 : 38);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="border border-ink bg-paper">
      <div className="flex items-center justify-between border-b border-ink px-5 py-3">
        <span className="eyebrow">Ask</span>
        <Illustrative />
      </div>
      <div className="px-5 py-6">
        <p className={`display text-2xl md:text-3xl ${done ? "" : "caret"}`} aria-label={QUESTION}>{typed}</p>
      </div>
      <div className={`border-t border-line px-5 py-6 transition-opacity duration-500 ${done ? "opacity-100" : "opacity-0"}`} aria-hidden={!done}>
        <p className="text-ink-soft">
          Region C is furthest behind: revenue of $212,000 is $88,000 (29%) below the previous period and has fallen two periods in a row, so this is a direction rather than a dip.
        </p>
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-2 font-semibold">Region</th><th className="py-2 text-right font-semibold">This period</th><th className="py-2 text-right font-semibold">Previous</th><th className="py-2 text-right font-semibold">Change</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {[["Region A", "$341,000", "$318,000", "+7%"], ["Region B", "$296,000", "$301,000", "−2%"], ["Region C", "$212,000", "$300,000", "−29%"]].map((r) => (
              <tr key={r[0]} className="border-t border-line">
                <td className="py-2">{r[0]}</td><td className="py-2 text-right">{r[1]}</td><td className="py-2 text-right">{r[2]}</td>
                <td className={`py-2 text-right font-semibold ${r[3].startsWith("−") && r[0] === "Region C" ? "text-bad" : ""}`}>{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-xs text-muted">Sample figures for demonstration only. In the product, every answer shows the figures from your own workspace.</p>
      </div>
    </div>
  );
}
