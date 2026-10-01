import type { Metadata } from "next";
import { CtaPair, LoopDiagram, PageIntro, Section } from "@/components/marketing/parts";
import { RhythmTabs } from "@/components/marketing/rhythm-tabs";

export const metadata: Metadata = { title: "How it works" };

const steps = [
  ["Upload", "Import pipeline, account, lead and activity exports as CSV files, or add call transcripts and recordings. Files are validated, mapped and previewed before anything is stored."],
  ["Read", "The platform calculates the figures from your records, then writes the narrative on top of those figures. Each statement is tied to the numbers behind it."],
  ["Brief", "On the rhythm you choose, it produces the report, the strategy and the action plan, and keeps every briefing in a searchable history."],
  ["Act", "Actions arrive as a queue with an account, an owner, a deadline and a definition of done. Your team works them to completion."],
  ["Learn", "Completed actions, new calls and new data feed the next briefing, which starts by checking what you decided last time."],
];

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="How it works" title="From exported data to a plan your team can work." body="No connectors to build and no dashboards to assemble. Bring the exports you already have." />
      <Section>
        <ol className="divide-y divide-ink border-y border-ink">
          {steps.map(([t, b], i) => (
            <li key={t} className="grid gap-3 py-8 md:grid-cols-[6rem_12rem_1fr] md:items-baseline">
              <span className="numeral text-5xl text-accent">0{i + 1}</span>
              <h3 className="text-xl font-semibold">{t}</h3>
              <p className="text-ink-soft">{b}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section eyebrow="The loop" title="Find. Prepare. Converse. Understand. Follow up. Close. Retain. Grow." className="border-y border-ink bg-paper">
        <LoopDiagram />
      </Section>
      <Section eyebrow="Rhythm" title="Set the cadence. The intelligence keeps pace."><RhythmTabs /></Section>
      <Section><CtaPair /></Section>
    </>
  );
}
