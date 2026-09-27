// Formulário da ação "Criar contrato a partir do negócio".
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TokenInput } from "@/components/workflows/token-input";
import { ExtraFieldsEditor } from "@/components/workflows/extra-fields-editor";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { Button } from "@/components/ui/button";
import type { WorkflowAction } from "@/lib/workflows/types";
import {
  CONTRACT_KINDS,
  CONTRACT_KIND_LABEL,
  isContractKind,
} from "@/lib/contracts/contract-kinds";

type Action = Extract<WorkflowAction, { type: "create_contract_from_deal" }>;

/** Workflows antigos guardavam "contract"/"purchase" em `document_kind`. */
function normalizeKind(raw: string | null | undefined): string {
  if (isContractKind(raw)) return raw;
  if (raw === "purchase") return "client";
  if (raw === "amendment") return "amendment";
  return "provider";
}

export function CreateContractFromDealForm({
  action,
  onChange,
}: {
  action: Action;
  onChange: (a: Action) => void;
}) {
  const configured = Object.entries(action.extra_fields ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  const summaryFields = [
    [
      "Tipo",
      CONTRACT_KIND_LABEL[
        normalizeKind(action.document_kind) as keyof typeof CONTRACT_KIND_LABEL
      ] ?? "Contrato",
    ],
    ["Título", action.title],
    ["Moeda", action.extra_fields?.currency],
    [
      "Reajuste",
      [action.extra_fields?.adjustment_index, action.extra_fields?.adjustment_frequency]
        .filter(Boolean)
        .join(" / "),
    ],
    [
      "Renovação",
      typeof action.extra_fields?.auto_renew === "boolean"
        ? action.extra_fields.auto_renew
          ? "Sim"
          : "Não"
        : undefined,
    ],
  ].filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== "");
  return (
    <div className="space-y-3">
      <section aria-label="Resumo da ação" className="border-b pb-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">CRIAR CONTRATO</p>
            <p className="text-sm text-muted-foreground">
              {configured.length +
                [action.title, action.starts_at, action.template_id].filter(Boolean).length}{" "}
              campos configurados
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              document
                .getElementById("wf-contract-fields")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            Editar campos
          </Button>
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          {summaryFields.map(([key, value]) => (
            <div key={String(key)} className="flex min-w-0 gap-2">
              <dt className="text-muted-foreground shrink-0">{String(key)}:</dt>
              <dd className="truncate font-medium" title={String(value)}>
                {String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tipo de contrato</Label>
          <Select
            value={normalizeKind(action.document_kind)}
            onValueChange={(v) => onChange({ ...action, document_kind: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTRACT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {CONTRACT_KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Papel do aditivo</Label>
          <Select
            value={action.role ?? "provider"}
            onValueChange={(v) => onChange({ ...action, role: v as "provider" | "client" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="provider">Prestação (nós prestamos)</SelectItem>
              <SelectItem value="client">Compra (nós contratamos)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Título do contrato</Label>
        <TokenInput
          value={action.title ?? ""}
          onValueChange={(v) => onChange({ ...action, title: v })}
          placeholder="Contrato — {{name}}"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Início da vigência</Label>
          <TokenInput
            value={action.starts_at ?? ""}
            onValueChange={(v) => onChange({ ...action, starts_at: v })}
            placeholder="{{closed_at}} ou 2026-01-01"
          />
        </div>
        <div>
          <Label className="text-xs">Modelo de contrato</Label>
          <EntityCombobox
            entity="contract_templates"
            select="id, name"
            searchColumns={["name"]}
            labelFrom={(r) => String((r as { name?: string }).name ?? "Modelo")}
            value={action.template_id ?? null}
            onChange={(id) => onChange({ ...action, template_id: id ?? undefined })}
            placeholder="Sem modelo"
            emptyLabel="Nenhum modelo"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-2">
        <Label className="text-xs" htmlFor="copy-line-items">
          Copiar itens do negócio como serviços do contrato
        </Label>
        <Switch
          id="copy-line-items"
          checked={action.copy_line_items !== false}
          onCheckedChange={(v) => onChange({ ...action, copy_line_items: v })}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border p-2">
        <Label className="text-xs" htmlFor="skip-if-exists">
          Não criar de novo se o negócio já tem contrato deste tipo
        </Label>
        <Switch
          id="skip-if-exists"
          checked={action.skip_if_exists !== false}
          onCheckedChange={(v) => onChange({ ...action, skip_if_exists: v })}
        />
      </div>

      <div id="wf-contract-fields">
        <ExtraFieldsEditor
          entity="contracts"
          title="Mais campos do contrato"
          extraFields={action.extra_fields}
          hiddenKeys={[
            "title",
            "starts_at",
            "deal_id",
            "document_kind",
            "role",
            "status",
            "body_html",
            "number",
            "public_token",
          ]}
          triggerEntity="deals"
          onChange={(next) => onChange({ ...action, extra_fields: next })}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        O contrato é criado com os dados do negócio no momento em que o workflow roda: empresa,
        moeda, responsável e cada item de linha com a cobrança já preenchida (forma, unidade, valor,
        percentual e recorrência). Nos campos de valor e data você pode usar uma variável do negócio
        (por exemplo o valor do negócio) em vez de digitar um número fixo.
      </p>
    </div>
  );
}
