import { z } from "zod";
export const signerRole = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(80)
  .regex(/^[A-Z0-9_ -]+$/, "Use letras sem acentos, números, espaços ou hífen no papel.");
export const contractSignersSchema = z
  .array(
    z.object({
      role: signerRole,
      contactId: z.string().uuid(),
      cpf: z.string().trim().max(20).nullable().optional(),
    }),
  )
  .min(2)
  .max(20)
  .superRefine((items, ctx) => {
    if (!["CONTRATANTE", "CONTRATADO"].every((role) => items.some((s) => s.role === role)))
      ctx.addIssue({ code: "custom", message: "Selecione contratante e contratado." });
    if (
      new Set(items.map((s) => s.role)).size !== items.length ||
      new Set(items.map((s) => s.contactId)).size !== items.length
    )
      ctx.addIssue({ code: "custom", message: "Papéis e contatos devem ser distintos." });
  });
export type SignerContact = { id: string; name: string; email: string };
