import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Get started" };

export default function Page() {
  return (
    <>
      <h1 className="display text-5xl">Get started</h1>
      <p className="mb-8 mt-3 text-ink-soft">Create your account, then set up a workspace for your team.</p>
      <Suspense><AuthForm mode="sign-up" /></Suspense>
    </>
  );
}
