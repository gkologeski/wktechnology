// Inspetores de Caminhos em paralelo, Link de agendamento e Material de apoio.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import {
  listBookingPagesForWorkflow,
  listSdrMaterialsForWorkflow,
} from "@/lib/workflow-refs.functions";
import type { WorkflowAction } from "@/lib/workflows/types";

type ParallelAction = Extract<WorkflowAction, { type: "parallel" }>;
type BookingAction = Extract<WorkflowAction, { type: "share_booking_link" }>;
type MaterialAction = Extract<WorkflowAction, { type: "share_material" }>;
type LinkedinAction = Extract<WorkflowAction, { type: "linkedin_task" }>;

function QueryState({
  loading,
  error,
  empty,
  emptyText,
  errorText,
  loadingText,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  emptyText: string;
  errorText: string;
  loadingText: string;
}) {
  if (loading)
    return (
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {loadingText}
      </p>
    );
  if (error)
    return (
      <p className="text-xs text-destructive" role="alert">
        {errorText}
      </p>
    );
  if (empty) return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  return null;
}

export function ParallelForm({
  action,
  onChange,
}: {
  action: ParallelAction;
  onChange: (a: ParallelAction) => void;
}) {
  const branches = action.branches ?? [];
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Cada caminho segue sozinho, inclusive com esperas. Use para abordar por WhatsApp e e-mail ao
        mesmo tempo. Aprovação humana não pode ficar dentro destes caminhos.
      </p>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="wf-par-join">
          Quando continuar
        </Label>
        <Select
          value={action.join}
          onValueChange={(v) => onChange({ ...action, join: v as "all" | "any" })}
        >
          <SelectTrigger id="wf-par-join">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Quando todos os caminhos terminarem</SelectItem>
            <SelectItem value="any">No primeiro que terminar (cancela os outros)</SelectItem>
          </SelectContent>
        </Select>
        {action.join === "any" && (
          <p className="text-xs text-muted-foreground">
            Caminhos sem espera terminam na hora, na ordem em que aparecem.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Caminhos ({branches.length} de 5)</Label>
        {branches.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              aria-label={`Nome do caminho ${i + 1}`}
              value={b.label ?? ""}
              placeholder={`Caminho ${i + 1}`}
              onChange={(e) =>
                onChange({
                  ...action,
                  branches: branches.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover caminho ${i + 1}`}
              disabled={branches.length <= 2}
              onClick={() => onChange({ ...action, branches: branches.filter((_, j) => j !== i) })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={branches.length >= 5}
          onClick={() => onChange({ ...action, branches: [...branches, { actions: [] }] })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar caminho
        </Button>
      </div>
    </div>
  );
}

export function BookingLinkForm({
  action,
  onChange,
}: {
  action: BookingAction;
  onChange: (a: BookingAction) => void;
}) {
  const fn = useServerFn(listBookingPagesForWorkflow);
  const q = useQuery({ queryKey: ["wf-booking-pages"], queryFn: () => fn(), staleTime: 60_000 });
  const pages = q.data ?? [];
  const chosen = pages.find((p) => p.id === action.booking_page_id);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Prepara o link da agenda escolhida. Use {"{{vars.booking_url}}"} em um e-mail ou nas
        variáveis do modelo de WhatsApp nos passos seguintes. Nenhum horário é reservado aqui: o
        contato escolhe na própria página.
      </p>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="wf-booking-page">
          Página de agendamento
        </Label>
        <QueryState
          loading={q.isLoading}
          error={q.isError}
          empty={!q.isLoading && !q.isError && pages.length === 0}
          loadingText="Carregando agendas…"
          errorText="Não foi possível carregar as agendas."
          emptyText="Nenhuma página de agendamento nesta empresa. Crie uma em Agendamentos."
        />
        {pages.length > 0 && (
          <Select
            value={action.booking_page_id || "__default"}
            onValueChange={(v) =>
              onChange({ ...action, booking_page_id: v === "__default" ? "" : v })
            }
          >
            <SelectTrigger id="wf-booking-page">
              <SelectValue placeholder="Escolha a agenda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default">Agenda padrão da empresa</SelectItem>
              {pages.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                  {p.active ? "" : " (desativada)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {chosen && !chosen.active && (
          <p className="text-xs text-destructive" role="alert">
            Esta agenda está desativada; a publicação do fluxo fica bloqueada.
          </p>
        )}
      </div>
    </div>
  );
}

export function MaterialForm({
  action,
  onChange,
}: {
  action: MaterialAction;
  onChange: (a: MaterialAction) => void;
}) {
  const fn = useServerFn(listSdrMaterialsForWorkflow);
  const q = useQuery({ queryKey: ["wf-sdr-materials"], queryFn: () => fn(), staleTime: 60_000 });
  const items = q.data ?? [];
  const chosen = items.find((m) => m.id === action.material_id);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Prepara o link de um material aprovado. Use {"{{vars.material_url}}"} e{" "}
        {"{{vars.material_title}}"} nos passos seguintes.
      </p>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="wf-material">
          Material *
        </Label>
        <QueryState
          loading={q.isLoading}
          error={q.isError}
          empty={!q.isLoading && !q.isError && items.length === 0}
          loadingText="Carregando materiais…"
          errorText="Não foi possível carregar os materiais."
          emptyText="Nenhum material cadastrado nesta empresa."
        />
        {items.length > 0 && (
          <Select
            value={action.material_id || ""}
            onValueChange={(v) => onChange({ ...action, material_id: v })}
          >
            <SelectTrigger id="wf-material">
              <SelectValue placeholder="Escolha o material" />
            </SelectTrigger>
            <SelectContent>
              {items.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}
                  {m.usable ? "" : " (não aprovado ou inativo)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {chosen && !chosen.usable && (
          <p className="text-xs text-destructive" role="alert">
            Este material precisa estar aprovado, ativo e com link; a publicação fica bloqueada.
          </p>
        )}
      </div>
    </div>
  );
}

/** LinkedIn não tem envio automático: o bloco cria uma tarefa para o responsável. */
export function LinkedinTaskForm({
  action,
  onChange,
}: {
  action: LinkedinAction;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Não há envio automático pelo LinkedIn. Este passo cria uma tarefa para o dono do fluxo fazer
        o contato manualmente e registra no histórico como tarefa manual.
      </p>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="wf-li-note">
          O que fazer *
        </Label>
        <Input
          id="wf-li-note"
          value={action.note}
          maxLength={1000}
          onChange={(e) => onChange({ ...action, note: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="wf-li-due">
          Prazo (dias)
        </Label>
        <Input
          id="wf-li-due"
          type="number"
          min={0}
          max={60}
          value={action.due_in_days ?? 0}
          onChange={(e) =>
            onChange({
              ...action,
              due_in_days: Math.max(0, Math.min(60, Number(e.target.value) || 0)),
            })
          }
        />
      </div>
    </div>
  );
}
