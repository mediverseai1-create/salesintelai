import Link from "next/link";
import { AskDemo } from "@/components/marketing/ask-demo";
import { RhythmTabs } from "@/components/marketing/rhythm-tabs";
import { CtaPair, DeliverableCards, LoopDiagram, PricingCards, Section, SixGrid, TextLink } from "@/components/marketing/parts";

export default function Home() {
  return (
    <>
      <section className="border-b border-ink">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-16 md:px-8 md:pb-16 md:pt-28">
          <div className="fade-up">
            <div className="eyebrow mb-6 flex items-center gap-3"><span className="h-px w-10 bg-accent" />The AI revenue platform</div>
            <h1 className="display max-w-5xl text-[2.9rem] leading-[0.98] sm:text-7xl lg:text-[6.5rem]">
              The AI sales partner that turns your data <em className="text-accent not-italic">into revenue.</em>
            </h1>
            <div className="mt-10 grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-end">
              <p className="max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
                SalesIntel AI unifies your pipeline, your calls and your follow-ups, then delivers the report, the strategy and the action plan your team needs, account by account, rep by rep, on the rhythm you set.
              </p>
              <div>
                <CtaPair />
                <p className="mt-5 text-sm text-muted">Structured pipeline data · Call intelligence · Workspace-level security</p>
              </div>
            </div>
          </div>
        </div>
        <ol className="mx-auto grid max-w-6xl border-t border-ink md:grid-cols-3">
          {[["01", "Report", "What happened, with the figures behind it."], ["02", "Strategy", "Where to put effort, built from your own wins."], ["03", "Action plan", "Accounts, owners, deadlines, definition of done."]].map(([n, t, d], i) => (
            <li key={n} className={`flex items-baseline gap-4 px-4 py-5 md:px-8 ${i ? "border-t border-line md:border-l md:border-t-0" : ""}`}>
              <span className="numeral text-3xl text-accent">{n}</span>
              <div><div className="font-semibold">{t}</div><div className="text-sm text-ink-soft">{d}</div></div>
            </li>
          ))}
        </ol>
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
