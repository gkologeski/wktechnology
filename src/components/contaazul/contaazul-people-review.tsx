import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, EyeOff, RefreshCw, RotateCcw, Sparkles, Users } from "lucide-react";

import { EmptyState, SectionHeader } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  contaAzulPeopleDecide,
  contaAzulPeopleList,
  contaAzulPeopleRefresh,
} from "@/lib/integrations/contaazul.functions";

type Tab = "suggested" | "review" | "new" | "linked" | "decided";
const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  {
    id: "suggested",
    label: "Sugeridos",
    hint: "Nome muito parecido com um único cadastro. Confirme para vincular.",
  },
  {
    id: "review",
    label: "Revisar",
    hint: "Mais de um cadastro possível ou semelhança média. Escolha o correto.",
  },
  {
    id: "new",
    label: "Novas",
    hint: "Sem cadastro parecido. Entram como somente financeiro, fora do TechSales.",
  },
  {
    id: "linked",
    label: "Vinculadas",
    hint: "CNPJ, e-mail ou nome idêntico a um cadastro existente.",
  },
  { id: "decided", label: "Decididas", hint: "Vínculos confirmados por você e itens ignorados." },
];

type Candidate = { id: string; name: string; score: number | null };
type Row = {
  id: string;
  name: string;
  person_kind: string;
  profile: string | null;
  document: string | null;
  status: string;
  match_by: string | null;
  score: number | null;
  candidates: unknown;
  local_company_id: string | null;
  local_contact_id: string | null;
};

