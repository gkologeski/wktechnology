import type { FieldOpt } from "../step-tree";
import {
  countSteps,
  describeAction,
  defaultActionOfType,
  ACTION_ICONS,
  getBranchList,
  setBranchList,
  isBranchKey,
} from "../step-tree";
import { useEntityFieldOptions } from "../use-entity-field-options";
import {
  ConditionListEditor,
  FieldValueEditor,
  newLeafCondition,
  normalizeTopGroup,
  denormalizeTopGroup,
} from "../conditions-editor";
import { EntityPickerDialog } from "../entity-picker-dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Webhook, X, ArrowUp, ArrowDown } from "lucide-react";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExtraFieldsEditor, FkPicker } from "../../extra-fields-editor";
import { GenericRecordForm } from "../../generic-record-form";
import { TokenInput, TokenTextarea } from "../../token-input";
import { useWorkspaceSubstatuses } from "@/lib/pipelines/substatuses";
import { ActionTemplatesBar } from "../../action-templates-bar";
import { ACTION_LABELS, type WorkflowEntity, type WorkflowAction } from "@/lib/workflows/types";
import { useServerFn } from "@tanstack/react-start";
import { listAvailableSurveys } from "@/lib/surveys/survey-activity.functions";


export function SendSlackForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "send_slack" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Canal (opcional)</Label>
        <Input
          value={action.channel ?? ""}
          onChange={(e) => onChange({ ...action, channel: e.target.value })}
          placeholder="C0123ABCD ou #geral (usa canal padrão se vazio)"
        />
      </div>
      <div className="space-y-1">
        <Label>Mensagem</Label>
        <TokenTextarea
          value={action.text}
          onValueChange={(v) => onChange({ ...action, text: v })}
          rows={4}
          placeholder="Aceita tokens {{campo}} e {{vars.NOME}}"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Requer o Slack conectado nas integrações do workspace.
      </p>
    </div>
  );
}

export function SendTeamsForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "send_teams" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Webhook URL do Teams</Label>
        <Input
          value={action.webhook_url}
          onChange={(e) => onChange({ ...action, webhook_url: e.target.value })}
          placeholder="https://outlook.office.com/webhook/..."
        />
        <p className="text-xs text-muted-foreground">
          Crie um "Incoming Webhook" no canal do Teams e cole a URL aqui.
        </p>
      </div>
      <div className="space-y-1">
        <Label>Título (opcional)</Label>
        <TokenInput
          value={action.title ?? ""}
          onValueChange={(v) => onChange({ ...action, title: v })}
        />
      </div>
      <div className="space-y-1">
        <Label>Mensagem</Label>
        <TokenTextarea
          value={action.text}
          onValueChange={(v) => onChange({ ...action, text: v })}
          rows={4}
          placeholder="Aceita tokens {{campo}} e {{vars.NOME}}"
        />
      </div>
    </div>
  );
}
