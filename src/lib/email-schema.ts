import { z } from "zod";
import { validateEmailAddress } from "./email-address";

/** Limites adicionais de cada integração/coluna continuam explícitos. */
export function emailSchema(maxLength = 254) {
  return z
    .string()
    .superRefine((value, ctx) => {
      const r = validateEmailAddress(value);
      if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.message });
    })
    .transform((value) => {
      const r = validateEmailAddress(value);
      return r.ok ? r.value : value;
    })
    .pipe(z.string().max(maxLength));
}
