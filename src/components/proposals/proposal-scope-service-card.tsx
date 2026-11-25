import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  CONTRACTING_MODALITIES,
  CONTRACTING_MODALITY_META,
  MODALITY_FIELD,
  SERVICE_SCOPE_TYPES,
  SERVICE_SCOPE_TYPE_META,
  SERVICE_TYPE_FIELDS,
  type ContractingModality,
  type ProposalScopeServiceItem,
  type ServiceScopeType,
} from "@/lib/proposals/proposal-scope-forms";
import { cn } from "@/lib/utils";

type Props = {
  service: ProposalScopeServiceItem;
  canRemove: boolean;
  onPatch: (patch: Partial<ProposalScopeServiceItem>) => void;
  onAnswer: (key: string, value: string) => void;
  onRemove: () => void;
};

export function ProposalScopeServiceCard({
  service,
  canRemove,
  onPatch,
  onAnswer,
  onRemove,
}: Props) {
  const { can } = usePermissions();
  const canEdit = ["own", "team", "workspace"].some(
    (s) => can(`techsales.proposals.create.${s}`) || can(`techsales.proposals.update.${s}`),
  );
  const fields = [...SERVICE_TYPE_FIELDS[service.serviceType], MODALITY_FIELD[service.modality]];

  return (
    <div role="tabpanel" className="space-y-3 rounded-md border border-border bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`svc-name-${service.id}`} className="text-xs">
            Nome do serviço
          </Label>
          <Input
            id={`svc-name-${service.id}`}
            disabled={!canEdit}
            value={service.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`svc-type-${service.id}`} className="text-xs">
            Tipo de serviço
          </Label>
          <Select
            disabled={!canEdit}
            value={service.serviceType}
            onValueChange={(v) => onPatch({ serviceType: v as ServiceScopeType })}
          >
            <SelectTrigger id={`svc-type-${service.id}`} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_SCOPE_TYPES.map((st) => (
                <SelectItem key={st} value={st}>
                  {SERVICE_SCOPE_TYPE_META[st].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`svc-mod-${service.id}`} className="text-xs">
            Modalidade de contratação
          </Label>
          <div className="flex items-center gap-1.5">
            <Select
              disabled={!canEdit}
              value={service.modality}
              onValueChange={(v) => onPatch({ modality: v as ContractingModality })}
            >
              <SelectTrigger id={`svc-mod-${service.id}`} className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACTING_MODALITIES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {CONTRACTING_MODALITY_META[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canRemove && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={!canEdit}
                aria-label={`Remover serviço ${service.name}`}
                onClick={onRemove}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {SERVICE_SCOPE_TYPE_META[service.serviceType].shortDesc} ·{" "}
        {CONTRACTING_MODALITY_META[service.modality].hint}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const fieldId = `svc-${service.id}-${field.key}`;
          const val = service.answers[field.key] ?? "";
          return (
            <div key={field.key} className={cn("space-y-1", field.multiline && "sm:col-span-2")}>
              <Label htmlFor={fieldId} className="text-xs">
                {field.label}
              </Label>
              {field.multiline ? (
                <Textarea
                  id={fieldId}
                  disabled={!canEdit}
                  rows={2}
                  value={val}
                  placeholder={field.placeholder}
                  onChange={(e) => onAnswer(field.key, e.target.value)}
                  className="text-xs"
                />
              ) : (
                <Input
                  id={fieldId}
                  disabled={!canEdit}
                  value={val}
                  placeholder={field.placeholder}
                  onChange={(e) => onAnswer(field.key, e.target.value)}
                  className="h-8 text-xs"
                />
              )}
            </div>
          );
        })}

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`svc-notes-${service.id}`} className="text-xs">
            Notas livres — escreva com suas palavras o que será feito
          </Label>
          <Textarea
            id={`svc-notes-${service.id}`}
            disabled={!canEdit}
            rows={3}
            value={service.freeNotes}
            placeholder="Ex.: O cliente contratou 18h para consultoria técnica e suporte operacional em horário comercial, sem acúmulo de horas..."
            onChange={(e) => onPatch({ freeNotes: e.target.value })}
            className="text-xs"
          />
        </div>
      </div>
    </div>
  );
}
