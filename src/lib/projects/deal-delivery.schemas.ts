// Esquemas de entrada das funções de entrega do negócio (fora do *.functions.ts, que fica fino).
import { z } from "zod";

export const uuid = z.string().uuid();
export const note = z.string().trim().max(1000);
export const groupKey = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/);
export const pageInput = {
  page: z.number().int().min(1).max(10_000),
  pageSize: z.number().int().min(1).max(50),
};
export const origins = z.object({
  user: z.boolean(),
  system: z.boolean(),
  workflow: z.boolean(),
  import: z.boolean(),
});
export const pair = z.object({ dealId: uuid, projectId: uuid });