const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(Number(n) * 100)}%`);
const MATCH_LABEL: Record<string, string> = {
  document: "CNPJ",
  email: "E-mail",
  name: "Nome idêntico",
  similar_name: "Nome parecido",
  manual: "Escolhido por você",
  confirmed_suggestion: "Sugestão confirmada",
  new_finance: "Nova (somente financeiro)",
};

/** Revisão de clientes/fornecedores do Conta Azul. Nada é vinculado sem confirmação. */
export function ContaAzulPeopleReview({
  canManage,
  connected,
}: {
  canManage: boolean;
  connected: boolean;
}) {
  const qc = useQueryClient();
  const list = useServerFn(contaAzulPeopleList);
  const refresh = useServerFn(contaAzulPeopleRefresh);
  const decide = useServerFn(contaAzulPeopleDecide);
  const [tab, setTab] = useState<Tab>("suggested");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["contaazul", "people", tab, search, page],
    queryFn: () => list({ data: { tab, search, page } }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    setSelected(new Set());
    void qc.invalidateQueries({ queryKey: ["contaazul", "people"] });
  };
  const refreshMut = useMutation({
    mutationFn: () => refresh({}),
    onSuccess: (r) => {
      toast.success(`Lista atualizada: ${r.counts["total"] ?? 0} clientes e fornecedores lidos.`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decideMut = useMutation({
    mutationFn: (v: {
      ids: string[];
      action: "confirm" | "choose" | "new" | "ignore" | "reopen";
      localId?: string;
    }) => decide({ data: v }),
    onSuccess: (r) => {
      toast.success(`${r.changed} item(ns) atualizados.`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (query.data?.rows ?? []) as Row[];
  const totals = query.data?.totals ?? {};
  const count = (t: Tab) =>
    t === "decided" ? (totals["confirmed"] ?? 0) + (totals["ignored"] ?? 0) : (totals[t] ?? 0);
  const busy = decideMut.isPending || refreshMut.isPending;
  const ids = [...selected];
  const total = query.data?.total ?? 0;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <SectionHeader
          title="Clientes e fornecedores"
          description="Compare os cadastros do Conta Azul com as Empresas e Contatos do TechERP. Os que não existirem entram como somente financeiro e não aparecem no TechSales."
          action={
            canManage ? (
              <Button
                variant="outline"
                onClick={() => refreshMut.mutate()}
                disabled={!connected || busy}
                aria-label="Ler clientes e fornecedores do Conta Azul e recalcular sugestões"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${refreshMut.isPending ? "animate-spin" : ""}`}
                />
                {refreshMut.isPending ? "Lendo o Conta Azul..." : "Atualizar lista"}
              </Button>
            ) : null
          }
        />

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as Tab);
            setPage(0);
            setSelected(new Set());
          }}
        >
          <TabsList className="flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
                <Badge variant="secondary" className="ml-2">
                  {count(t.id)}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">{TABS.find((t) => t.id === tab)?.hint}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Buscar por nome"
            placeholder="Buscar por nome"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="max-w-xs"
          />
          {canManage && ids.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-live="polite">
              <span className="text-sm text-muted-foreground">{ids.length} selecionado(s)</span>
              {(tab === "suggested" || tab === "linked") && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => decideMut.mutate({ ids, action: "confirm" })}
                >
                  <Check className="mr-1 h-4 w-4" /> Confirmar vínculo
                </Button>
              )}
              {tab !== "decided" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => decideMut.mutate({ ids, action: "new" })}
                >
                  <Sparkles className="mr-1 h-4 w-4" /> Criar como somente financeiro
                </Button>
              )}
              {tab !== "decided" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => decideMut.mutate({ ids, action: "ignore" })}
                >
                  <EyeOff className="mr-1 h-4 w-4" /> Ignorar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => decideMut.mutate({ ids, action: "reopen" })}
                >
                  <RotateCcw className="mr-1 h-4 w-4" /> Reabrir
                </Button>
              )}
            </div>
          )}
        </div>

        {query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState
            title="Não foi possível carregar a lista"
            description={(query.error as Error).message}
            action={
              <Button variant="outline" onClick={() => void query.refetch()}>
                Tentar novamente
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={Object.keys(totals).length ? "Nada nesta aba" : "Lista ainda não gerada"}
            description={
              Object.keys(totals).length
                ? "Troque de aba ou ajuste a busca."
                : "Clique em Atualizar lista para ler os clientes e fornecedores do Conta Azul."
            }
          />
        ) : (
          <div className="divide-y rounded-md border">
            {canManage && (
              <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground">
                <Checkbox
                  aria-label="Selecionar todos desta página"
                  checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                  onCheckedChange={(v) =>
                    setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())
                  }
                />
                Selecionar página
              </div>
            )}
            {rows.map((r) => {
              const cands = (Array.isArray(r.candidates) ? r.candidates : []) as Candidate[];
              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-2 px-3 py-3 md:flex-row md:items-start"
                >
                  {canManage && (
                    <Checkbox
                      aria-label={`Selecionar ${r.name}`}
                      checked={selected.has(r.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(selected);
                        if (v) next.add(r.id);
                        else next.delete(r.id);
                        setSelected(next);
                      }}
                      className="mt-1"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      <Badge variant="outline">{r.profile ?? "—"}</Badge>
                      <Badge variant="outline">
                        {r.person_kind === "company" ? "Empresa" : "Pessoa física"}
                      </Badge>
                      {r.status === "ignored" && <Badge variant="secondary">Ignorado</Badge>}
                      {r.match_by && (
                        <Badge variant="secondary">{MATCH_LABEL[r.match_by] ?? r.match_by}</Badge>
                      )}
                    </div>
                    {r.document && (
                      <p className="text-xs text-muted-foreground">Documento: {r.document}</p>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 md:w-1/2">
                    {cands.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        Sem cadastro parecido no TechERP.
                      </span>
                    ) : (
                      cands.map((c) => {
                        const chosen = c.id === (r.local_company_id ?? r.local_contact_id);
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm"
                          >
                            <a
                              className="truncate underline-offset-2 hover:underline"
                              href={
                                r.person_kind === "company"
                                  ? `/companies/${c.id}`
                                  : `/contacts/${c.id}`
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              {c.name || "(sem nome)"}
                            </a>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="text-xs text-muted-foreground">{pct(c.score)}</span>
                              {chosen ? (
                                <Badge>Vinculado</Badge>
                              ) : (
                                canManage &&
                                r.status !== "confirmed" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() =>
                                      decideMut.mutate({
                                        ids: [r.id],
                                        action: "choose",
                                        localId: c.id,
                                      })
                                    }
                                  >
                                    É este
                                  </Button>
                                )
                              )}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {total > 50 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground">
              {page * 50 + 1}–{Math.min(total, page * 50 + 50)} de {total}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={(page + 1) * 50 >= total}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
