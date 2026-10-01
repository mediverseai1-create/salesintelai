import Link from "next/link";
import { AskDemo } from "@/components/marketing/ask-demo";
import { RhythmTabs } from "@/components/marketing/rhythm-tabs";
import { BriefingMock, CtaPair, DeliverableCards, LoopDiagram, PricingCards, Section, SixGrid, TextLink } from "@/components/marketing/parts";

export default function Home() {
  return (
    <>
      <section className="border-b border-ink">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="fade-up">
            <div className="eyebrow mb-5">The AI revenue platform</div>
            <h1 className="display text-5xl sm:text-6xl lg:text-[4.6rem]">The system of record for revenue that reads itself.</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              SalesIntel AI unifies your pipeline, your calls and your follow-ups, then delivers the report, the strategy and the action plan your team needs, account by account, rep by rep, on the rhythm you set.
            </p>
            <div className="mt-8"><CtaPair /></div>
            <p className="mt-6 text-sm text-muted">Structured pipeline data · Call intelligence · Workspace-level security</p>
          </div>
          <div className="fade-up [animation-delay:120ms]"><BriefingMock /></div>
        </div>
      </section>

      <Section id="deliverables" eyebrow="Deliverables" title="Three things, every briefing. Written to be used, not filed.">
        <DeliverableCards />
        <p className="mt-6 text-sm text-ink-soft">See <TextLink href="/deliverables">what each deliverable contains</TextLink>.</p>
      </Section>

      <Section id="finds" eyebrow="What it looks for" title="Six things it finds in your data, every run." className="border-y border-ink bg-paper">
        <SixGrid />
        <p className="mt-6 text-sm text-ink-soft">When your data cannot support a finding, it says so instead of guessing. <TextLink href="/what-it-finds">Read how each finding works</TextLink>.</p>
      </Section>

      <Section id="rhythm" eyebrow="Rhythm" title="Set the cadence. The intelligence keeps pace.">
        <RhythmTabs />
      </Section>

      <Section id="ask" eyebrow="Ask in plain language" title="Ask the way you would say it out loud." tone="dark">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <p className="max-w-md text-lg leading-relaxed text-cream/80">
            Type a question about your pipeline, accounts or reps in normal words. The answer is built from your own records, with the figures it came from shown beside it.
          </p>
          <div className="text-ink"><AskDemo /></div>
        </div>
      </Section>

      <Section id="loop" eyebrow="One loop" title="Find. Prepare. Converse. Understand. Follow up. Close. Retain. Grow.">
        <p className="mb-10 max-w-2xl text-lg text-ink-soft">
          Every stage feeds the next automatically, so what your team learns on a call is still working for you when the deal renews.
        </p>
        <LoopDiagram />
      </Section>

      <Section id="pricing" eyebrow="Pricing" title="One platform. Credits for how much you use it." className="border-y border-ink bg-paper">
        <PricingCards />
        <p className="mt-6 text-sm text-ink-soft">Every plan includes every module; plans differ only in the monthly credit allowance. <TextLink href="/pricing">Pricing details</TextLink>.</p>
      </Section>

      <section className="bg-ink text-cream">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
          <h2 className="display max-w-4xl text-5xl md:text-7xl">Stop reading dashboards. Start working a plan.</h2>
          <div className="mt-10"><CtaPair dark /></div>
          <p className="mt-8 text-sm text-cream/60">Questions first? <Link href="/contact" className="underline underline-offset-4">Contact us</Link>.</p>
        </div>
      </section>
    </>
  );
}
