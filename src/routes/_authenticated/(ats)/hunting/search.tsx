// Hunting · Buscar (Unipile) — Fase 2.1.
// Busca pessoas no LinkedIn Classic via Unipile, seleciona e importa pra ATS.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  Search,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatErrorMessage, handleForceReload } from "@/lib/errors/format";
import { AtsPageHeader, EmptyState } from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  searchLinkedinPeople,
  importLinkedinSearchResults,
  type NormalizedSearchHit,
} from "@/lib/ats/unipile-hunting.functions";

interface ImportProgress {
  total: number;
  done: number;
  created: number;
  deduped: number;
  enriched: number;
  errors: number;
  current?: string;
  finished: boolean;
}

export const Route = createFileRoute("/_authenticated/(ats)/hunting/search")({
  component: HuntingSearchPage,
});

interface FormState {
  keywords: string;
  location: string;
  industry: string;
  current_company: string;
  school: string;
  network_F: boolean;
  network_S: boolean;
  network_O: boolean;
}

const EMPTY: FormState = {
  keywords: "",
  location: "",
  industry: "",
  current_company: "",
  school: "",
  network_F: false,
  network_S: true,
  network_O: false,
};

function HuntingSearchPage() {
  const qc = useQueryClient();
  const search = useServerFn(searchLinkedinPeople);
  const importFn = useServerFn(importLinkedinSearchResults);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [hits, setHits] = useState<NormalizedSearchHit[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<string | null>(null);
  const [warning, setWarning] = useState<{ title: string; message: string } | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const cancelRef = useRef(false);

  const searchMut = useMutation({
    mutationFn: async (input: { cursor?: string }) => {
      const network: ("F" | "S" | "O")[] = [];
      if (form.network_F) network.push("F");
      if (form.network_S) network.push("S");
      if (form.network_O) network.push("O");
      return await search({
        data: {
          keywords: form.keywords || undefined,
          location: form.location || undefined,
          industry: form.industry || undefined,
          current_company: form.current_company || undefined,
          school: form.school || undefined,
          network: network.length ? network : undefined,
          cursor: input.cursor,
          limit: 20,
        },
      });
    },
    onSuccess: (res, vars) => {
      if (!res.ok) {
        setWarning({ title: codeLabel(res.code), message: res.message });
        return;
      }
      setWarning(null);
      setHits((prev) => (vars.cursor ? [...prev, ...res.hits] : res.hits));
      setCursor(res.cursor ?? null);
      if (res.hits.length === 0 && !vars.cursor) {
        toast.info("Nenhum resultado para os filtros informados.");
      }
    },
    onError: (e: Error) => {
      if (handleForceReload(e)) return;
      toast.error(formatErrorMessage(e, "Falha na busca."));
    },
  });

  async function runImport() {
    const items = hits.filter((h) => h.linkedin_url && selected.has(h.linkedin_url));
    if (!items.length) return;

    cancelRef.current = false;
    setProgress({
      total: items.length,
      done: 0,
      created: 0,
      deduped: 0,
      enriched: 0,
      errors: 0,
      finished: false,
    });

    let created = 0;
    let deduped = 0;
    let enriched = 0;
    let errors = 0;

    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) break;
      const h = items[i];
      setProgress((p) => (p ? { ...p, current: h.full_name } : p));
      try {
        const r = await importFn({
          data: {
            items: [
              {
                linkedin_url: h.linkedin_url as string,
                full_name: h.full_name,
                headline: h.headline,
                location: h.location,
                current_company: h.current_company,
                current_position: h.current_position,
                public_identifier: h.public_identifier,
                photo_url: h.photo_url,
              },
            ],
          },
        });
        created += r.created;
        deduped += r.deduped;
        enriched += r.enriched;
        errors += r.errors.length;
      } catch (e) {
        if (handleForceReload(e)) return;
        errors += 1;
        toast.error(`Falhou: ${h.full_name} — ${formatErrorMessage(e)}`);
      }
      setProgress({
        total: items.length,
        done: i + 1,
        created,
        deduped,
        enriched,
        errors,
        current: h.full_name,
        finished: false,
      });
    }

    setProgress((p) => (p ? { ...p, finished: true, current: undefined } : p));
    toast.success(
      `Importação concluída · ${created} novos · ${deduped} já existiam · ${enriched} enriquecidos${errors ? ` · ${errors} falhas` : ""}`,
    );
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["hunting-captures"] });
    qc.invalidateQueries({ queryKey: ["hunting-stats"] });
  }

  function cancelImport() {
    cancelRef.current = true;
  }

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === hits.length) setSelected(new Set());
    else setSelected(new Set(hits.map((h) => h.linkedin_url ?? "").filter(Boolean)));
  }

  const importing = !!progress && !progress.finished;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Hunting"
        title="Buscar no LinkedIn (Unipile)"
        description="Pesquisa direta na API do LinkedIn via Unipile, com throttling humano. Selecione e importe pro TechHire."
      />

      {/* Filtros */}
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Palavras-chave"
            value={form.keywords}
            onChange={(v) => setForm({ ...form, keywords: v })}
            placeholder='ex.: "engenheiro de dados sênior"'
          />
          <Field
            label="Localização"
            value={form.location}
            onChange={(v) => setForm({ ...form, location: v })}
            placeholder="São Paulo, Brasil"
          />
          <Field
            label="Empresa atual"
            value={form.current_company}
            onChange={(v) => setForm({ ...form, current_company: v })}
            placeholder="Nubank"
          />
          <Field
            label="Setor"
            value={form.industry}
            onChange={(v) => setForm({ ...form, industry: v })}
            placeholder="Software"
          />
          <Field
            label="Escola"
            value={form.school}
            onChange={(v) => setForm({ ...form, school: v })}
            placeholder="USP"
          />
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Rede</Label>
            <div className="flex items-center gap-4 pt-1.5">
              <NetCheckbox
                label="1º"
                checked={form.network_F}
                onChange={(v) => setForm({ ...form, network_F: v })}
              />
              <NetCheckbox
                label="2º"
                checked={form.network_S}
                onChange={(v) => setForm({ ...form, network_S: v })}
              />
              <NetCheckbox
                label="3º+"
                checked={form.network_O}
                onChange={(v) => setForm({ ...form, network_O: v })}
              />
            </div>
          </div>
          <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-3">
            <Button variant="ghost" size="sm" onClick={() => setForm(EMPTY)}>
              Limpar
            </Button>
            <Button
              onClick={() => {
                setHits([]);
                setCursor(null);
                searchMut.mutate({});
              }}
              disabled={searchMut.isPending}
            >
              {searchMut.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1 h-4 w-4" />
              )}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {warning && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{warning.title}</AlertTitle>
          <AlertDescription>
            {warning.message}{" "}
            {warning.title.includes("Conta") && (
              <Link to="/settings/integrations/linkedin" className="underline">
                Ir para integração
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {progress && (
        <ImportProgressCard
          progress={progress}
          onCancel={cancelImport}
          onDismiss={() => setProgress(null)}
        />
      )}

      {/* Resultados */}
      {hits.length === 0 && !searchMut.isPending ? (
        <EmptyState
          icon={Search}
          title="Nenhum resultado ainda"
          description="Ajuste os filtros e execute uma busca. O throttling humano respeita janela horária e budget diário definidos em /settings/integrations/linkedin."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={hits.length > 0 && selected.size === hits.length}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                />
                <span className="text-xs text-muted-foreground">
                  {selected.size > 0
                    ? `${selected.size} selecionados de ${hits.length}`
                    : `${hits.length} resultados`}
                </span>
              </div>
              <Button size="sm" onClick={runImport} disabled={selected.size === 0 || importing}>
                {importing ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                Importar selecionados
              </Button>
            </div>
            <div className="divide-y">
              {hits.map((h) => {
                const key = h.linkedin_url ?? h.public_identifier ?? h.full_name;
                const checked = h.linkedin_url ? selected.has(h.linkedin_url) : false;
                return (
                  <div key={key} className="flex items-start gap-3 p-4">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => h.linkedin_url && toggle(h.linkedin_url)}
                      disabled={!h.linkedin_url}
                      aria-label="Selecionar"
                    />
                    {h.photo_url ? (
                      <img
                        src={h.photo_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{h.full_name}</p>
                        {h.network_distance && (
                          <Badge variant="outline" className="text-[10px]">
                            {h.network_distance}
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {h.current_position ?? h.headline ?? "—"}
                        {h.current_company ? ` · ${h.current_company}` : ""}
                      </p>
                      {h.location && <p className="text-xs text-muted-foreground">{h.location}</p>}
                    </div>
                    {h.linkedin_url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={h.linkedin_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          Abrir
                        </a>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            {cursor && (
              <div className="flex justify-center border-t border-border-subtle p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => searchMut.mutate({ cursor })}
                  disabled={searchMut.isPending}
                >
                  {searchMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  Carregar mais
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImportProgressCard({
  progress,
  onCancel,
  onDismiss,
}: {
  progress: ImportProgress;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const running = !progress.finished;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {running ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            )}
            <p className="truncate text-sm font-medium">
              {running
                ? `Importando ${progress.done + 1} de ${progress.total}${progress.current ? ` · ${progress.current}` : ""}`
                : `Importação concluída · ${progress.done} de ${progress.total}`}
            </p>
          </div>
          {running ? (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <X className="mr-1 h-3.5 w-3.5" /> Cancelar
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              <X className="mr-1 h-3.5 w-3.5" /> Fechar
            </Button>
          )}
        </div>
        <Progress value={pct} className="h-1.5" />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">Novos: {progress.created}</Badge>
          <Badge variant="outline">Já existiam: {progress.deduped}</Badge>
          <Badge
            variant="outline"
            className="border-emerald-300 text-emerald-700 dark:text-emerald-400"
          >
            <Sparkles className="mr-1 h-3 w-3" /> Enriquecidos: {progress.enriched}
          </Badge>
          {progress.errors > 0 && <Badge variant="destructive">Falhas: {progress.errors}</Badge>}
          <span className="ml-auto text-muted-foreground">{pct}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{props.label}</Label>
      <Input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    </div>
  );
}

function NetCheckbox(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <Checkbox checked={props.checked} onCheckedChange={(v) => props.onChange(Boolean(v))} />
      {props.label}
    </label>
  );
}

function codeLabel(code: string): string {
  switch (code) {
    case "missing_credentials":
      return "Unipile não configurado";
    case "account_disconnected":
      return "Conta LinkedIn desconectada";
    case "out_of_window":
      return "Fora da janela horária";
    case "daily_budget_reached":
      return "Budget diário atingido";
    case "rate_limited":
      return "Rate limit do provider";
    default:
      return "Erro na busca";
  }
}
