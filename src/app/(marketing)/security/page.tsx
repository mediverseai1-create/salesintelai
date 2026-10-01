import type { Metadata } from "next";
import { PageIntro, Section } from "@/components/marketing/parts";

export const metadata: Metadata = { title: "Security" };

const controls = [
  ["Workspace isolation in the database", "Every business record belongs to a workspace and is protected by Postgres row-level security. Access control is enforced by the database, not by hiding things in the interface."],
  ["Role-based access", "Owners, admins and members use the same system with different levels of control. Billing and role changes are owner-only; imports, deletion and structure changes need an admin or owner. These rules are enforced in the database."],
  ["Authentication", "Sign-in, sessions and password reset use Supabase Auth. Signed-out visitors cannot reach the application."],
  ["Server-side AI calls", "AI requests are made from the server only. The AI provider key is never sent to the browser, and each request is built only from the signed-in user's own workspace."],
  ["Private file storage", "Uploaded imports and call recordings are stored in private buckets, scoped by workspace path, and are not publicly accessible."],
  ["Your data runs your workspace", "Uploaded files, calls and conversations are used to run your own workspace and nothing else. They are not used to train shared models."],
  ["Audit trail", "Key changes to actions, briefings, imports, conversations and team membership are recorded by the database in an activity log."],
  ["Validated input", "Uploads are checked for type and size, and every imported row is validated before it is stored."],
];

export default function Page() {
  return (
    <>
      <PageIntro eyebrow="Security" title="Access control that is not a front-end check." body="What we have implemented, described plainly." />
      <Section>
        <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
          {controls.map(([t, b]) => <div key={t} className="border-t border-ink pt-4"><dt className="text-lg font-semibold">{t}</dt><dd className="mt-2 text-sm leading-relaxed text-ink-soft">{b}</dd></div>)}
        </dl>
      </Section>
      <Section eyebrow="Good to know" className="border-t border-ink bg-paper">
        <div className="max-w-3xl space-y-4 text-ink-soft">
          <p>To generate briefings, answers and conversation analysis, relevant records from your workspace are sent to Google&apos;s Gemini API for processing. They are sent only when you run an AI action.</p>
          <p>We have not claimed any third-party certification or audit, and no system can promise zero risk or perfect accuracy. AI output can be wrong: it is built to show the figures behind each statement so your team can check it before acting.</p>
          <p>To report a security concern, use the address on the contact page.</p>
        </div>
      </Section>
    </>
  );
}
