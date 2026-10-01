import Link from "next/link";
import { cn } from "@/lib/utils";

type BtnProps = {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  href?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">;

const btnBase =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const btnVariants = {
  primary: "bg-accent text-white hover:bg-accent-ink border border-accent",
  secondary: "bg-transparent text-ink border border-ink hover:bg-ink hover:text-cream",
  ghost: "bg-transparent text-ink-soft hover:bg-ink/5 border border-transparent",
  danger: "bg-transparent text-bad border border-bad/40 hover:bg-bad-wash",
};
const btnSizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };

export function Button({ variant = "primary", size = "md", className, href, children, ...rest }: BtnProps) {
  const cls = cn(btnBase, btnVariants[variant], btnSizes[size], "rounded-sm", className);
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button className={cls} {...rest}>{children}</button>;
}

export const inputCls =
  "w-full h-10 rounded-sm border border-line-strong bg-paper px-3 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none disabled:opacity-60";
export const selectCls = inputCls;
export const textareaCls = cn(inputCls, "h-auto py-2 min-h-24");

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-sm border border-line bg-paper", className)}>{children}</section>;
}

export function CardHeader({ title, aside, sub }: { title: string; aside?: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {aside}
    </div>
  );
}

const tones = {
  neutral: "bg-ink/5 text-ink-soft",
  accent: "bg-accent-wash text-accent-ink",
  good: "bg-good-wash text-good",
  bad: "bg-bad-wash text-bad",
  warn: "bg-warn-wash text-warn",
};
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="numeral mt-1 text-4xl leading-none tabular">{value}</div>
      {sub && <div className={cn("mt-2 text-xs", tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-muted")}>{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-5">
      <div className="min-w-0">
        <h1 className="display text-4xl md:text-5xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-sm text-ink-soft">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-dashed border-line-strong bg-paper/60 px-6 py-12 text-center">
      <h3 className="display text-2xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{body}</p>
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "warn", title, children }: { tone?: "warn" | "bad" | "good" | "neutral"; title?: string; children: React.ReactNode }) {
  const map = { warn: "border-warn/40 bg-warn-wash text-warn", bad: "border-bad/40 bg-bad-wash text-bad", good: "border-good/40 bg-good-wash text-good", neutral: "border-line-strong bg-paper text-ink-soft" };
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("rounded-sm border px-4 py-3 text-sm", map[tone])}>
      {title && <div className="font-semibold">{title}</div>}
      <div className={title ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("scroll-thin overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
export const th = "px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted border-b border-line whitespace-nowrap";
export const td = "px-4 py-3 border-b border-line align-top";

export function Illustrative() {
  return <span className="rounded-sm border border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">Illustrative</span>;
}
