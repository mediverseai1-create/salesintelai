import type { Metadata } from "next";
import { CtaPair, PageIntro, Section } from "@/components/marketing/parts";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "About" };

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="About" title="Revenue teams should spend their time coaching, not assembling reports." />
      <Section>
        <div className="grid gap-10 md:grid-cols-2">
          <div className="space-y-5 text-lg leading-relaxed text-ink-soft">
            <p>Dashboards show the numbers. They rarely say what matters, why it happened, or what to do on Monday morning. Managers end up spending that morning building reports from spreadsheets, CRM exports and call notes.</p>
            <p>{site.name} reads that material for you and returns three things on the rhythm you choose: a report of what happened, a strategy built from your own wins, and an action plan with owners, deadlines and a definition of done.</p>
          </div>
          <div className="space-y-5 text-ink-soft">
            <h2 className="display text-3xl text-ink">How we approach it</h2>
            <ul className="space-y-3">
              <li className="border-t border-line pt-3"><strong className="text-ink">Figures first.</strong> Every statement is tied to numbers calculated from your records.</li>
              <li className="border-t border-line pt-3"><strong className="text-ink">Honest about gaps.</strong> When the data is not enough, it says what is missing.</li>
              <li className="border-t border-line pt-3"><strong className="text-ink">The team decides.</strong> The system reads, remembers and writes; people review and choose.</li>
            </ul>
          </div>
        </div>
      </Section>
      <Section><CtaPair /></Section>
    </>
  );
}
