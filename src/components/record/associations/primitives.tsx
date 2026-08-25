import type { AssociationEntity } from "../associations-panel";
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Eye, MoreHorizontal, Copy, ArrowRight, Tag, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AssociatePeriodDialog,
  periodToDays,
  type AssociationPeriod,
} from "@/components/associations/associate-period-dialog";
import { propagateAssociationHistory } from "@/lib/associations.functions";
import { type PipelineStage } from "@/lib/pipelines";
import type { AssociationKind } from "@/lib/associations.functions";

export const emitTimelineRefresh = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("timeline:refresh"));
  }
};

/* ───────────── card primitive ───────────── */

export function AssocCard({
  icon,
  title,
  count,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/60 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {typeof count === "number" && (
            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums">
              {count}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export const Empty = ({ label }: { label: string }) => (
  <p className="text-xs text-muted-foreground">{label}</p>
);

export function CopyButton({ value, label }: { value: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(
          () => toast.success(`${label ?? "Valor"} copiado`),
          () => toast.error("Falha ao copiar"),
        );
      }}
      className="inline-flex items-center justify-center p-1 text-muted-foreground hover:text-primary rounded transition-colors"
      aria-label={`Copiar ${label ?? "valor"}`}
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

export function DetailRow({
  label,
  value,
  href,
  copyable,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
  copyable?: boolean;
}) {
  const v = value && String(value).trim() ? String(value).trim() : null;
  if (!v) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className="flex items-center justify-between gap-2 min-w-0">
        {href ? (
          <a
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-foreground hover:text-primary hover:underline break-words min-w-0 flex-1"
          >
            {v}
          </a>
        ) : (
          <span className="text-xs text-foreground break-words min-w-0 flex-1">{v}</span>
        )}
        {copyable && <CopyButton value={v} label={label} />}
      </div>
    </div>
  );
}

export type AssocLinkTarget =
  | { to: "/companies/$id"; params: { id: string } }
  | { to: "/contacts/$id"; params: { id: string } }
  | { to: "/deals/$id"; params: { id: string } }
  | { to: "/leads/$id"; params: { id: string } }
  | { to: "/tickets/$id"; params: { id: string } };

export function AssocItemActions({
  link,
  onUnlink,
}: {
  link?: AssocLinkTarget;
  onUnlink?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      data-state={open ? "open" : "closed"}
      className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100 transition-opacity"
    >
      {link && (
        <Link
          {...(link as { to: "/companies/$id"; params: { id: string } })}
          onClick={(e) => e.stopPropagation()}
          className="p-1 text-muted-foreground hover:text-primary hover:bg-muted rounded transition-colors"
          aria-label="Abrir"
          title="Abrir registro"
        >
          <Eye className="h-3.5 w-3.5" />
        </Link>
      )}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            aria-label="Mais ações"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {link && (
            <DropdownMenuItem asChild>
              <Link {...(link as { to: "/companies/$id"; params: { id: string } })}>
                Abrir registro
              </Link>
            </DropdownMenuItem>
          )}
          {onUnlink && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onUnlink}
            >
              Remover associação
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AssocLabelAdder() {
  return (
    <button
      type="button"
      onClick={() => toast.message("Rótulos de associação em breve")}
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-2"
    >
      <Tag className="h-3 w-3" />
      Adicionar rótulo
    </button>
  );
}

export function ViewAllFooter({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      {label}
      <ArrowRight className="h-3 w-3" />
    </a>
  );
}

export function EntityAvatar({
  initials,
  tone = "muted",
}: {
  initials: string;
  tone?: "muted" | "primary";
}) {
  return (
    <div
      className={
        "w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 " +
        (tone === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
      }
    >
      {initials}
    </div>
  );
}

export const relCol = (entity: AssociationEntity) =>
  entity === "deal"
    ? "related_deal_id"
    : entity === "company"
      ? "related_company_id"
      : entity === "lead"
        ? "related_lead_id"
        : "related_contact_id";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sb = supabase as any;

/**
 * Hook que adiciona o diálogo "vincular com janela de histórico" (estilo HubSpot)
 * em torno de uma operação de associação. Após o vínculo, propaga retroativamente
 * as FKs `related_*` nas atividades existentes nas duas pontas, dentro da janela.
 */
export function useAssociateWithPeriod(opts: {
  sourceKind: AssociationKind;
  sourceId: string;
  targetKind: AssociationKind;
  doAssociate: (targetId: string) => Promise<unknown> | unknown;
  title?: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const propagate = useServerFn(propagateAssociationHistory);

  const onConfirm = async (period: AssociationPeriod) => {
    const targetId = pendingId;
    if (!targetId) return;
    await opts.doAssociate(targetId);
    try {
      const r = await propagate({
        data: {
          sourceKind: opts.sourceKind,
          sourceId: opts.sourceId,
          targetKind: opts.targetKind,
          targetId,
          windowDays: periodToDays(period),
        },
      });
      const total = (r?.propagatedFromSource ?? 0) + (r?.propagatedFromTarget ?? 0);
      if (total > 0) toast.success(`${total} atividade(s) trazidas para a timeline`);
    } catch (e) {
      toast.error("Falha ao propagar histórico: " + (e as Error).message);
    }
    setPendingId(null);
  };

  const dialog = (
    <AssociatePeriodDialog
      open={!!pendingId}
      onOpenChange={(o) => {
        if (!o) setPendingId(null);
      }}
      title={opts.title}
      onConfirm={onConfirm}
    />
  );

  return { request: (id: string) => setPendingId(id), dialog };
}

/* ───────────── Deals card (entity = contact|company) ───────────── */

export type DealRow = {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  stage_id: string | null;
  currency: string;
  expected_close_date: string | null;
  pipeline_id: string | null;
};

export const DEAL_SELECT =
  "id, name, value, stage, stage_id, currency, expected_close_date, pipeline_id";

export function formatDealDateLong(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function StagePicker({
  dealId,
  stage,
  stages,
  onChange,
}: {
  dealId: string;
  stage: string;
  stages: PipelineStage[];
  onChange: (value: string) => void;
}) {
  const current = stages.find((s) => s.value === stage);
  const label = current?.label ?? stage;
  if (!stages.length) {
    return <span className="text-xs text-foreground">{label}</span>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary transition-colors"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-auto">
        {stages.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => onChange(s.value)}
            className={s.value === stage ? "font-semibold" : undefined}
          >
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
