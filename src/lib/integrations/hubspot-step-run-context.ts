// Contexto compartilhado pelas etapas da importação do HubSpot.
// Cada etapa vive em seu próprio módulo (hubspot-step-<entidade>.server.ts) e
// recebe este contexto; o estado mutável (contadores, ids importados, pausa)
// fica em `st` para que o dispatcher continue responsável por persistir.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResumeState, Scope, StepName } from "./hubspot-steps-types";
import type { makeProgressBumper } from "./hubspot-steps-state.server";

export type StepRunState = {
  ok: number;
  fail: number;
  imported: string[];
  partial: boolean;
};

export type StepRunArgs = {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  jobId: string;
  itemId: string;
  step: StepName;
  scope: Scope;
  resume: ResumeState;
  st: StepRunState;
  isExpired: () => boolean;
  deadlineAt: number;
  bump: ReturnType<typeof makeProgressBumper>;
  persistCursor: (extra: Record<string, unknown>) => Promise<void>;
};
