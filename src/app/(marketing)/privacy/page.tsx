import type { Metadata } from "next";
import { PageIntro, Section } from "@/components/marketing/parts";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Privacy" };

const blocks: [string, string][] = [
  ["What we collect", "Account details you provide (name, email, job title); workspace content you upload or create (pipeline, accounts, leads, conversations, transcripts, recordings, actions); and usage records such as credit usage and an activity log of changes within your workspace."],
  ["How we use it", "To operate your workspace: store and display your data, generate briefings, answers and conversation analysis on request, meter credits, and keep the service secure. Your uploaded files, calls and conversations are used to run your own workspace and nothing else. They are not used to train shared models."],
  ["AI processing", "When you run an AI action, the relevant records from your workspace are sent from our servers to Google's Gemini API to produce the result. Records from other workspaces are never included."],
  ["Who can see it", "Members of your workspace, according to their role. We do not sell personal data. Service providers that host or process data on our behalf include our database and authentication provider (Supabase), our hosting provider and the AI provider named above."],
  ["Retention and deletion", "Data stays in your workspace until you delete it. Owners and admins can undo imports and delete records. To request deletion of your account or workspace, email us."],
  ["Your responsibilities", "Only upload data you have the right to use, including recordings of calls where the people on them have been told and, where required, have consented."],
  ["Contact", `Questions about this policy: ${site.contactEmail}.`],
];

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Privacy" title="Privacy policy" body="Plain-language summary of how workspace data is handled." />
      <Section>
        <div className="max-w-3xl space-y-8">
          {blocks.map(([t, b]) => <div key={t}><h2 className="text-xl font-semibold">{t}</h2><p className="mt-2 text-ink-soft">{b}</p></div>)}
          <p className="text-sm text-muted">Last updated: October 2026. This policy should be reviewed by counsel before relying on it for a specific jurisdiction.</p>
        </div>
      </Section>
    </>
  );
}
