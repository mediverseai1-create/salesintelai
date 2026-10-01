import type { Metadata } from "next";
import { CtaPair, PageIntro, Section, SixGrid } from "@/components/marketing/parts";

export const metadata: Metadata = { title: "What it finds" };

const how = [
  ["Trends and patterns", "Compares closed-won revenue in the reporting period with the period before, then ranks the regions, products and accounts that drove the change. Needs closed-won deals with close dates."],
  ["High-value opportunities", "Looks for customers who have only ever bought one product, products winning in one region and absent in another, and open deals with the highest weighted value."],
  ["Underperformance", "Flags regions, products and reps whose revenue is below the previous period, and marks whether it has fallen two periods running (a direction) or just one (a dip)."],
  ["Declining customers", "Finds repeat customers whose gaps between orders are lengthening, whose latest order is smaller than their norm, or who have stopped buying with nothing open."],
  ["Revenue at risk", "Measures customer and regional concentration, stalled and overdue open deals, and negative call sentiment on deals still open."],
  ["Room to grow", "Names the sales motions and segments with the strongest win rates and shows where they are under-used. Needs enough closed deals to compare."],
];

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="What it finds" title="Six things it finds in your data, every run." body="Each finding is calculated from the records in your workspace. If the data cannot support a finding, the briefing says which data is missing rather than filling the gap." />
      <Section><SixGrid /></Section>
      <Section eyebrow="How each one works" className="border-y border-ink bg-paper">
        <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
          {how.map(([t, b]) => (
            <div key={t} className="border-t border-ink pt-4"><dt className="text-lg font-semibold">{t}</dt><dd className="mt-2 text-sm leading-relaxed text-ink-soft">{b}</dd></div>
          ))}
        </dl>
      </Section>
      <Section><h2 className="display text-4xl md:text-5xl">Bring the data. Get the findings.</h2><div className="mt-8"><CtaPair /></div></Section>
    </>
  );
}
