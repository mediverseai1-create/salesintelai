import { Logo } from "@/components/logo";
import { Notice } from "@/components/ui";
import { supabaseConfigured } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden flex-col justify-between bg-ink p-12 text-cream lg:flex">
        <Logo className="[&_span]:text-cream" />
        <div>
          <p className="display text-5xl">Stop reading dashboards. Start working a plan.</p>
          <p className="mt-6 max-w-md text-cream/70">The report, the strategy and the action plan your team needs, on the rhythm you set.</p>
        </div>
        <p className="text-xs text-cream/50">Workspace data is isolated at the database level.</p>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 md:px-16">
        <div className="mx-auto w-full max-w-md">
          <Logo className="mb-10 lg:hidden" />
          {!supabaseConfigured && (
            <div className="mb-6"><Notice tone="warn" title="Authentication is not configured">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart. See the setup page.</Notice></div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
