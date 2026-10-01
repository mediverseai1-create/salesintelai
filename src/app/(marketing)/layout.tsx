import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";
import { site } from "@/config/site";

const links = [
  ["What it finds", "/what-it-finds"],
  ["How it works", "/how-it-works"],
  ["Deliverables", "/deliverables"],
  ["Pricing", "/pricing"],
] as const;

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
            {links.map(([label, href]) => (
              <Link key={href} href={href} className="text-sm font-medium text-ink-soft hover:text-ink">{label}</Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <Button href="/sign-in" variant="secondary" size="sm">Sign in</Button>
            <Button href="/sign-up" size="sm">Get started</Button>
          </div>
          <details className="group relative lg:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center border border-ink px-3 text-sm font-medium">
              Menu
            </summary>
            <div className="absolute right-0 top-12 w-64 border border-ink bg-cream p-4 shadow-[6px_6px_0_0_var(--ink)]">
              <nav aria-label="Mobile" className="flex flex-col gap-3">
                {links.map(([label, href]) => (
                  <Link key={href} href={href} className="py-1 text-sm font-medium">{label}</Link>
                ))}
              </nav>
              <div className="mt-4 flex gap-2 border-t border-line pt-4">
                <Button href="/sign-in" variant="secondary" size="sm" className="flex-1">Sign in</Button>
                <Button href="/sign-up" size="sm" className="flex-1">Get started</Button>
              </div>
            </div>
          </details>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink bg-ink text-cream">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
          <div>
            <div className="text-lg font-semibold">{site.name}</div>
            <p className="mt-3 max-w-xs text-sm text-cream/70">The system of record for revenue that reads itself.</p>
            <a href={`mailto:${site.contactEmail}`} className="mt-5 inline-block text-sm underline underline-offset-4">{site.contactEmail}</a>
          </div>
          <nav aria-label="Product" className="flex flex-col gap-2 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-cream/50">Product</div>
            {links.map(([label, href]) => <Link key={href} href={href} className="text-cream/80 hover:text-cream">{label}</Link>)}
            <Link href="/about" className="text-cream/80 hover:text-cream">About</Link>
            <Link href="/contact" className="text-cream/80 hover:text-cream">Contact</Link>
          </nav>
          <nav aria-label="Legal" className="flex flex-col gap-2 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-cream/50">Trust</div>
            <Link href="/security" className="text-cream/80 hover:text-cream">Security</Link>
            <Link href="/privacy" className="text-cream/80 hover:text-cream">Privacy</Link>
            <Link href="/terms" className="text-cream/80 hover:text-cream">Terms</Link>
          </nav>
        </div>
        <div className="border-t border-cream/15 px-4 py-5 text-center text-xs text-cream/60">
          © {new Date().getFullYear()} {site.companyName}. All rights reserved.
        </div>
      </footer>
    </>
  );
}
