// Formulário completo de contrato, agrupado por seção.
import { FormSection } from "@/components/techhire/ui";
import { fieldsBySection, type ContractFieldDef } from "@/lib/contracts/contract-field-catalog";
import { ContractFieldInput } from "./contract-field-input";

export type ContractFormValues = Record<string, unknown>;

export function ContractFieldsForm({
  fields,
  values,
  onChange,
  hints,
}: {
  fields: ContractFieldDef[];
  values: ContractFormValues;
  onChange: (name: string, value: unknown) => void;
  /** Origem do valor por campo ("Padrão do workspace", "Do negócio"). */
  hints?: Record<string, string | null>;
}) {
  return (
    <div className="space-y-5">
      {fieldsBySection(fields).map(([section, list]) => (
        <FormSection key={section} title={section}>
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((field) => (
              <div
                key={field.name}
                className={field.type === "textarea" ? "sm:col-span-2" : undefined}
              >
                <ContractFieldInput
                  field={field}
                  value={values[field.name]}
                  onChange={(v) => onChange(field.name, v)}
                  hint={hints?.[field.name] ?? null}
                />
              </div>
            ))}
          </div>
        </FormSection>
      ))}
    </div>
  );
}
