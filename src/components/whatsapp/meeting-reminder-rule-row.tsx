import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { OFFSET_UNITS, REMINDER_VARIABLES, type OffsetUnit } from "@/lib/whatsapp/meeting-reminders";

export type RuleDraft = {
  uid: string;
  amount: number;
  unit: OffsetUnit;
  enabled: boolean;
  template_key: string; // name|language
  variable_map: string[];
};

export type TemplateOption = { name: string; language: string; body: string; variables: number };

const SAMPLE: Record<string, string> = {
  first_name: "Mariana",
  meeting_date: "05/11/2026",
  meeting_time: "14:00",
  meeting_link: "https://meet.google.com/abc-defg-hij",
  owner_name: "Lia",
  subject: "Apresentação WK",
};

/** Linha editável de um lembrete (tempo + unidade + modelo + variáveis). */
export function MeetingReminderRuleRow(props: {
  rule: RuleDraft;
  index: number;
  templates: TemplateOption[];
  tplByKey: Map<string, TemplateOption>;
  canEdit: boolean;
  duplicate: boolean;
  outOfRange: boolean;
  onChange: (patch: Partial<RuleDraft>) => void;
  onRemove: () => void;
}) {
  const { rule: r, templates, tplByKey, canEdit, onChange } = props;
  const id = r.uid;
  const t = tplByKey.get(r.template_key);
  const preview = t
    ? t.body.replace(/\{\{(\d+)\}\}/g, (_m, n) => {
        const k = r.variable_map[Number(n) - 1];
        return k ? (SAMPLE[k] ?? "") : `{{${n}}}`;
      })
    : "";
  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 pb-2">
          <Switch
            id={`mr-on-${id}`}
            checked={r.enabled}
            onCheckedChange={(v) => onChange({ enabled: v })}
            disabled={!canEdit}
            aria-label={`Ativar lembrete ${props.index + 1}`}
          />
        </div>
        <div className="w-24 space-y-1.5">
          <Label htmlFor={`mr-amt-${id}`}>Quantidade</Label>
          <Input
            id={`mr-amt-${id}`}
            type="number"
            min={1}
            step={1}
            value={Number.isFinite(r.amount) ? r.amount : ""}
            onChange={(e) => onChange({ amount: parseInt(e.target.value, 10) })}
            disabled={!canEdit}
          />
        </div>
        <div className="w-36 space-y-1.5">
          <Label htmlFor={`mr-unit-${id}`}>Unidade</Label>
          <Select
            value={r.unit}
            onValueChange={(v) => onChange({ unit: v as OffsetUnit })}
            disabled={!canEdit}
          >
            <SelectTrigger id={`mr-unit-${id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OFFSET_UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="pb-2 text-sm text-text-secondary">antes da reunião</span>
        <div className="ml-auto pb-0.5">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canEdit}
                aria-label={`Remover lembrete ${props.index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover este lembrete?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ele deixa de ser enviado depois que você salvar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={props.onRemove}>Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {props.outOfRange ? (
        <p className="text-xs text-destructive">Use de 1 minuto a 30 dias antes.</p>
      ) : props.duplicate ? (
        <p className="text-xs text-destructive">Já existe outro lembrete com esse tempo.</p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`mr-tpl-${id}`}>Modelo aprovado</Label>
          <Select
            value={r.template_key || undefined}
            onValueChange={(v) => {
              const n = tplByKey.get(v)?.variables ?? 0;
              onChange({
                template_key: v,
                variable_map: Array.from({ length: n }, (_, i) => r.variable_map[i] ?? ""),
              });
            }}
            disabled={!canEdit || templates.length === 0}
          >
            <SelectTrigger id={`mr-tpl-${id}`}>
              <SelectValue placeholder="Escolha um modelo" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((x) => (
                <SelectItem key={`${x.name}|${x.language}`} value={`${x.name}|${x.language}`}>
                  {x.name} · {x.language}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {r.template_key && !t ? (
            <p className="text-xs text-destructive">
              Este modelo não está aprovado para o número escolhido. Escolha outro.
            </p>
          ) : null}
        </div>
        {t
          ? r.variable_map.map((k, i) => (
              <div key={i} className="space-y-1.5">
                <Label htmlFor={`mr-var-${id}-${i}`}>Variável {`{{${i + 1}}}`}</Label>
                <Select
                  value={k || undefined}
                  onValueChange={(v) =>
                    onChange({ variable_map: r.variable_map.map((x, j) => (j === i ? v : x)) })
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger id={`mr-var-${id}-${i}`}>
                    <SelectValue placeholder="Escolha o dado" />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_VARIABLES.map((v) => (
                      <SelectItem key={v.key} value={v.key}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))
          : null}
        {t ? (
          <div className="rounded-md bg-muted p-3 text-sm text-text-secondary md:col-span-2">
            <span className="mb-1 block text-xs font-medium text-text-tertiary">
              Prévia com dados de exemplo
            </span>
            {preview || "(modelo sem texto)"}
          </div>
        ) : null}
      </div>
    </div>
  );
}
