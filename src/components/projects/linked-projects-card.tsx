// Lista paginada de projetos ligados a uma empresa ou a um contrato (apenas o que o usuário lê).
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/techhire/ui";
import { Pager } from "@/components/projects/reconciliation/pager";
import {
  getCompanyDeliveryProjects,
  getContractDeliveryProjects,
} from "@/lib/projects/deal-delivery.functions";
import { projectStatusLabel } from "@/lib/projects/delivery-labels";
import { PROJECT_ORIGIN_LABEL } from "@/lib/projects/deal-delivery-labels";

const PAGE = 5;

type Row = {
  id: string;
  name: string;
  status: string;
  origin: string | null;
  dealId?: string | null;
  dealName?: string | null;
  dealHidden?: boolean;
};

export function LinkedProjectsCard(props: { companyId: string } | { contractId: string }) {
  const byCompany = useServerFn(getCompanyDeliveryProjects);
  const byContract = useServerFn(getContractDeliveryProjects);
  const [page, setPage] = useState(1);
  const isCompany = "companyId" in props;
  const id = isCompany ? props.companyId : props.contractId;
  const q = useQuery({
    queryKey: ["linked-projects", isCompany ? "company" : "contract", id, page],
    queryFn: async (): Promise<{ total: number; rows: Row[] }> =>
      isCompany
        ? byCompany({ data: { companyId: id, page, pageSize: PAGE } })
        : byContract({ data: { contractId: id, page, pageSize: PAGE } }),
    placeholderData: keepPreviousData,
  });
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / PAGE));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Projetos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : q.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Não foi possível carregar os projetos.</p>
            <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (q.data?.rows.length ?? 0) === 0 ? (
          <EmptyState
            compact
            title="Nenhum projeto"
            description={
              isCompany
                ? "Nenhum projeto desta empresa que você possa ver."
                : "Nenhum projeto ligado a este contrato que você possa ver."
            }
          />
        ) : (
          <>
            <ul className="divide-y rounded-md border">
              {q.data!.rows.map((r) => (
                <li key={r.id} className="px-3 py-2">
                  <Link
                    to="/projects/$id"
                    params={{ id: r.id }}
                    className="text-sm font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {projectStatusLabel(r.status)}
                    {r.origin ? ` · ${PROJECT_ORIGIN_LABEL[r.origin] ?? r.origin}` : ""}
                  </p>
                  {isCompany && (r.dealId || r.dealHidden) && (
                    <p className="text-xs text-muted-foreground">
                      Negócio:{" "}
                      {r.dealId ? (
                        <Link to="/deals/$id" params={{ id: r.dealId }} className="hover:underline">
                          {r.dealName}
                        </Link>
                      ) : (
                        "sem acesso"
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <Pager
                label={`${q.data!.total} projeto(s)`}
                page={page}
                pages={pages}
                onPage={setPage}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
