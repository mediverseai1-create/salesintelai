import type { Metadata } from "next";
import { PageIntro, PricingCards, Section } from "@/components/marketing/parts";

export const metadata: Metadata = { title: "Pricing" };

const faqs = [
  ["What is a credit?", "Briefings, questions, conversation analysis, follow-up drafts and lead scoring each draw from your monthly credit allowance. The usage page in your workspace shows what every run cost."],
  ["Do credits roll over?", "Credits refresh at the start of each billing cycle."],
  ["Is anything limited besides credits?", "Historical data and team members are not limited on any plan."],
  ["How do I pay?", "Paid plans are purchased through a secure payment link. Your plan changes once the payment provider confirms payment."],
];

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Pricing" title="One platform. Credits for how much you use it." body="Every plan includes every module. The only difference is the monthly credit allowance." />
      <Section><PricingCards /></Section>
      <Section eyebrow="Questions" className="border-t border-ink bg-paper">
        <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
          {faqs.map(([q, a]) => <div key={q} className="border-t border-ink pt-4"><dt className="font-semibold">{q}</dt><dd className="mt-2 text-sm text-ink-soft">{a}</dd></div>)}
        </dl>
      </Section>
    </>
  );
}
