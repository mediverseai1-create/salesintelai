import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function Page() {
  return (
    <>
      <h1 className="display text-5xl">Choose a new password</h1>
      <p className="mb-8 mt-3 text-ink-soft">You are signed in through your reset link.</p>
      <Suspense><AuthForm mode="reset" /></Suspense>
    </>
  );
}
