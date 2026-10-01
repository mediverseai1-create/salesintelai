"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { SignOutButton } from "@/components/auth-forms";
import { cn } from "@/lib/utils";

const nav: { group: string; items: [string, string][] }[] = [
  { group: "Understand", items: [["Overview", "/app"], ["Briefings", "/app/briefings"], ["Insights", "/app/insights"], ["AI Assistant", "/app/assistant"], ["Reports", "/app/reports"]] },
  { group: "Revenue", items: [["Pipeline", "/app/pipeline"], ["Accounts", "/app/accounts"], ["Leads", "/app/leads"], ["Conversations", "/app/conversations"]] },
  { group: "Act", items: [["Actions", "/app/actions"], ["Follow-Up AI", "/app/follow-ups"]] },
  { group: "Workspace", items: [["Team", "/app/team"], ["Data imports", "/app/imports"], ["Activity", "/app/activity"], ["Usage & billing", "/app/usage"], ["Settings", "/app/settings"]] },
];

interface Props {
  orgName: string; userName: string; role: string;
  credits: { remaining: number; allocated: number; low: boolean } | null;
  children: React.ReactNode;
}

export function AppShell({ orgName, userName, role, credits, children }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));
  const pctLeft = credits && credits.allocated > 0 ? Math.min(100, (credits.remaining / credits.allocated) * 100) : 0;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-cream/15 px-5 py-5">
        <LogoMark size={26} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{orgName}</div>
          <div className="text-xs capitalize text-cream/60">{role}</div>
        </div>
      </div>
      <nav aria-label="Application" className="scroll-thin flex-1 overflow-y-auto px-3 py-4">
        {nav.map((g) => (
          <div key={g.group} className="mb-5">
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cream/45">{g.group}</div>
            {g.items.map(([label, href]) => (
              <Link
                key={href} href={href} onClick={() => setOpen(false)}
                aria-current={active(href) ? "page" : undefined}
                className={cn("block rounded-sm px-2 py-1.5 text-sm", active(href) ? "bg-cream text-ink font-medium" : "text-cream/80 hover:bg-cream/10")}
              >
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      {credits && (
        <Link href="/app/usage" className="mx-3 mb-3 block border border-cream/20 p-3 text-xs hover:bg-cream/5">
          <div className="flex justify-between"><span className="text-cream/60">Credits left</span><span className={cn("tabular font-semibold", credits.low && "text-[#ff9a6c]")}>{credits.remaining.toLocaleString()}</span></div>
          <div className="mt-2 h-1 bg-cream/15"><div className={cn("h-1", credits.low ? "bg-[#ff9a6c]" : "bg-cream")} style={{ width: `${pctLeft}%` }} /></div>
          {credits.low && <div className="mt-2 text-[#ff9a6c]">Running low</div>}
        </Link>
      )}
      <div className="border-t border-cream/15 px-5 py-3 text-xs">
        <div className="truncate text-cream/70">{userName}</div>
        <SignOutButton className="mt-1 text-cream underline underline-offset-2 hover:text-accent" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-screen bg-ink text-cream lg:block">{sidebar}</aside>
      <div className="flex items-center justify-between border-b border-ink bg-ink px-4 py-3 text-cream lg:hidden">
        <div className="flex items-center gap-2.5"><LogoMark size={24} /><span className="max-w-[12rem] truncate text-sm font-semibold">{orgName}</span></div>
        <button onClick={() => setOpen(true)} className="border border-cream/40 px-3 py-1.5 text-sm" aria-expanded={open} aria-controls="mobile-nav">Menu</button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" id="mobile-nav" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-ink text-cream">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 z-10 px-2 text-sm text-cream/80">Close</button>
            {sidebar}
          </div>
        </div>
      )}
      <main className="min-w-0 px-4 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
