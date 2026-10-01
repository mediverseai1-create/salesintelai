import type { Metadata } from "next";
import { PageIntro, Section } from "@/components/marketing/parts";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Contact" title="Talk to the team." body="Questions about the platform, your data or your plan are answered by email." />
      <Section>
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <div className="eyebrow mb-2">Email</div>
            <a href={`mailto:${site.contactEmail}`} className="display text-3xl underline decoration-accent decoration-2 underline-offset-8 md:text-4xl">{site.contactEmail}</a>
            <p className="mt-6 text-sm text-ink-soft">Include your workspace name and, for data questions, the type of file you are importing. Please do not email customer data or credentials.</p>
          </div>
          <div className="text-sm text-ink-soft">
            <div className="eyebrow mb-2">Company</div>
            <p>{site.companyName}</p>
            <p className="mt-1">{site.domain}</p>
          </div>
        </div>
      </Section>
    </>
  );
}
