import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import { AlertTriangle, CheckCircle2, ListChecks, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  EmptyState,
  FormSection,
  MetricCard,
  PageHeader,
  SectionHeader,
  Skeletons,
} from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import {
  getPhoneSettings,
  listPhoneReview,
  updatePhoneCountry,
} from "@/lib/phone/phone-settings.functions";
import {
  PHONE_CLASS_LABEL,
  PHONE_FIELD_LABEL,
  PHONE_REVIEW_CLASSES,
  summarizePhoneRun,
  type PhoneReviewClass,
} from "@/lib/phone/phone-review";
import { PhoneReviewRecordLink } from "@/components/phone/phone-review-record-link";
import { PHONE_COUNTRY_QUERY_KEY } from "@/components/phone/phone-country-provider";

export const Route = createFileRoute("/_authenticated/settings/phones")({
  component: PhonesSettingsPage,
  head: () => ({
    meta: [
      { title: "Telefones — Configurações" },
      {
        name: "description",
        content: "País padrão dos telefones e revisão dos números fora do padrão internacional.",
      },
    ],
  }),
});

const nf = new Intl.NumberFormat("pt-BR");

function PhonesSettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getPhoneSettings);
  const saveFn = useServerFn(updatePhoneCountry);
  const listFn = useServerFn(listPhoneReview);
  const [filter, setFilter] = useState<PhoneReviewClass | "all">("all");
  const [page, setPage] = useState(0);
  const [draftCountry, setDraftCountry] = useState<string | null>(null);

  const settingsQ = useQuery({ queryKey: ["phone-settings"], queryFn: () => getFn() });
  const runId = settingsQ.data?.run?.id ?? null;
  const reviewQ = useQuery({
    queryKey: ["phone-review", runId, filter, page],
    enabled: !!runId && !!settingsQ.data?.isAdmin,
    queryFn: () =>
      listFn({
        data: { runId: runId!, page, classification: filter === "all" ? undefined : filter },
      }),
  });

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames(["pt-BR"], { type: "region" });
    return getCountries()
      .map((c) => ({ code: c, label: `${names.of(c) ?? c} (+${getCountryCallingCode(c)})` }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, []);

  const saveMut = useMutation({
    mutationFn: (country: string) => saveFn({ data: { country } }),
    onSuccess: () => {
      toast.success("País padrão atualizado");
      setDraftCountry(null);
      void qc.invalidateQueries({ queryKey: ["phone-settings"] });
      void qc.invalidateQueries({ queryKey: PHONE_COUNTRY_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (settingsQ.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeletons.Card />
        <Skeletons.MetricsGrid />
        <Skeletons.Card />
      </div>
    );
  }
  if (settingsQ.isError || !settingsQ.data) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar as configurações de telefone"
          description="Verifique sua conexão e tente novamente."
          action={
            <Button variant="outline" onClick={() => settingsQ.refetch()}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  const s = settingsQ.data;
  const country = draftCountry ?? s.country;
  const summary = s.run ? summarizePhoneRun(s.run.counts, s.run.applied) : null;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Telefones"
        description="Todo telefone é gravado no padrão internacional E.164 (+código do país e número). Aqui você define o país usado para números digitados sem o código e acompanha os números antigos que precisam de revisão."
      />

      <FormSection
        title="País padrão para números novos"
        description="Usado só quando alguém digita um número sem +código do país. Não muda números já gravados nem define o país de dados antigos."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full max-w-sm space-y-1.5">
            <Label htmlFor="phone-country">País</Label>
            <Select
              value={country}
              onValueChange={setDraftCountry}
              disabled={!s.isAdmin || saveMut.isPending}
            >
              <SelectTrigger id="phone-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={
              !s.isAdmin || !draftCountry || draftCountry === s.country || saveMut.isPending
            }
            onClick={() => draftCountry && saveMut.mutate(draftCountry)}
          >
            {saveMut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
        {!s.isAdmin && (
          <p className="mt-2 text-xs text-muted-foreground">
            Só administradores do workspace podem alterar o país padrão.
          </p>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Proteção extra do banco para gravações diretas:{" "}
          {s.strict ? "ligada" : "desligada (será ligada depois da publicação)"}.
        </p>
      </FormSection>

      {!s.isAdmin ? null : !summary ? (
        <EmptyState
          icon={Phone}
          title="Nenhuma revisão de telefones feita neste workspace"
          description="Os números novos já entram no padrão. Os antigos ainda não foram analisados."
        />
      ) : (
        <>
          <section className="space-y-3">
            <SectionHeader
              title="Situação dos números já gravados"
              description={
                s.run?.finishedAt
                  ? `Última correção: ${new Date(s.run.finishedAt).toLocaleString("pt-BR")}.`
                  : undefined
              }
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Telefones analisados" value={nf.format(summary.total)} />
              <MetricCard
                label="Padronizados agora"
                value={nf.format(summary.applied)}
                icon={CheckCircle2}
                tone="positive"
                hint="Valor original guardado para desfazer"
              />
              <MetricCard label="Já estavam no padrão" value={nf.format(summary.canonical)} />
              <MetricCard
                label="Em revisão"
                value={nf.format(summary.pending)}
                icon={ListChecks}
                tone={summary.pending ? "warning" : "neutral"}
                hint="Não alterados: falta país, número inválido ou ambíguo"
              />
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campo</TableHead>
                    <TableHead className="text-right">Analisados</TableHead>
                    <TableHead className="text-right">Padronizados</TableHead>
                    <TableHead className="text-right">Já no padrão</TableHead>
                    <TableHead className="text-right">Em revisão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.rows.map((r) => (
                    <TableRow key={r.field}>
                      <TableCell>{PHONE_FIELD_LABEL[r.field] ?? r.field}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {nf.format(r.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {nf.format(r.applied)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {nf.format(r.canonical)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {nf.format(r.pending)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader
              title="Fila de revisão"
              description="Números mostrados com máscara. Corrija na ficha do registro, informando o país."
              action={
                <Select
                  value={filter}
                  onValueChange={(v) => {
                    setFilter(v as PhoneReviewClass | "all");
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-64" aria-label="Filtrar motivo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os motivos</SelectItem>
                    {PHONE_REVIEW_CLASSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {PHONE_CLASS_LABEL[c] ?? c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            {reviewQ.isLoading ? (
              <Skeletons.Card />
            ) : reviewQ.isError ? (
              <EmptyState
                icon={AlertTriangle}
                title="Não foi possível carregar a fila de revisão"
                action={
                  <Button variant="outline" onClick={() => reviewQ.refetch()}>
                    Tentar novamente
                  </Button>
                }
              />
            ) : !reviewQ.data?.items.length ? (
              <EmptyState compact icon={CheckCircle2} title="Nada para revisar com este filtro" />
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Registro</TableHead>
                        <TableHead>Campo</TableHead>
                        <TableHead>Valor gravado</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Detalhe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewQ.data.items.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="max-w-[16rem]">
                            <PhoneReviewRecordLink item={i} />
                          </TableCell>
                          <TableCell>
                            {PHONE_FIELD_LABEL[`${i.table}.${i.column}`] ?? i.table}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{i.masked}</TableCell>
                          <TableCell>
                            {PHONE_CLASS_LABEL[i.classification] ?? i.classification}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {i.reason ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span aria-live="polite">
                    {nf.format(reviewQ.data.total)} item(ns) · página {page + 1} de{" "}
                    {Math.max(1, Math.ceil(reviewQ.data.total / reviewQ.data.pageSize))}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(page + 1) * reviewQ.data.pageSize >= reviewQ.data.total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
