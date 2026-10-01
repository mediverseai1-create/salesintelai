import type { Metadata } from "next";
import { AskDemo } from "@/components/marketing/ask-demo";
import { BriefingMock, CtaPair, DeliverableCards, PageIntro, Section } from "@/components/marketing/parts";

export const metadata: Metadata = { title: "Deliverables" };

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Deliverables" title="Three things, every briefing. Written to be used, not filed." />
      <Section><DeliverableCards /></Section>
      <Section eyebrow="An example" title="What a briefing looks like." className="border-y border-ink bg-paper">
        <BriefingMock />
      </Section>
      <Section eyebrow="Plus" title="Answers, on demand.">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4 text-ink-soft">
            <p>Ask a question in your own words and get an answer built from your records, with the supporting figures shown.</p>
            <p>Every briefing, strategy, action plan and answer is kept in a searchable history that the whole team can see.</p>
            <p>Next Best Actions turn the plan into a queue: reassign an owner, move a deadline, add notes and mark items done.</p>
          </div>
          <AskDemo />
        </div>
      </Section>
      <Section><CtaPair /></Section>
    </>
  );
}
