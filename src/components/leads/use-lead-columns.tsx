import { useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";
import { resolveLeadStageValue, findLeadStage, type LeadStage } from "@/lib/leads/stages";
import { translateFieldValue } from "@/lib/i18n/hubspot-values";
import { toE164 } from "@/lib/validators";
import { colorFromString, initialsOf, timeAgo } from "@/lib/leads/format";
import type { LeadGridRow, SortDir, SortKey } from "@/lib/leads/constants";
import { StagePill, ScoreCell, Th } from "@/components/leads/table-primitives";

/** Colunas visíveis por padrão no grid de leads. */
const DEFAULT_LEAD_COLS = [
  "name",
  "email",
  "phone",
  "company",
  "status",
  "score",
  "owner",
  "created_at",
];

/**
 * Define as colunas do grid de leads e conecta ao editor de colunas
 * persistido (useGridColumns), incluindo ordenação das colunas fixas.
 */
export function useLeadColumns({
  sortKey,
  sortDir,
  onSort,
  stages,
  nameFor,
  initialsFor,
  hsOwners,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  stages: LeadStage[];
  nameFor: (id: string) => string;
  initialsFor: (id: string) => string;
  hsOwners: {
    byId?: Map<
      string,
      { first_name?: string | null; last_name?: string | null; email?: string | null }
    >;
  };
}) {
  /** Cabeçalho ordenável para as colunas do catálogo dinâmico ("Outros campos"). */
  const autoSortHeader = useCallback(
    (col: { key: string; label: string }) => (
      <Th sortable active={sortKey === col.key} dir={sortDir} onClick={() => onSort(col.key)}>
        {col.label}
      </Th>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortKey, sortDir],
  );

  const leadColumns = useMemo<GridColumnDef<LeadGridRow>[]>(
    () => [
      {
        key: "name",
        label: "Nome",
        header: (
          <Th
            sortable
            active={sortKey === "first_name"}
            dir={sortDir}
            onClick={() => onSort("first_name")}
          >
            Nome
          </Th>
        ),
        render: (lead) => {
          const full = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Sem nome";
          return (
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: colorFromString(lead.id) }}
              >
                {initialsOf(lead)}
              </span>
              <Link
                to="/leads/$id"
                params={{ id: lead.id }}
                className="truncate font-medium text-primary hover:underline"
              >
                {full}
              </Link>
            </div>
          );
        },
      },
      {
        key: "email",
        label: "E-mail",
        className: "text-muted-foreground",
        render: (lead) => (lead.email ? <span className="truncate">{lead.email}</span> : "—"),
      },
      {
        key: "phone",
        label: "Telefone",
        className: "text-muted-foreground",
        render: (lead) => (lead.phone ? (toE164(lead.phone) ?? lead.phone) : "—"),
      },
      {
        key: "mobile_phone",
        label: "Celular",
        className: "text-muted-foreground",
        render: (lead) =>
          lead.mobile_phone ? (toE164(lead.mobile_phone) ?? lead.mobile_phone) : "—",
      },
      {
        key: "linkedin_url",
        label: "LinkedIn",
        className: "text-muted-foreground",
        render: (lead) =>
          lead.linkedin_url ? (
            <a
              href={lead.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 truncate"
              onClick={(e) => e.stopPropagation()}
            >
              Perfil
            </a>
          ) : (
            "—"
          ),
      },
      {
        key: "company",
        label: "Empresa",
        render: (lead) =>
          lead.company_name ? (
            <span className="truncate">{lead.company_name}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "status",
        label: "Etapa do lead",
        render: (lead) => {
          const v = resolveLeadStageValue(
            lead as unknown as { stage_id?: string | null; status?: string | null },
            stages,
          );
          return <StagePill stage={findLeadStage(stages, v)} value={v} />;
        },
      },

      {
        key: "score",
        label: "Score",
        header: (
          <Th sortable active={sortKey === "score"} dir={sortDir} onClick={() => onSort("score")}>
            Score
          </Th>
        ),
        render: (lead) => <ScoreCell score={lead.score ?? 0} />,
      },
      {
        key: "owner",
        label: "Responsável",
        render: (lead) => {
          const assigned = lead.assigned_user_id as string | null | undefined;
          const ownerUserId = (lead as unknown as { owner_id?: string | null }).owner_id;
          const hsId = (lead as unknown as { hubspot_owner_id?: string | null }).hubspot_owner_id;
          // Prioriza o usuário responsável (assigned ou owner) sobre o owner do HubSpot,
          // que muitas vezes guarda apenas o histórico do registro importado.
          const userId = assigned || ownerUserId || null;
          if (userId) {
            return (
              <div className="flex items-center gap-2" title={nameFor(userId)}>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ background: colorFromString(userId) }}
                >
                  {initialsFor(userId)}
                </span>
                <span className="truncate text-sm">{nameFor(userId)}</span>
              </div>
            );
          }
          if (hsId) {
            const o = hsOwners.byId?.get(hsId);
            const name = o
              ? `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() || o.email || hsId
              : hsId;
            return (
              <div className="flex items-center gap-2" title={`${name} (HubSpot)`}>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ background: colorFromString(hsId) }}
                >
                  {(name?.slice(0, 2) ?? "HS").toUpperCase()}
                </span>
                <span className="truncate text-sm">{name}</span>
                <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">
                  HS
                </span>
              </div>
            );
          }
          return <span className="text-muted-foreground">—</span>;
        },
      },
      {
        key: "created_at",
        label: "Criado em",
        className: "text-muted-foreground",
        header: (
          <Th
            sortable
            active={sortKey === "created_at"}
            dir={sortDir}
            onClick={() => onSort("created_at")}
          >
            Criado em
          </Th>
        ),
        render: (lead) => timeAgo(lead.created_at),
      },
      {
        key: "updated_at",
        label: "Atualizado em",
        className: "text-muted-foreground",
        render: (lead) => timeAgo(lead.updated_at),
      },
      {
        key: "source",
        label: "Origem",
        className: "text-muted-foreground",
        render: (lead) => translateFieldValue("source", lead.source) || "—",
      },
      {
        key: "label",
        label: "Rótulo",
        render: (lead) =>
          lead.label ? (
            <Badge variant="secondary" className="font-normal">
              {lead.label}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortKey, sortDir, nameFor, initialsFor],
  );

  return useGridColumns<LeadGridRow>({
    gridKey: "leads",
    columns: leadColumns,
    defaults: DEFAULT_LEAD_COLS,
    customEntity: "leads",
    catalogEntity: "leads",
    sortHeader: autoSortHeader,
  });
}
