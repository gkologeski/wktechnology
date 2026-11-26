import { useImportAccess } from "./use-import-access";
import { assertImportUiAccess } from "./import-access";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, FileSearch, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { listImportJourneyRecords } from "@/lib/projects/imports/import-journey.functions";
import type {
  ImportProvider,
  JourneyRecord,
  JourneySource,
} from "@/lib/projects/imports/import-journey";
import {
  count,
  PROVIDER_LABEL,
  timestamp,
  importEntityLabel,
  type ImportQueryScope,
} from "./import-format";
import { JourneyNotice, RecordBadge } from "./import-journey-ui";

export function ImportRecords({
  issuesOnly,
  sources,
  scope,
  readOnly,
  onImport,
  onOpen,
  legacyPending = false,
}: {
  issuesOnly: boolean;
  sources: JourneySource[];
  scope: ImportQueryScope;
  readOnly: boolean;
  onImport: () => void;
  onOpen: (id: string) => void;
  legacyPending?: boolean;
}) {
  const access = useImportAccess(scope);
  const load = useServerFn(listImportJourneyRecords);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<ImportProvider | "all">("all");
  const [status, setStatus] = useState<JourneyRecord["status"] | "all">("all");
  const [page, setPage] = useState(0);
  const [mine, setMine] = useState(false);
  const term = useDebouncedValue(query, 300);
  const records = useQuery({
    queryKey: [
      "project-import-journey",
      ...scope,
      "records",
      issuesOnly,
      provider,
      status,
      term,
      page,
      mine,
    ],
    queryFn: () => {
      assertImportUiAccess(access, provider === "all" ? undefined : provider);
      return load({
        data: {
          provider: provider === "all" ? undefined : provider,
          status: status === "all" ? undefined : status,
          q: term,
          page,
          issuesOnly,
          assigneeId: mine ? scope[0] : undefined,
        },
      });
    },
    enabled: access.canRead(provider === "all" ? undefined : provider),
    retry: false,
    placeholderData: undefined,
  });
  const rows = records.data?.records ?? [];
  const total = records.data?.total;
  if (!access.canRead(provider === "all" ? undefined : provider))
    return (
      <p role="alert" className="py-6">
        Sem permissão para consultar os registros desta origem.
      </p>
    );
  return (
    <section
      className="py-6"
      aria-label={issuesOnly ? "Pendências de importação" : "Registros recebidos"}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {issuesOnly ? "Pendências de conferência" : "Todos os registros recebidos"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {issuesOnly
              ? "Um registro pode ter mais de um aviso. Conferir não apaga o valor original."
              : "Consulte o original, suas versões e a situação no TechProjects."}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onImport}>
          Voltar à importação <ArrowRight aria-hidden />
        </Button>
      </div>
      {issuesOnly && (
        <JourneyNotice warning>
          Não é preciso excluir dados para concluir. Registre a conferência ou vincule o cadastro
          que estiver faltando. Aprovação de horas e liberação financeira continuam separadas.
        </JourneyNotice>
      )}
      <div className="my-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Buscar registros importados"
            className="pl-9"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Buscar registro, pessoa ou origem"
          />
        </div>
        <Select
          value={provider}
          onValueChange={(value) => {
            setProvider(value as ImportProvider | "all");
            setPage(0);
          }}
        >
          <SelectTrigger aria-label="Filtrar por origem" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {sources
              .filter((s) => s.canView)
              .map((s) => (
                <SelectItem key={s.provider} value={s.provider}>
                  {PROVIDER_LABEL[s.provider]}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {!issuesOnly && (
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as JourneyRecord["status"] | "all");
              setPage(0);
            }}
          >
            <SelectTrigger aria-label="Filtrar por situação" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              <SelectItem value="received">Recebido</SelectItem>
              <SelectItem value="ready">Pronto para uso</SelectItem>
              <SelectItem value="pending">Com pendência</SelectItem>
            </SelectContent>
          </Select>
        )}
        {issuesOnly && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={mine}
              onCheckedChange={(checked) => {
                setMine(checked === true);
                setPage(0);
              }}
            />
            Minhas pendências
          </label>
        )}
        <p className="text-xs tabular-nums text-muted-foreground sm:ml-auto" aria-live="polite">
          {records.isFetching
            ? "Consultando…"
            : total === undefined
              ? "Contagem indisponível"
              : `${count(total)} registros`}
        </p>
      </div>
      {records.isError ? (
        <div role="alert" className="space-y-3 py-6 text-sm">
          <p>
            Não foi possível carregar os registros. Uma falha de consulta não significa que não há
            dados.
          </p>
          <Button variant="outline" onClick={() => void records.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : records.isPending ? (
        <p role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Carregando registros…
        </p>
      ) : rows.length ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registro</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>{issuesOnly ? "O que conferir" : "Situação"}</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <strong className="block max-w-md text-sm font-medium">{record.label}</strong>
                    <small className="mt-1 block text-xs text-muted-foreground">
                      {record.externalId} · {timestamp(record.receivedAt)}
                    </small>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap text-xs">
                      {PROVIDER_LABEL[record.provider]}
                    </span>
                    <small className="mt-1 block text-xs text-muted-foreground">
                      {record.sourceName}
                    </small>
                  </TableCell>
                  <TableCell className="text-xs">{importEntityLabel(record.entity)}</TableCell>
                  <TableCell>
                    <RecordBadge record={record} issuesOnly={issuesOnly} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" size="sm" onClick={() => onOpen(record.id)}>
                      {issuesOnly && !readOnly ? "Conferir" : "Ver registro"}{" "}
                      <ArrowRight aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              Página {page + 1} · {count(rows.length)} registros nesta página
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 0 || records.isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                <ArrowLeft aria-hidden />
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={
                  records.isFetching ||
                  !records.data ||
                  (page + 1) * records.data.pageSize >= records.data.total
                }
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="py-14 text-center">
          <FileSearch className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
          <h3 className="font-medium">
            {query || provider !== "all" || status !== "all"
              ? "Nenhum registro com estes filtros"
              : issuesOnly
                ? "Nenhuma pendência encontrada"
                : legacyPending
                  ? "Histórico anterior aguardando organização"
                  : "Nenhum registro recebido ainda"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {issuesOnly
              ? "As inconsistências encontradas nas origens aparecerão aqui, sem que os originais sejam descartados."
              : legacyPending
                ? "Inicie a jornada para preservar e listar os registros já importados. Nenhum apontamento será apagado."
                : "Comece pela jornada de importação. Os registros recebidos ficam disponíveis mesmo quando há erro na origem."}
          </p>
        </div>
      )}
    </section>
  );
}
