import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Circle,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import data from "@/data/qa-test-cases.json";
import {
  BugReportDialog,
  type BugReportQaContext,
} from "@/components/bug-report/bug-report-dialog";

export const Route = createFileRoute("/_authenticated/qa/test-cases")({
  component: QaTestCasesPage,
});

type Status = "todo" | "pass" | "fail" | "skip";
type Case = {
  id: string;
  modulo: string;
  submod: string;
  titulo: string;
  pre: string;
  passos: string[];
  expected: string;
  prio: "P0" | "P1" | "P2" | "P3";
  tipo: string;
  smoke: boolean;
};
type Dataset = { modules: { code: string; name: string; count: number }[]; cases: Case[] };

const DATA = data as unknown as Dataset;
const STORAGE_KEY = "qa.test-cases.status.v1";
const NOTES_KEY = "qa.test-cases.notes.v1";
const BUGS_KEY = "qa.test-cases.bugs.v1";

const PRIO_COLOR: Record<Case["prio"], string> = {
  P0: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  P1: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  P2: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
  P3: "bg-muted text-muted-foreground",
};

const STATUS_META: Record<Status, { label: string; icon: any; cls: string }> = {
  todo: { label: "Pendente", icon: Circle, cls: "text-muted-foreground" },
  pass: { label: "Aprovado", icon: CheckCircle2, cls: "text-green-600" },
  fail: { label: "Falhou", icon: XCircle, cls: "text-red-600" },
  skip: { label: "Pulado", icon: MinusCircle, cls: "text-amber-600" },
};

function useLocalMap(key: string) {
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setMap(JSON.parse(raw));
    } catch {
      /* ignora */
    }
  }, [key]);
  const set = (id: string, value: string) => {
    setMap((prev) => {
      const next = { ...prev, [id]: value };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
      /* ignora */
    }
      return next;
    });
  };
  const reset = () => {
    setMap({});
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignora */
    }
  };
  return { map, set, reset };
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function buildBugDescription(c: Case): string {
  const steps = c.passos.map((p, i) => `<li>${escapeHtml(p)}</li>`).join("");
  return [
    `<p><strong>Caso de teste:</strong> ${escapeHtml(c.id)} — ${escapeHtml(c.titulo)}</p>`,
    `<p><strong>Módulo:</strong> ${escapeHtml(c.modulo)} · ${escapeHtml(c.submod)}</p>`,
    `<p><strong>Prioridade:</strong> ${c.prio} · <strong>Tipo:</strong> ${escapeHtml(c.tipo)}</p>`,
    `<p><strong>Pré-condições:</strong> ${escapeHtml(c.pre)}</p>`,
    `<p><strong>Passos executados:</strong></p><ol>${steps}</ol>`,
    `<p><strong>Resultado esperado:</strong> ${escapeHtml(c.expected)}</p>`,
    `<p><strong>Resultado obtido:</strong> </p><p><em>Descreva aqui o que aconteceu de diferente do esperado.</em></p>`,
  ].join("");
}

