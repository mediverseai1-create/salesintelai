import Link from "next/link";
import { cn } from "@/lib/utils";

/** Three ascending bars (revenue) with a single precise point above the tallest (the read). */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" fill="var(--ink)" />
      <rect x="6" y="19" width="5" height="7" fill="var(--cream)" />
      <rect x="13.5" y="14" width="5" height="12" fill="var(--cream)" />
      <rect x="21" y="9" width="5" height="17" fill="var(--cream)" />
      <circle cx="23.5" cy="5.5" r="2.2" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="SalesIntel AI home">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">
        SalesIntel<span className="text-accent"> AI</span>
      </span>
    </Link>
  );
}
