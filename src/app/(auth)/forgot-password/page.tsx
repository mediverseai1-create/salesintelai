import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function Page() {
  return (
    <>
      <h1 className="display text-5xl">Reset your password</h1>
      <p className="mb-8 mt-3 text-ink-soft">Enter your email and we will send a reset link.</p>
      <Suspense><AuthForm mode="forgot" /></Suspense>
    </>
  );
}