function QaTestCasesPage() {
  const { map: statusMap, set: setStatus, reset: resetStatuses } = useLocalMap(STORAGE_KEY);
  const { map: notesMap, set: setNote } = useLocalMap(NOTES_KEY);
  const { map: bugsMap, set: setBugLink } = useLocalMap(BUGS_KEY);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [prioFilter, setPrioFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [smokeOnly, setSmokeOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Bug & Skip modals state
  const [bugOpen, setBugOpen] = useState(false);
  const [bugQaContext, setBugQaContext] = useState<BugReportQaContext | null>(null);
  const [pendingFailCaseId, setPendingFailCaseId] = useState<string | null>(null);

  const [skipOpen, setSkipOpen] = useState(false);
  const [skipCaseId, setSkipCaseId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("");

  const cases = DATA.cases;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (moduleFilter !== "all" && c.modulo !== moduleFilter) return false;
      if (prioFilter !== "all" && c.prio !== prioFilter) return false;
      if (smokeOnly && !c.smoke) return false;
      const s = (statusMap[c.id] as Status) || "todo";
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (q) {
        const hay = `${c.id} ${c.titulo} ${c.submod} ${c.expected} ${c.pre}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cases, search, moduleFilter, prioFilter, statusFilter, smokeOnly, statusMap]);

  const selected = useMemo(
    () => (selectedId ? (cases.find((c) => c.id === selectedId) ?? null) : null),
    [selectedId, cases],
  );

  const selectedIndex = useMemo(
    () => (selectedId ? filtered.findIndex((c) => c.id === selectedId) : -1),
    [filtered, selectedId],
  );

  const goPrev = useCallback(() => {
    if (filtered.length === 0) return;
    const idx = selectedIndex < 0 ? 0 : (selectedIndex - 1 + filtered.length) % filtered.length;
    setSelectedId(filtered[idx].id);
  }, [filtered, selectedIndex]);

  const goNext = useCallback(() => {
    if (filtered.length === 0) return;
    const idx = selectedIndex < 0 ? 0 : (selectedIndex + 1) % filtered.length;
    setSelectedId(filtered[idx].id);
  }, [filtered, selectedIndex]);

  // Keyboard navigation when sheet is open
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (bugOpen || skipOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement | null)?.isContentEditable
      )
        return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, bugOpen, skipOpen, goPrev, goNext]);

  const stats = useMemo(() => {
    const total = cases.length;
    const counts = { pass: 0, fail: 0, skip: 0, todo: 0 };
    for (const c of cases) {
      const s = (statusMap[c.id] as Status) || "todo";
      counts[s]++;
    }
    const done = counts.pass + counts.fail + counts.skip;
    return { total, ...counts, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [cases, statusMap]);

  const handleStatusClick = (c: Case, s: Status) => {
    if (s === "fail") {
      // Close the sheet, open bug dialog with QA context
      setPendingFailCaseId(c.id);
      setBugQaContext({
        testCaseId: c.id,
        testCaseTitle: c.titulo,
        prefillDescriptionHtml: buildBugDescription(c),
      });
      setSelectedId(null);
      setBugOpen(true);
      return;
    }
    if (s === "skip") {
      setSkipCaseId(c.id);
      setSkipReason(notesMap[c.id] || "");
      setSkipOpen(true);
      return;
    }
    setStatus(c.id, s);
  };

  const confirmSkip = () => {
    if (!skipCaseId) return;
    const reason = skipReason.trim();
    if (reason.length < 3) return;
    const prevNote = notesMap[skipCaseId] || "";
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const skipEntry = `[Pulado em ${stamp}] ${reason}`;
    const merged = prevNote ? `${prevNote}\n${skipEntry}` : skipEntry;
    setNote(skipCaseId, merged);
    setStatus(skipCaseId, "skip");
    setSkipOpen(false);
    setSkipCaseId(null);
    setSkipReason("");
  };

  const exportCsv = () => {
    const rows = [
      [
        "ID",
        "Módulo",
        "Sub-módulo",
        "Título",
        "Prioridade",
        "Tipo",
        "Smoke",
        "Status",
        "Chamado",
        "Observações",
      ],
      ...cases.map((c) => [
        c.id,
        c.modulo,
        c.submod,
        c.titulo,
        c.prio,
        c.tipo,
        c.smoke ? "Sim" : "",
        STATUS_META[(statusMap[c.id] as Status) || "todo"].label,
        bugsMap[c.id] || "",
        (notesMap[c.id] || "").replace(/\n/g, " "),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qa-execucao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="QA · Casos de Teste"
        description={`${DATA.cases.length} casos · ${DATA.modules.length} módulos · ${cases.filter((c) => c.smoke).length} marcados como smoke`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Aprovados" value={stats.pass} className="text-green-600" />
        <StatCard label="Falhas" value={stats.fail} className="text-red-600" />
        <StatCard label="Pulados" value={stats.skip} className="text-amber-600" />
        <StatCard label="Pendentes" value={stats.todo} className="text-muted-foreground" />
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span>Progresso da execução</span>
            <span className="font-medium">{stats.pct}%</span>
          </div>
          <Progress value={stats.pct} />
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, título, expectativa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {DATA.modules.map((m) => (
                <SelectItem key={m.code} value={m.name}>
                  {m.name} ({m.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prioFilter} onValueChange={setPrioFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="P0">P0 · Bloqueante</SelectItem>
              <SelectItem value="P1">P1 · Alta</SelectItem>
              <SelectItem value="P2">P2 · Média</SelectItem>
              <SelectItem value="P3">P3 · Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="todo">Pendentes</SelectItem>
              <SelectItem value="pass">Aprovados</SelectItem>
              <SelectItem value="fail">Falhas</SelectItem>
              <SelectItem value="skip">Pulados</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={smokeOnly ? "default" : "outline"}
            onClick={() => setSmokeOnly((v) => !v)}
          >
            Smoke
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="ghost" onClick={resetStatuses}>
            Limpar progresso
          </Button>
        </CardContent>
      </Card>

      {/* Cases list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} caso{filtered.length === 1 ? "" : "s"}
          </CardTitle>
          <CardDescription>
            Clique em um caso para ver passos, registrar resultado e anotações. Use as setas ← →
            para navegar entre os casos filtrados.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map((c) => {
              const s = (statusMap[c.id] as Status) || "todo";
              const Icon = STATUS_META[s].icon;
              return (
                <button
                  key={c.id}
                  className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex gap-3 items-start"
                  onClick={() => setSelectedId(c.id)}
                >
                  <Icon className={`h-5 w-5 mt-0.5 ${STATUS_META[s].cls}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs text-muted-foreground">{c.id}</code>
                      <Badge className={PRIO_COLOR[c.prio]}>{c.prio}</Badge>
                      <Badge variant="outline">{c.tipo}</Badge>
                      {c.smoke && <Badge variant="secondary">smoke</Badge>}
                      {bugsMap[c.id] && (
                        <Badge variant="destructive" className="text-[10px]">
                          chamado vinculado
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">· {c.submod}</span>
                    </div>
                    <div className="font-medium mt-1">{c.titulo}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {c.modulo}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-12 text-center text-muted-foreground text-sm">
                Nenhum caso corresponde aos filtros.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <code className="text-xs text-muted-foreground">{selected.id}</code>
                  <Badge className={PRIO_COLOR[selected.prio]}>{selected.prio}</Badge>
                  <Badge variant="outline">{selected.tipo}</Badge>
                  {selected.smoke && <Badge variant="secondary">smoke</Badge>}
                  {selectedIndex >= 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {selectedIndex + 1} de {filtered.length}
                    </span>
                  )}
                </div>
                <SheetTitle>{selected.titulo}</SheetTitle>
                <SheetDescription>
                  {selected.modulo} · {selected.submod}
                </SheetDescription>
              </SheetHeader>

              {/* Prev / Next nav */}
              <div className="flex items-center justify-between mt-4 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goPrev}
                  disabled={filtered.length <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Atalhos: ← anterior · → próximo
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goNext}
                  disabled={filtered.length <= 1}
                >
                  Próximo <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              <div className="space-y-5 mt-6">
                <Section title="Pré-condições">
                  <p className="text-sm">{selected.pre}</p>
                </Section>
                <Section title="Passos">
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    {selected.passos.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ol>
                </Section>
                <Section title="Resultado esperado">
                  <p className="text-sm">{selected.expected}</p>
                </Section>

                {bugsMap[selected.id] && (
                  <Section title="Chamado vinculado">
                    <p className="text-sm">
                      <code className="text-xs">{bugsMap[selected.id]}</code> — registrado a partir
                      deste caso de teste.
                    </p>
                  </Section>
                )}

                <Section title="Status da execução">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(Object.keys(STATUS_META) as Status[]).map((s) => {
                      const meta = STATUS_META[s];
                      const active =
                        (statusMap[selected.id] as Status) === s ||
                        (!statusMap[selected.id] && s === "todo");
                      const Icon = meta.icon;
                      return (
                        <Button
                          key={s}
                          variant={active ? "default" : "outline"}
                          onClick={() => handleStatusClick(selected, s)}
                          className="justify-start"
                        >
                          <Icon className={`h-4 w-4 mr-2 ${active ? "" : meta.cls}`} />
                          {meta.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Ao marcar <strong>Falhou</strong>, abriremos o formulário de chamado já
                    vinculado a este caso. <strong>Pulado</strong> exige justificativa.
                  </p>
                </Section>

                <Section title="Observações / evidências">
                  <textarea
                    className="w-full min-h-[120px] rounded-md border bg-background p-2 text-sm"
                    placeholder="Anote bugs, links de print, IDs reproduzíveis…"
                    value={notesMap[selected.id] || ""}
                    onChange={(e) => setNote(selected.id, e.target.value)}
                  />
                </Section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Skip reason modal */}
      <Dialog
        open={skipOpen}
        onOpenChange={(o) => {
          if (!o) {
            setSkipOpen(false);
            setSkipCaseId(null);
            setSkipReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pular caso de teste</DialogTitle>
            <DialogDescription>
              Explique por que este caso será pulado (bloqueio, dependência, ambiente, etc.). A
              justificativa fica salva nas observações do caso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="skip-reason">Motivo</Label>
            <textarea
              id="skip-reason"
              className="w-full min-h-[120px] rounded-md border bg-background p-2 text-sm"
              placeholder="Ex.: depende de feature flag X, ambiente sem dados de seed, integração indisponível…"
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Mínimo de 3 caracteres.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSkipOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmSkip} disabled={skipReason.trim().length < 3}>
              Confirmar pulo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bug report dialog wired to the failed test case */}
      <BugReportDialog
        open={bugOpen}
        onOpenChange={(o) => {
          setBugOpen(o);
          if (!o) {
            // Cancelled before submission — leave status untouched
            setBugQaContext(null);
            setPendingFailCaseId(null);
          }
        }}
        qaContext={bugQaContext}
        onSubmitted={({ bugReportId, qaContext }) => {
          const caseId = qaContext?.testCaseId ?? pendingFailCaseId;
          if (!caseId) return;
          setStatus(caseId, "fail");
          if (bugReportId) {
            setBugLink(caseId, bugReportId);
            const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
            const prevNote = notesMap[caseId] || "";
            const entry = `[Falhou em ${stamp}] Chamado: ${bugReportId}`;
            setNote(caseId, prevNote ? `${prevNote}\n${entry}` : entry);
          }
          setBugQaContext(null);
          setPendingFailCaseId(null);
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${className} truncate`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}
