import { z } from "zod";

type AddressJson =
  | string
  | number
  | boolean
  | null
  | AddressJson[]
  | { [key: string]: AddressJson };
const addressJsonSchema: z.ZodType<AddressJson> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(addressJsonSchema),
    z.record(addressJsonSchema),
  ]),
);

export const legalEntityAddressSchema = z
  .object({
    street: z.string().trim().max(200),
    number: z.string().trim().max(30),
    complement: z.string().trim().max(200),
    neighborhood: z.string().trim().max(100),
    city: z.string().trim().max(100),
    state: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => !v || /^[A-Z]{2}$/.test(v), "UF deve ter duas letras"),
    zip_code: z
      .string()
      .trim()
      .refine((v) => !v || /^\d{5}-?\d{3}$/.test(v), "CEP deve ter oito dígitos"),
  })
  .catchall(addressJsonSchema);

export type LegalEntityAddress = z.infer<typeof legalEntityAddressSchema> &
  Record<string, AddressJson>;

export function formatLegalEntityCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

/** Hydrate canonical/legacy keys and keep additional metadata on save. */
export function readLegalEntityAddress(value: unknown): LegalEntityAddress {
  const a =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const text = (...keys: string[]) => {
    for (const key of keys) {
      const v = a[key];
      if (typeof v === "string" || typeof v === "number") return String(v);
    }
    return "";
  };
  return {
    ...z.record(addressJsonSchema).parse(a),
    street: text("street", "logradouro"),
    number: text("number", "numero"),
    complement: text("complement", "complemento"),
    neighborhood: text("neighborhood", "bairro"),
    city: text("city", "cidade"),
    state: text("state", "uf"),
    zip_code: formatLegalEntityCep(text("zip_code", "zip", "cep")),
  };
}

export type LegalEntityCnpjData = {
  name: string;
  trade_name: string;
  address: LegalEntityAddress;
  source: "brasilapi" | "receitaws";
};

/** Never erase existing fields when a provider returns an incomplete record. */
export function applyLegalEntityCnpjData<
  T extends { name: string; trade_name: string; address_json: LegalEntityAddress },
>(current: T, data: LegalEntityCnpjData): T {
  const address = { ...current.address_json };
  for (const key of [
    "street",
    "number",
    "complement",
    "neighborhood",
    "city",
    "state",
    "zip_code",
  ] as const) {
    if (data.address[key]) address[key] = data.address[key];
  }
  return {
    ...current,
    name: data.name || current.name,
    trade_name: data.trade_name || current.trade_name,
    address_json: address,
  };
}
