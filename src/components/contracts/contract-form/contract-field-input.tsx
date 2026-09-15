// Renderiza um campo de contrato conforme o tipo declarado no catálogo.
// Usado tanto no formulário de criação quanto na tela de padrões.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import type { ContractFieldDef } from "@/lib/contracts/contract-field-catalog";

const NONE = "__none__";

function asString(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function UserSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const { data, isLoading } = useWorkspaceMembers();
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={isLoading}
    >
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Carregando…" : "Sem responsável"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sem responsável</SelectItem>
        {(data ?? []).map((m) => (
          <SelectItem key={m.user_id} value={m.user_id}>
            {m.full_name?.trim() || m.user_id.slice(0, 8)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ContractFieldInput({
  field,
  value,
  onChange,
  /** Marca visualmente que o valor veio de um padrão ou do negócio. */
  hint,
}: {
  field: ContractFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  hint?: string | null;
}) {
  const id = `contract-field-${field.name}`;

  const control = (() => {
    switch (field.type) {
      case "textarea":
        return (
          <Textarea
            id={id}
            value={asString(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
          />
        );
      case "number":
        return (
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={asString(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            placeholder={field.placeholder}
          />
        );
      case "currency":
        return (
          <CurrencyInput
            id={id}
            value={typeof value === "number" ? value : undefined}
            onValueChange={(v) => onChange(typeof v === "number" ? v : null)}
            currency="BRL"
          />
        );
      case "date":
        return (
          <Input
            id={id}
            type="date"
            value={asString(value)}
            onChange={(e) => onChange(e.target.value || null)}
          />
        );
      case "boolean":
        return (
          <div className="flex h-9 items-center">
            <Switch id={id} checked={value === true} onCheckedChange={(v) => onChange(v)} />
          </div>
        );
      case "select":
        return (
          <Select
            value={asString(value) || NONE}
            onValueChange={(v) => onChange(v === NONE ? null : v)}
          >
            <SelectTrigger id={id}>
              <SelectValue placeholder="Não definido" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Não definido</SelectItem>
              {(field.options ?? []).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "company":
        return (
          <EntityCombobox
            entity="companies"
            select="id, name, domain"
            labelFrom={(r) => String((r as { name?: string }).name ?? "")}
            hintFrom={(r) => (r as { domain?: string | null }).domain ?? null}
            value={(value as string | null) ?? null}
            onChange={(v) => onChange(v)}
            placeholder="Selecione a empresa"
          />
        );
      case "legal_entity":
        return (
          <EntityCombobox
            entity="legal_entities"
            select="id, name, cnpj"
            searchColumns={["name", "cnpj"]}
            labelFrom={(r) => String((r as { name?: string }).name ?? "")}
            hintFrom={(r) => (r as { cnpj?: string | null }).cnpj ?? null}
            value={(value as string | null) ?? null}
            onChange={(v) => onChange(v)}
            placeholder="Selecione a empresa contratante"
            emptyLabel="Nenhuma empresa cadastrada"
          />
        );
      case "deal":
        return (
          <EntityCombobox
            entity="deals"
            select="id, name, value, currency"
            labelFrom={(r) => String((r as { name?: string }).name ?? "—")}
            value={(value as string | null) ?? null}
            onChange={(v) => onChange(v)}
            placeholder="Sem negócio vinculado"
          />
        );
      case "contract":
        return (
          <EntityCombobox
            entity="contracts"
            select="id, title, number"
            searchColumns={["title", "number"]}
            labelFrom={(r) => String((r as { title?: string }).title ?? "—")}
            hintFrom={(r) => (r as { number?: string | null }).number ?? null}
            value={(value as string | null) ?? null}
            onChange={(v) => onChange(v)}
            placeholder="Selecione o contrato principal"
          />
        );
      case "user":
        return (
          <UserSelect value={(value as string | null) ?? null} onChange={(v) => onChange(v)} />
        );
      default:
        return (
          <Input
            id={id}
            value={asString(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        );
    }
  })();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {field.label}
      </Label>
      {control}
      {(hint || field.hint) && (
        <p className="text-[11px] text-muted-foreground">{hint || field.hint}</p>
      )}
    </div>
  );
}
