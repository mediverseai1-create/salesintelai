import Link from "next/link";
import { Button, Illustrative } from "@/components/ui";
import { plans } from "@/config/pricing";
import { deliverables, loopStages, sixFindings } from "@/config/content";
import { cn } from "@/lib/utils";

export function Section({ id, eyebrow, title, children, className, tone }: { id?: string; eyebrow?: string; title?: React.ReactNode; children: React.ReactNode; className?: string; tone?: "dark" }) {
  return (
    <section id={id} className={cn(tone === "dark" ? "bg-ink text-cream" : "", className)}>
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        {eyebrow && <div className={cn("eyebrow mb-4", tone === "dark" && "text-accent")}>{eyebrow}</div>}
        {title && <h2 className="display max-w-3xl text-4xl md:text-6xl">{title}</h2>}
        <div className={title ? "mt-10 md:mt-14" : ""}>{children}</div>
      </div>
    </section>
  );
}

export function CtaPair({ dark }: { dark?: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button href="/sign-up" size="lg">Get started</Button>
      <Button href="/sign-in" size="lg" variant="secondary" className={dark ? "border-cream text-cream hover:bg-cream hover:text-ink" : ""}>Sign in</Button>
    </div>
  );
}

export function SixGrid() {
  return (
    <div className="grid border-l border-t border-ink md:grid-cols-2 lg:grid-cols-3">
      {sixFindings.map((f) => (
        <article key={f.n} className="border-b border-r border-ink p-6 md:p-8">
          <div className="numeral text-6xl text-accent">{f.n}</div>
          <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
        </article>
      ))}
    </div>
  );
}

export function DeliverableCards() {
  return (
    <div className="grid gap-px border border-ink bg-ink lg:grid-cols-3">
      {deliverables.map((d, i) => (
        <article key={d.name} className="bg-paper p-6 md:p-8">
          <div className="numeral text-5xl text-accent">0{i + 1}</div>
          <h3 className="display mt-3 text-4xl">{d.name}</h3>
          <p className="mt-3 text-ink-soft">{d.lead}</p>
          <ul className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
            {d.points.map((p) => (
              <li key={p} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 bg-accent" />{p}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export function LoopDiagram() {
  return (
    <ol className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
      {loopStages.map(([name, body], i) => (
        <li key={name} className="relative border-b border-r border-line p-5">
          <div className="flex items-center gap-3">
            <span className="numeral text-3xl text-accent">{i + 1}</span>
            <span className="text-lg font-semibold">{name}</span>
          </div>
          <p className="mt-2 text-sm text-ink-soft">{body}</p>
          <span aria-hidden className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center border border-line bg-cream text-xs lg:flex">
            {i % 4 === 3 ? "↵" : "→"}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function PricingCards({ highlight = "starter" }: { highlight?: string }) {
  return (
    <div className="grid gap-px border border-ink bg-ink md:grid-cols-3">
      {plans.map((p) => (
        <article key={p.id} className={cn("flex flex-col bg-paper p-6 md:p-8", p.id === highlight && "bg-cream")}>
          <h3 className="text-lg font-semibold">{p.name}</h3>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="numeral text-6xl">${p.priceUsd}</span>
            <span className="text-sm text-muted">/ month</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-accent-ink">{p.monthlyCredits.toLocaleString()} credits each month</div>
          <p className="mt-4 text-sm text-ink-soft">{p.blurb}</p>
          <ul className="mt-5 flex-1 space-y-2 border-t border-line pt-5 text-sm">
            {p.points.map((x) => <li key={x} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 bg-accent" />{x}</li>)}
          </ul>
          <Button href="/sign-up" className="mt-8" variant={p.id === highlight ? "primary" : "secondary"}>Get started</Button>
        </article>
      ))}
    </div>
  );
}

/** Dashboard-style briefing mock. Clearly labelled; not customer data. */
export function BriefingMock() {
  const bars = [38, 44, 41, 52, 49, 58, 63, 57, 69, 74, 71, 82];
  return (
    <div className="border border-ink bg-paper shadow-[8px_8px_0_0_var(--ink)]" aria-label="Illustrative weekly briefing">
      <div className="flex items-center justify-between border-b border-ink px-5 py-3">
        <div className="flex items-center gap-3"><span className="eyebrow">Weekly briefing</span><span className="hidden text-xs text-muted sm:inline">Mon – Sun</span></div>
        <Illustrative />
      </div>
      <div className="grid md:grid-cols-[1.1fr_1fr]">
        <div className="border-b border-line p-5 md:border-b-0 md:border-r">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Report</div>
          <div className="mt-2 flex items-baseline gap-3"><span className="numeral text-6xl">$1.2M</span><span className="text-sm font-semibold text-bad">−8% vs last week</span></div>
          <p className="mt-3 text-sm text-ink-soft">Closed-won revenue fell as two large deals slipped past their expected close dates. Pipeline created held steady.</p>
          <div className="mt-5 flex h-20 items-end gap-1" aria-hidden>
            {bars.map((b, i) => <div key={i} className={i === bars.length - 1 ? "w-full bg-accent" : "w-full bg-ink/80"} style={{ height: `${b}%` }} />)}
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Strategy</div>
          <p className="mt-2 text-sm">Put effort into the mid-market referral motion, which converted 2.4× the outbound rate this quarter.</p>
          <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">Action plan</div>
          <ul className="mt-2 divide-y divide-line text-sm">
            {[["Re-engage Account 14", "Rep A", "Thu"], ["Send revised quote to Account 07", "Rep C", "Fri"], ["Call Account 22: orders slowing", "Rep B", "Mon"]].map(([a, o, d]) => (
              <li key={a} className="flex items-start justify-between gap-3 py-2"><span>{a}</span><span className="shrink-0 text-xs text-muted">{o} · {d}</span></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line px-5 py-2 text-xs text-muted">Sample figures for demonstration only — not customer results.</div>
    </div>
  );
}

export function PageIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="border-b border-ink">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <div className="eyebrow mb-4">{eyebrow}</div>
        <h1 className="display max-w-4xl text-5xl md:text-7xl">{title}</h1>
        {body && <p className="mt-6 max-w-2xl text-lg text-ink-soft">{body}</p>}
      </div>
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-ink">{children}</Link>;
}
