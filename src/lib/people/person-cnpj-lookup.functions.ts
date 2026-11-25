import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lookupPersonCnpj } from "@/lib/people/person-cnpj-lookup.server";

/** Consulta pública de CNPJ para sugerir Razão Social e Nome Fantasia na ficha da pessoa PJ. */
export const lookupCnpjForPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().optional(), cnpj: z.string().max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    return lookupPersonCnpj(context.supabase, context.userId, data.cnpj, data.id);
  });
