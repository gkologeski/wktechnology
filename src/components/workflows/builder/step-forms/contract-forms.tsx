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
import { EntityCombobox } from "@/components/ui/entity-combobox";
import type { WorkflowAction } from "@/lib/workflows/types";

type Action = Extract<WorkflowAction, { type: "create_contract_from_deal" }>;

export function CreateContractFromDealForm({
  action,
  onChange,
}: {
  action: Action;
  onChange: (a: Action) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tipo de contrato</Label>
          <Select
            value={action.document_kind ?? "contract"}
            onValueChange={(v) => onChange({ ...action, document_kind: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contract">Contrato</SelectItem>
              <SelectItem value="purchase">Contrato de compra</SelectItem>
              <SelectItem value="amendment">Aditivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Papel</Label>
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

      <p className="text-xs text-muted-foreground">
        O contrato é criado com os dados do negócio no momento em que o workflow roda: empresa,
        moeda, responsável e cada item de linha com a cobrança já preenchida (forma, unidade, valor,
        percentual e recorrência).
      </p>
    </div>
  );
}
