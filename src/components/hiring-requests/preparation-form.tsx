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
import {
  changePreparationPurpose,
  purposeLabels,
  purposeDescriptions,
} from "@/lib/hiring/requests/purpose-presentation";
import {
  modalityLabels,
  releaseLabels,
  type PreparationData,
  type RequestKind,
  type PickerKind,
} from "@/lib/hiring/requests/types";
export function PreparationForm({
  kind,
  value,
  onChange,
  picker,
  disabled,
  step,
  referenceValue,
  onReferenceChange,
  canReadReference,
  canWriteReference,
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
  step: number;
  referenceValue: number | null;
  onReferenceChange: (value: number | null) => void;
  canReadReference: boolean;
  canWriteReference: boolean;
}) {
  const set = <K extends keyof PreparationData>(key: K, v: PreparationData[K]) =>
    onChange({ ...value, [key]: v });
  const selection = (
    id: string,
    label: string,
    current: string,
    options: Record<string, string>,
    change: (v: string) => void,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select disabled={disabled} value={current} onValueChange={change}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  return (
    <fieldset disabled={disabled} className="min-w-0">
      {step === 0 && (
        <FormSection title="Demanda">
          <Label htmlFor="request-title">Título *</Label>
          <Input
            id="request-title"
            value={value.title}
            maxLength={200}
            onChange={(e) => set("title", e.target.value)}
            required
          />
          {selection(
            "request-purpose",
            "Finalidade da contratação",
            value.purpose,
            purposeLabels,
            (v) => {
              if (v === "client" || v === "internal" || v === "shared_management")
                onChange(changePreparationPurpose(value, v));
            },
          )}
          <p className="text-sm text-muted-foreground">{purposeDescriptions[value.purpose]}</p>
          <p className="text-xs text-muted-foreground">
            Alterar a finalidade remove os vínculos comerciais deste rascunho e, fora de atendimento
            a cliente, a condição de aceite do cliente final.
          </p>
          {picker("area", "Área responsável", value.area_id, (id) => set("area_id", id))}
          {picker("legal_entity", "Entidade legal WK", value.legal_entity_id, (id) =>
            set("legal_entity_id", id),
          )}
          {kind === "professional" &&
            selection(
              "request-regime",
              "Regime *",
              value.regime ?? "clt",
              { clt: "CLT", pj: "PJ", freelance: "Freelance" },
              (v) => {
                if (v === "clt" || v === "pj" || v === "freelance")
                  onChange({ ...value, regime: v, company_id: null });
              },
            )}
          <Label htmlFor="request-scope">Justificativa / escopo</Label>
          <Textarea
            id="request-scope"
            rows={5}
            maxLength={10000}
            value={value.scope_text}
            onChange={(e) => set("scope_text", e.target.value)}
          />
        </FormSection>
      )}
      {step === 1 && (
        <>
          <FormSection title={kind === "professional" ? "Profissional" : "Fornecedor"}>
            {kind === "professional" && (
              <>
                {selection(
                  "selection-mode",
                  "Definição do profissional",
                  value.selection_mode,
                  { defined: "Profissional definido", needs_selection: "Necessidade de seleção" },
                  (v) => {
                    if (v === "defined" || v === "needs_selection")
                      onChange({ ...value, selection_mode: v, person_id: null });
                  },
                )}
                {value.selection_mode === "defined" &&
                  picker("person", "Pessoa real", value.person_id, (id) => set("person_id", id))}
                {value.selection_mode === "needs_selection" && (
                  <p className="text-sm text-muted-foreground">
                    Necessidade registrada para revisão; nenhuma vaga será aberta.
                  </p>
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
            {picker("project", "Projeto", value.project_id, (id) => set("project_id", id))}
            {value.purpose === "client" && (
              <>
                {picker(
                  "deal",
                  value.additional_deal_ids.length ? "Negócio principal" : "Negócio",
                  value.deal_id,
                  (id) =>
                    onChange({
                      ...value,
                      deal_id: id,
                      additional_deal_ids: id
                        ? value.additional_deal_ids.filter((d) => d !== id)
                        : [],
                    }),
                )}
                {value.deal_id && (
                  <div className="space-y-3" aria-label="Negócios adicionais atendidos">
                    {value.additional_deal_ids.map((dealId, index) => (
                      <div key={dealId}>
                        {picker("deal", `Negócio adicional ${index + 1}`, dealId, (id) =>
                          set(
                            "additional_deal_ids",
                            id && id !== value.deal_id && !value.additional_deal_ids.includes(id)
                              ? value.additional_deal_ids.map((d) => (d === dealId ? id : d))
                              : id
                                ? value.additional_deal_ids
                                : value.additional_deal_ids.filter((d) => d !== dealId),
                          ),
                        )}
                      </div>
                    ))}
                    {value.additional_deal_ids.length < 20 && (
                      <div key={`new-${value.additional_deal_ids.length}`}>
                        {picker(
                          "deal",
                          "Adicionar outro negócio atendido (opcional)",
                          null,
                          (id) => {
                            if (
                              id &&
                              id !== value.deal_id &&
                              !value.additional_deal_ids.includes(id)
                            )
                              set("additional_deal_ids", [...value.additional_deal_ids, id]);
                          },
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Use quando o mesmo fornecedor atende mais de um negócio. Todos precisam ser da
                      mesma entidade WK; o projeto deve pertencer a um deles.
                    </p>
                  </div>
                )}
                {picker(
                  "commercial_contract",
                  "Contrato comercial — WK fornecedora",
                  value.commercial_contract_id,
                  (id) => set("commercial_contract_id", id),
                )}
              </>
            )}
          </FormSection>
        </>
      )}
      {step === 2 && (
        <FormSection title="Condições para revisão">
          {selection("modality", "Modalidade", value.modality, modalityLabels, (v) => {
            if (v === "delivery" || v === "hourly" || v === "monthly" || v === "mixed")
              set("modality", v);
          })}
          {canReadReference ? (
            <>
              <Label htmlFor="reference-value">Valor de referência (R$)</Label>
              <Input
                id="reference-value"
                type="number"
                min={0}
                step="0.01"
                disabled={disabled || !canWriteReference}
                value={referenceValue ?? ""}
                onChange={(e) =>
                  onReferenceChange(e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Valor de referência restrito por permissão específica.
            </p>
          )}
          {kind === "supplier" &&
            selection(
              "release-condition",
              "Condição de liberação do fornecedor",
              value.release_condition ?? "wk_acceptance_invoice",
              value.purpose === "client"
                ? releaseLabels
                : { wk_acceptance_invoice: releaseLabels.wk_acceptance_invoice },
              (v) => {
                if (v === "wk_acceptance_invoice" || v === "also_client_acceptance")
                  set("release_condition", v);
              },
            )}
          {kind === "supplier" && value.release_condition === "also_client_acceptance" && (
            <p role="status" className="text-sm text-muted-foreground">
              Condição especial: exige finalidade Cliente com projeto, negócio ou contrato comercial
              vinculado. Cada entrega só gera conta a pagar após aceite técnico da WK, aceite
              nomeado do cliente final conferido pelo Financeiro e documento fiscal conferido;
              silêncio do cliente nunca conta como aceite.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Condições em preparação para revisão. Nenhuma parcela, medição ou liberação financeira é
            criada.
          </p>
        </FormSection>
      )}
      {step === 3 && (
        <FormSection title="Revisão">
          <dl className="space-y-3">
            <div>
              <dt>Título</dt>
              <dd className="font-medium break-words">{value.title || "Não informado"}</dd>
            </div>
            <div>
              <dt>Finalidade da contratação</dt>
              <dd>{purposeLabels[value.purpose]}</dd>
            </div>
            <div>
              <dt>Escopo</dt>
              <dd className="whitespace-pre-wrap break-words">
                {value.scope_text || "Não informado"}
              </dd>
            </div>
            <div>
              <dt>Modalidade</dt>
              <dd>{modalityLabels[value.modality]}</dd>
            </div>
            {kind === "professional" && (
              <div>
                <dt>Profissional</dt>
                <dd>
                  {value.selection_mode === "defined" ? "Definido" : "Necessidade de seleção"} ·{" "}
                  {value.regime?.toUpperCase()}
                </dd>
              </div>
            )}
            {canReadReference && (
              <div>
                <dt>Valor de referência</dt>
                <dd>
                  {referenceValue === null
                    ? "Não informado"
                    : referenceValue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                </dd>
              </div>
            )}
            {value.release_condition && (
              <div>
                <dt>Liberação em revisão</dt>
                <dd>{releaseLabels[value.release_condition]}</dd>
              </div>
            )}
          </dl>
          {picker("area", "Área responsável", value.area_id, () => {})}
          {picker("legal_entity", "Entidade legal WK", value.legal_entity_id, () => {})}
          {kind === "professional" &&
            value.selection_mode === "defined" &&
            picker("person", "Pessoa real", value.person_id, () => {})}
          {value.company_id && picker("company", "Empresa vinculada", value.company_id, () => {})}
          {value.contact_id && picker("contact", "Contato vinculado", value.contact_id, () => {})}
          {value.project_id && picker("project", "Projeto", value.project_id, () => {})}
          {value.deal_id &&
            picker(
              "deal",
              value.additional_deal_ids.length ? "Negócio principal" : "Negócio de origem",
              value.deal_id,
              () => {},
            )}
          {value.additional_deal_ids.map((dealId, index) => (
            <div key={dealId}>
              {picker("deal", `Negócio adicional ${index + 1}`, dealId, () => {})}
            </div>
          ))}
          {value.commercial_contract_id &&
            picker(
              "commercial_contract",
              "Contrato de origem",
              value.commercial_contract_id,
              () => {},
            )}
        </FormSection>
      )}
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
