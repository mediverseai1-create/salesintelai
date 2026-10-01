"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Notice, inputCls } from "@/components/ui";

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z.string().min(8, "Use at least 8 characters");

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/app");

type Mode = "sign-in" | "sign-up" | "forgot" | "reset";

const schemas = {
  "sign-in": z.object({ email, password: z.string().min(1, "Enter your password") }),
  "sign-up": z.object({ full_name: z.string().trim().min(2, "Enter your name"), email, password }),
  forgot: z.object({ email }),
  reset: z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" }),
};

type Values = { email: string; password: string; full_name: string; confirm: string };

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schemas[mode] as never) });

  async function onSubmit(v: Values) {
    setError(null); setInfo(null);
    const supabase = createClient();
    const origin = window.location.origin;
    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
      if (error) return setError(error.message);
      router.replace(safeNext(params.get("next"))); router.refresh();
    } else if (mode === "sign-up") {
      const { data, error } = await supabase.auth.signUp({
        email: v.email, password: v.password,
        options: { data: { full_name: v.full_name }, emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
      });
      if (error) return setError(error.message);
      if (data.session) { router.replace("/onboarding"); router.refresh(); }
      else setInfo("Check your email to confirm your address, then sign in. If you were invited to a workspace, you will join it automatically.");
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(v.email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
      if (error) return setError(error.message);
      setInfo("If an account exists for that address, a reset link is on its way.");
    } else {
      const { error } = await supabase.auth.updateUser({ password: v.password });
      if (error) return setError(error.message);
      router.replace("/app"); router.refresh();
    }
  }

  const label = { "sign-in": "Sign in", "sign-up": "Get started", forgot: "Send reset link", reset: "Set new password" }[mode];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {error && <Notice tone="bad">{error}</Notice>}
      {info && <Notice tone="good">{info}</Notice>}
      {mode === "sign-up" && (
        <Field label="Full name" error={errors.full_name?.message}>
          <input className={inputCls} autoComplete="name" {...register("full_name")} />
        </Field>
      )}
      {mode !== "reset" && (
        <Field label="Work email" error={errors.email?.message}>
          <input className={inputCls} type="email" autoComplete="email" {...register("email")} />
        </Field>
      )}
      {mode !== "forgot" && (
        <Field label={mode === "reset" ? "New password" : "Password"} error={errors.password?.message} hint={mode !== "sign-in" ? "At least 8 characters" : undefined}>
          <input className={inputCls} type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} {...register("password")} />
        </Field>
      )}
      {mode === "reset" && (
        <Field label="Confirm password" error={errors.confirm?.message}>
          <input className={inputCls} type="password" autoComplete="new-password" {...register("confirm")} />
        </Field>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>{isSubmitting ? "Please wait…" : label}</Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm text-ink-soft">
        {mode === "sign-in" && (<><Link href="/forgot-password" className="underline">Forgot password?</Link><Link href="/sign-up" className="underline">Create an account</Link></>)}
        {mode === "sign-up" && <Link href="/sign-in" className="underline">Already have an account? Sign in</Link>}
        {mode === "forgot" && <Link href="/sign-in" className="underline">Back to sign in</Link>}
      </div>
    </form>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      className={className}
      onClick={async () => { await createClient().auth.signOut(); router.replace("/"); router.refresh(); }}
    >
      Sign out
    </button>
  );
}
