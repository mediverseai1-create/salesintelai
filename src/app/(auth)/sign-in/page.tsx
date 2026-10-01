import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <>
      <h1 className="display text-5xl">Sign in</h1>
      <p className="mb-8 mt-3 text-ink-soft">Pick up where your team left off.</p>
      <Suspense><AuthForm mode="sign-in" /></Suspense>
    </>
  );
}
