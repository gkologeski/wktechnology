import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { emailSchema } from "@/lib/email-schema";
export const complianceKeys = (action: string) =>
  ["workspace", "team", "own"].map((s) => `techhire.compliance.${action}.${s}`);
export const dsarStatusSchema = z.enum(["pending", "in_progress", "completed", "rejected"]);
export const createRequestSchema = z.object({
  candidate_id: z.string().uuid(),
  request_type: z.enum(["export", "erasure", "rectification", "access"]),
  subject_email: emailSchema().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export const consentSchema = z.object({
  candidate_id: z.string().uuid(),
  purpose: z.string().trim().min(1).max(2000),
  granted: z.boolean(),
  legal_basis: z.string().max(2000).nullable().optional(),
  source: z.string().trim().min(1).max(200).default("manual"),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});
/** Authenticated RPC only: fail on error or absent confirmation. */
export async function complianceRpc<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const rpc = client.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: { message: string } | null }>;
  const result = await rpc.call(client, name, args);
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("Operação LGPD não confirmada.");
  return result.data;
}
