"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { cadences } from "@/config/site";
import { Button, Field, Notice, inputCls, selectCls } from "@/components/ui";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your organization's name").max(120),
  cadence: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "biannual", "annual"]),
});
type V = z.infer<typeof schema>;

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<V>({
    resolver: zodResolver(schema), defaultValues: { cadence: "weekly" },
  });

  async function onSubmit(v: V) {
    setError(null);
    const { error } = await createClient().rpc("create_organization", { _name: v.name, _cadence: v.cadence });
    if (error) return setError(error.message);
    router.replace("/app"); router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {error && <Notice tone="bad">{error}</Notice>}
      <Field label="Organization name" error={errors.name?.message}>
        <input className={inputCls} autoComplete="organization" {...register("name")} />
      </Field>
      <Field label="Reporting rhythm" hint="How often you want a briefing. You can change this any time in Settings.">
        <select className={selectCls} {...register("cadence")}>
          {cadences.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Creating…" : "Create workspace"}</Button>
    </form>
  );
}
