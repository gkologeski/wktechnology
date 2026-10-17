import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toLabel } from "@/lib/entity-fields-meta";
import { DERIVED_CRM_FIELDS } from "@/lib/entity/derived-fields";

export function DerivedFilterFields({ entity, value = {}, onChange }: {
  entity: "leads" | "contacts" | "companies";
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}) {
  const keys = entity === "companies" ? ["size_description"] : ["job_title", ...Array.from(DERIVED_CRM_FIELDS).filter((k) => k !== "size_description")];
  return <div className="space-y-2 px-2 py-2">{keys.map((key) => <div key={key} className="space-y-1">
    <Label className="text-xs" htmlFor={`${entity}-filter-${key}`}>{toLabel(key)}</Label>
    <Input id={`${entity}-filter-${key}`} className="h-8" value={value[key] ?? ""} onChange={(event) => onChange({ ...value, [key]: event.target.value })} />
  </div>)}</div>;
}
