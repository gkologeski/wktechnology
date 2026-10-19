// Esquemas de entrada do importador Clockify (fora do *.functions.ts por causa do code-splitting).
import { z } from "zod";

export const clockifyEntitySchema = z.enum(["user", "client", "project"]);
export const clockifyIdSchema = z.string().regex(/^[0-9a-f]{24}$/i);
