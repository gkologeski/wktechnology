import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/crm";

type Row = {
  id: string;
  property: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
  changed_by: string | null;
};

// pt-BR labels for property names shown in the history drawer.
const PROPERTY_LABELS: Record<string, string> = {
  first_name: "Nome",
  last_name: "Sobrenome",
  email: "Email",
  phone: "Telefone",
  mobile_phone: "Celular",
  company_name: "Empresa",
  company: "Empresa",
  source: "Origem",
  status: "Status",
  score: "Score",
  label: "Etiqueta",
  notes: "Notas",
  job_title: "Cargo",
  city: "Cidade",
  state: "UF",
  country: "País",
  cep: "CEP",
  address: "Endereço",
  website: "Site",
  owner_id: "Responsável",
  assigned_user_id: "Responsável",
  pipeline_id: "Pipeline",
  stage: "Etapa",
  name: "Nome",
  value: "Valor",
  currency: "Moeda",
  expected_close_date: "Fechamento esperado",
  priority: "Prioridade",
  due_at: "Vencimento",
  description: "Descrição",
  title: "Título",
};

// pt-BR labels for known enum values stored in property history.
const VALUE_LABELS: Record<string, string> = {
  // Lead/contact status
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  disqualified: "Desqualificado",
  unqualified: "Não qualificado",
  // Deal / generic
  open: "Aberto",
  won: "Ganho",
  lost: "Perdido",
  pending: "Pendente",
  in_progress: "Em andamento",
  done: "Concluído",
  closed: "Fechado",
  resolved: "Resolvido",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  active: "Ativo",
  inactive: "Inativo",
  paused: "Pausado",
  draft: "Rascunho",
  scheduled: "Agendado",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
  // Priority
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
  // Boolean-ish
  true: "Sim",
  false: "Não",
  null: "—",
};

function labelProperty(key: string): string {
  if (PROPERTY_LABELS[key]) return PROPERTY_LABELS[key];
  // Fallback: snake_case → Title Case
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  const key = s.toLowerCase();
  return VALUE_LABELS[key] ?? s;
}

export function PropertyHistoryDrawer({
  open,
  onOpenChange,
  entity,
  entityId,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  entity: string;
  entityId: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("property_history")
      .select("*")
      .eq("entity", entity)
      .eq("entity_id", entityId)
      .order("changed_at", { ascending: false })
      .limit(200)
      .then((r: { data: Row[] | null }) => setRows(r.data ?? []));
  }, [open, entity, entityId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico de propriedades</SheetTitle>
        </SheetHeader>
        <ol className="mt-4 space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>
          )}
          {rows.map((h) => (
            <li key={h.id} className="rounded border p-3 text-sm">
              <div className="font-medium">{labelProperty(h.property)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="line-through">{labelValue(h.old_value)}</span>
                {" → "}
                <span className="text-foreground">{labelValue(h.new_value)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {formatDateTime(h.changed_at)}
              </div>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
