import { z } from "zod";
import { FIELD_LIBRARY } from "@/lib/surveys/form-schema";

const TYPES = FIELD_LIBRARY.map((f) => f.type) as [string, ...string[]];
const OptionZ = z.object({
  id: z.string().min(1).max(80),
  label: z.string().max(300),
  points: z.number().nullable().optional(),
});
const RuleZ = z.object({
  fieldId: z.string().min(1).max(80),
  op: z.enum(["equals", "not_equals", "contains", "not_contains", "filled", "empty", "gt", "lt"]),
  value: z.string().max(300).optional(),
});
export const FieldZ = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(TYPES),
  label: z.string().max(500),
  description: z.string().max(2000).optional(),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().optional(),
  scored: z.boolean().optional(),
  weight: z.number().min(0).max(1000).optional(),
  options: z.array(OptionZ).max(100).optional(),
  rows: z.array(OptionZ).max(50).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLabel: z.string().max(80).optional(),
  maxLabel: z.string().max(80).optional(),
  maxLength: z.number().int().min(1).max(10000).optional(),
  stars: z.number().int().min(3).max(10).optional(),
  width: z.enum(["full", "half"]).optional(),
  showIf: z
    .object({ mode: z.enum(["all", "any"]), rules: z.array(RuleZ).max(20) })
    .nullable()
    .optional(),
  source: z
    .object({
      page: z.number().optional(),
      excerpt: z.string().max(600).optional(),
      confidence: z.enum(["alta", "baixa"]).optional(),
    })
    .optional(),
});
export const FormSchemaZ = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  scoringEnabled: z.boolean(),
  fields: z.array(FieldZ).max(300),
});
