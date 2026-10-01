import "server-only";
import { requireContext, getCredits } from "@/lib/auth/context";
import { loadWorkspaceData } from "@/lib/intel/load";
import { computeMetrics } from "@/lib/intel/metrics";
import { computeFindings } from "@/lib/intel/findings";
import { cadenceById } from "@/config/site";
import { serverEnv } from "@/lib/env";

/** Shared loader for pages that need the full computed workspace picture. */
export async function loadIntel() {
  const ctx = await requireContext();
  const data = await loadWorkspaceData(ctx.supabase, ctx.org.id);
  const cadence = cadenceById(ctx.org.cadence);
  const metrics = computeMetrics(data, cadence.days);
  const findings = computeFindings(metrics);
  return { ctx, data, metrics, findings, cadence };
}

export const aiReady = () => serverEnv.geminiConfigured() && serverEnv.serviceRoleConfigured();

export { getCredits };
