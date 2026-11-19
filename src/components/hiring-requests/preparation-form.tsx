import type { ReactNode } from "react";
import { FormSection } from "@/components/techhire/ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { PreparationData, RequestKind, PickerKind } from "@/lib/hiring/requests/types";
export function PreparationForm({
  kind,
  value,
  onChange,
  picker,
  disabled,
}: {
  kind: RequestKind;
  value: PreparationData;
  onChange: (v: PreparationData) => void;
  picker: (
    k: PickerKind,
    label: string,
    value: string | null,
    onChange: (id: string | null) => void,
  ) => ReactNode;
  disabled: boolean;
}) {
  const set = <K extends keyof PreparationData>(k: K, v: PreparationData[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <FormSection title="Solicitação">
        <Label htmlFor="request-title">Título *</Label>
        <Input
          id="request-title"
          value={value.title}
          maxLength={200}
          onChange={(e) => set("title", e.target.value)}
          required
        />
        <Label htmlFor="request-scope">Justificativa / escopo</Label>
        <Textarea
          id="request-scope"
          value={value.scope_text}
          maxLength={10000}
          onChange={(e) => set("scope_text", e.target.value)}
          rows={5}
        />
        <Label htmlFor="request-purpose">Finalidade</Label>
        <Select
          disabled={disabled}
          value={value.purpose}
          onValueChange={(v) => {
            if (v === "client" || v === "internal" || v === "shared_management")
              onChange({ ...value, purpose: v, deal_id: null, commercial_contract_id: null });
          }}
        >
          <SelectTrigger id="request-purpose">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="client">Cliente</SelectItem>
            <SelectItem value="internal">Interno</SelectItem>
            <SelectItem value="shared_management">Gestão compartilhada</SelectItem>
          </SelectContent>
        </Select>
        {picker("area", "Área responsável", value.area_id, (id) => set("area_id", id))}
        {picker("legal_entity", "Entidade legal WK", value.legal_entity_id, (id) =>
          set("legal_entity_id", id),
        )}
      </FormSection>
      <FormSection title={kind === "professional" ? "Profissional" : "Fornecedor"}>
        {kind === "professional" && (
          <>
            <Label htmlFor="request-regime">Regime *</Label>
            <Select
              disabled={disabled}
              value={value.regime ?? "clt"}
              onValueChange={(v) => {
                if (v === "clt" || v === "pj" || v === "freelance")
                  onChange({ ...value, regime: v, company_id: null });
              }}
            >
              <SelectTrigger id="request-regime">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clt">CLT</SelectItem>
                <SelectItem value="pj">PJ</SelectItem>
                <SelectItem value="freelance">Freelance</SelectItem>
              </SelectContent>
            </Select>
            {picker("person", "Pessoa real (opcional)", value.person_id, (id) =>
              set("person_id", id),
            )}
          </>
        )}
        {(kind === "supplier" || value.regime === "pj") &&
          picker(
            "company",
            kind === "supplier" ? "Empresa fornecedora" : "Empresa PJ (opcional)",
            value.company_id,
            (id) => onChange({ ...value, company_id: id, contact_id: null }),
          )}
        {kind === "supplier" &&
          picker("contact", "Contato do fornecedor (opcional)", value.contact_id, (id) =>
            set("contact_id", id),
          )}
      </FormSection>
      <FormSection title="Origem (opcional)">
        {value.purpose === "client" &&
          picker("deal", "Negócio", value.deal_id, (id) => set("deal_id", id))}
        {picker("project", "Projeto", value.project_id, (id) => set("project_id", id))}
        {value.purpose === "client" &&
          picker(
            "commercial_contract",
            "Contrato comercial — WK fornecedora",
            value.commercial_contract_id,
            (id) => set("commercial_contract_id", id),
          )}
      </FormSection>
    </fieldset>
  );
}
export function PickerResults({
  options,
  onPick,
}: {
  options: { id: string; label: string }[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="max-h-64 overflow-y-auto space-y-1">
      {options.map((o) => (
        <Button
          key={o.id}
          variant="ghost"
          className="w-full justify-start whitespace-normal h-auto min-h-11 text-left"
          onClick={() => onPick(o.id)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
