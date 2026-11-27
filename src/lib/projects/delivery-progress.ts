import { z } from "zod";

export const PROGRESS_VALIDATION_MESSAGE =
  "Informe a evolução entre 0 e 100, com até 2 casas decimais.";

export const progressPctSchema = z
  .number({ message: PROGRESS_VALIDATION_MESSAGE })
  .finite({ message: PROGRESS_VALIDATION_MESSAGE })
  .min(0, { message: PROGRESS_VALIDATION_MESSAGE })
  .max(100, { message: PROGRESS_VALIDATION_MESSAGE })
  .refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, {
    message: PROGRESS_VALIDATION_MESSAGE,
  })
  .transform((value) => Math.round(value * 100) / 100);

export const checkpointInputSchema = z.object({
  projectId: z.string().uuid({ message: "Projeto inválido." }),
  title: z.string().trim().min(1, { message: "Informe o título do acompanhamento." }),
  summary: z.string().nullable().optional(),
  health: z.enum(["green", "yellow", "red"]).nullable().optional(),
  progressPct: progressPctSchema.nullable().optional(),
  expectedDeliveryDate: z.string().nullable().optional(),
  visibility: z.enum(["internal", "commercial"]).default("commercial"),
});

export const checkpointPatchInputSchema = checkpointInputSchema
  .partial({ projectId: true, title: true, visibility: true })
  .extend({ id: z.string().uuid({ message: "Acompanhamento inválido." }) });

export type CheckpointInput = z.infer<typeof checkpointInputSchema>;
export type CheckpointPatchInput = z.infer<typeof checkpointPatchInputSchema>;

export function parseCheckpointInput(input: unknown): CheckpointInput {
  const parsed = checkpointInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados do acompanhamento inválidos.");
  }
  return parsed.data;
}

export function parseCheckpointPatchInput(input: unknown): CheckpointPatchInput {
  const parsed = checkpointPatchInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados do acompanhamento inválidos.");
  }
  return parsed.data;
}

export function parseProgressInput(
  raw: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };

  const normalized = trimmed.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, error: PROGRESS_VALIDATION_MESSAGE };
  }

  const decimalPart = normalized.split(".")[1];
  if (decimalPart && decimalPart.length > 2) {
    return { ok: false, error: PROGRESS_VALIDATION_MESSAGE };
  }

  const parsed = progressPctSchema.safeParse(Number(normalized));
  if (!parsed.success) {
    return { ok: false, error: PROGRESS_VALIDATION_MESSAGE };
  }
  return { ok: true, value: parsed.data };
}

const ptBrProgressFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatProgressPct(value: number): string {
  return ptBrProgressFormatter.format(value);
}

export function formatProgressInputValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return formatProgressPct(value);
}

export function normalizeProgressValue(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}
