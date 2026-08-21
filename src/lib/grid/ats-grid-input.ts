// Entrada comum das listagens do TechHire para projeção/ordenação dinâmica.
// Módulo client-safe: usado tanto nas telas quanto nos validadores das
// server functions.
import { z } from "zod";

export type AtsGridInput = {
  /** Colunas extras escolhidas pelo usuário no editor de colunas. */
  extraColumns?: string[];
  /** Coluna de ordenação salva na preferência do usuário. */
  sortKey?: string | null;
  sortDir?: "asc" | "desc" | null;
};

export const atsGridInputSchema = z.object({
  extraColumns: z.array(z.string().min(1).max(128)).max(80).optional(),
  sortKey: z.string().min(1).max(128).nullish(),
  sortDir: z.enum(["asc", "desc"]).nullish(),
});
