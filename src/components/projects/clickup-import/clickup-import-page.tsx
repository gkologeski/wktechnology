// Importador ClickUp -> TechProjects: leitura, revisão (organização e responsáveis), aplicação e desfazer.
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Download, ListChecks, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  SectionHeader,
  StatusBadge,
} from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { HrScreenAccess } from "@/components/hr-access";
import {
  getClickUpImportStatus,
  getClickUpImportTargets,
  runClickUpImportStep,
  setClickUpGroup,
  setClickUpPerson,
  startClickUpCollect,
  stepClickUpCollect,
} from "@/lib/integrations/clickup/clickup-import.functions";

type Group = {
  id: string;
  team_name: string;
  space_name: string;
  folder_name: string | null;
  list_name: string;
  task_count: number;
  closed_count: number;
  action: "import" | "skip";
  reason: string | null;
  target_space_id: string | null;
  new_space_name: string | null;
  target_project_id: string | null;
  new_project_name: string | null;
  erp_list_name: string;
  erp_list_id: string | null;
};
type Person = {
  clickup_user_id: number;
  username: string | null;
  email: string | null;
  task_count: number;
  user_id: string | null;
  status: "confirmed" | "suggested" | "unmatched" | "ignored";
  match_reason: string | null;
};
type Run = {
  id: string;
  status: string;
  counts: Record<string, number>;
  applied_at: string | null;
};
type Ref = { id: string; name: string };

const RUN_LABEL: Record<string, { label: string; tone: "open" | "onhold" | "closed" | "draft" }> = {
  collecting: { label: "Lendo o ClickUp", tone: "onhold" },
  planned: { label: "Prévia pronta para revisão", tone: "draft" },
  applying: { label: "Importando", tone: "onhold" },
  applied: { label: "Importado", tone: "open" },
  rolling_back: { label: "Desfazendo", tone: "onhold" },
  rolled_back: { label: "Importação desfeita", tone: "closed" },
  failed: { label: "Falhou", tone: "closed" },
};
const PERSON_LABEL: Record<Person["status"], string> = {
  confirmed: "Vinculado",
  suggested: "Sugestão a confirmar",
  unmatched: "Sem vínculo",
  ignored: "Ignorado",
};
const REASON_LABEL: Record<string, string> = {
  email: "mesmo e-mail",
  techpeople_email: "e-mail do TechPeople",
  local_part: "nome do e-mail parecido",
  manual: "escolha manual",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (n: number) => n.toLocaleString("pt-BR");

export function ClickUpImportPage() {
  return (
    <HrScreenAccess resources={["techprojects.clickup_import"]}>
      <ClickUpImportContent />
    </HrScreenAccess>
  );
}

function ClickUpImportContent() {
  const qc = useQueryClient();
  const status = useServerFn(getClickUpImportStatus);
  const targets = useServerFn(getClickUpImportTargets);
  const start = useServerFn(startClickUpCollect);
  const step = useServerFn(stepClickUpCollect);
  const run = useServerFn(runClickUpImportStep);
  const q = useQuery({ queryKey: ["clickup-import"], queryFn: () => status() });
  const t = useQuery({ queryKey: ["clickup-import-targets"], queryFn: () => targets() });
  const [busy, setBusy] = useState<null | { label: string; pct: number | null }>(null);
  const [confirm, setConfirm] = useState<null | "apply" | "rollback">(null);
  const stopRef = useRef(false);

  const data = q.data;
  const r = (data?.run ?? null) as Run | null;
  const groups = (data?.groups ?? []) as Group[];
  const people = (data?.people ?? []) as Person[];
  const canManage = Boolean(data?.canManage);
  const refresh = () => qc.invalidateQueries({ queryKey: ["clickup-import"] });

  const totals = useMemo(() => {
    const imp = groups.filter((g) => g.action === "import");
    return {
      lists: groups.length,
      tasks: imp.reduce((s, g) => s + g.task_count, 0),
      skipped: groups.filter((g) => g.action === "skip").reduce((s, g) => s + g.task_count, 0),
      newProjects: new Set(imp.filter((g) => !g.target_project_id).map((g) => g.new_project_name))
        .size,
      pendingPeople: people.filter((p) => p.status === "suggested" || p.status === "unmatched")
        .length,
    };
  }, [groups, people]);

  async function collect() {
    stopRef.current = false;
    setBusy({ label: "Lendo a estrutura do ClickUp…", pct: null });
    try {
      const s = await start();
      let cursor = s.cursor;
      for (;;) {
        if (stopRef.current) break;
        const res = await step({ data: { runId: s.runId, cursor } });
        cursor = res.cursor;
        const pct = cursor.lists.length
          ? Math.round((cursor.index / cursor.lists.length) * 100)
          : 100;
        const read = Object.values(cursor.counts).reduce((a, b) => a + b.tasks, 0);
        setBusy({ label: `Lendo tarefas do ClickUp: ${fmt(read)} até agora`, pct });
        if (res.done) break;
        if (res.waitSeconds) {
          setBusy({ label: `Limite do ClickUp: aguardando ${res.waitSeconds} s…`, pct });
          await sleep(res.waitSeconds * 1000);
        }
      }
      toast.success("Leitura concluída. Revise a organização antes de importar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler o ClickUp.");
    } finally {
      setBusy(null);
      refresh();
    }
  }

  async function loop(kind: "apply" | "assignees" | "rollback") {
    if (!r) return;
    const label = {
      apply: "Importando tarefas",
      assignees: "Completando responsáveis",
      rollback: "Desfazendo importação",
    }[kind];
    setBusy({ label: `${label}…`, pct: null });
    let total = 0;
    try {
      for (let i = 0; i < 500; i++) {
        const res = await run({ data: { runId: r.id, kind } });
        if (kind === "apply") {
          total += Number(res["created"] ?? 0);
          const rem = Number(res["remaining"] ?? 0);
          setBusy({
            label: `${label}: ${fmt(total)} criadas, faltam ${fmt(rem)}`,
            pct: total + rem ? Math.round((total / (total + rem)) * 100) : 100,
          });
          if (res["done"]) break;
        } else if (kind === "rollback") {
          total += Number(res["deleted"] ?? 0);
          setBusy({ label: `${label}: ${fmt(total)} tarefas removidas`, pct: null });
          if (res["done"]) break;
        } else {
          const n = Number(res["updated"] ?? 0);
          total += n;
          setBusy({ label: `${label}: ${fmt(total)} tarefas atualizadas`, pct: null });
          if (n === 0) break;
        }
      }
      toast.success(`${label}: concluído.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A operação falhou.");
    } finally {
      setBusy(null);
      refresh();
    }
  }

  if (q.isLoading)
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (q.isError)
    return (
      <EmptyState
        title="Não foi possível abrir o importador do ClickUp"
        description={q.error instanceof Error ? q.error.message : "Tente novamente."}
        action={<Button onClick={() => q.refetch()}>Tentar de novo</Button>}
      />
    );

  const rl = r ? RUN_LABEL[r.status] : null;
  const planned = r?.status === "planned";
  const applying = r?.status === "applying";
  const applied = r?.status === "applied";
  const rollingBack = r?.status === "rolling_back";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="TechProjects · Importações"
        title="Importar do ClickUp"
        description="Lê espaços, pastas, listas e tarefas do ClickUp, propõe onde cada lista entra no TechProjects e só grava depois da sua revisão. Horas continuam vindo do Clockify."
        primaryAction={
          canManage && !applying && !rollingBack ? (
            <Button onClick={collect} disabled={!!busy || !data?.configured}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              {r && r.status !== "rolled_back" ? "Ler o ClickUp de novo" : "Ler o ClickUp"}
            </Button>
          ) : undefined
        }
      />

      {!data?.configured && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          A chave do ClickUp não está configurada no servidor.
        </p>
      )}
      {!canManage && (
        <p className="rounded-md border border-border-subtle bg-surface-1 p-3 text-sm text-text-secondary">
          Você pode consultar a importação, mas não tem permissão para alterá-la.
        </p>
      )}

      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="space-y-2 rounded-md border border-border-subtle bg-surface-1 p-4"
        >
          <p className="text-sm font-medium">{busy.label}</p>
          {busy.pct !== null && <Progress value={busy.pct} aria-label="Progresso" />}
          <p className="text-xs text-text-secondary">Mantenha esta página aberta até terminar.</p>
        </div>
      )}

      {!r ? (
        <EmptyState
          icon={ListChecks}
          title="Nenhuma leitura do ClickUp ainda"
          description="Clique em “Ler o ClickUp” para montar a prévia. Nada é gravado no TechProjects nesta etapa."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {rl && <StatusBadge status={rl.tone} label={rl.label} />}
            {planned && canManage && (
              <Button onClick={() => setConfirm("apply")} disabled={!!busy || totals.tasks === 0}>
                Importar {fmt(totals.tasks)} tarefas
              </Button>
            )}
            {applying && canManage && (
              <Button onClick={() => loop("apply")} disabled={!!busy}>
                Continuar importação
              </Button>
            )}
            {(applied || applying) && canManage && (
              <Button variant="outline" onClick={() => loop("assignees")} disabled={!!busy}>
                <Users className="mr-2 h-4 w-4" aria-hidden />
                Completar responsáveis
              </Button>
            )}
            {(applied || applying || rollingBack) && canManage && (
              <Button
                variant="outline"
                onClick={() => (rollingBack ? loop("rollback") : setConfirm("rollback"))}
                disabled={!!busy}
              >
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                {rollingBack ? "Continuar a desfazer" : "Desfazer importação"}
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Listas lidas" value={fmt(totals.lists)} />
            <MetricCard
              label={applied ? "Tarefas lidas" : "Tarefas a importar"}
              value={fmt(totals.tasks)}
              hint={`${fmt(totals.skipped)} fora da importação`}
            />
            <MetricCard
              label="Tarefas criadas"
              value={fmt(data?.linkedTasks ?? 0)}
              hint="no TechProjects, por esta importação"
            />
            <MetricCard
              label="Responsáveis a revisar"
              value={fmt(totals.pendingPeople)}
              tone={totals.pendingPeople ? "warning" : "positive"}
            />
          </div>
          {r.status === "rolled_back" && (
            <p className="text-sm text-text-secondary">
              Mantidas por terem sido editadas, terem horas ou subtarefas:{" "}
              {fmt(Number(r.counts?.["kept_tasks"] ?? 0))} tarefas.
            </p>
          )}

          <Tabs defaultValue="org">
            <TabsList>
              <TabsTrigger value="org">Organização</TabsTrigger>
              <TabsTrigger value="people">Responsáveis</TabsTrigger>
            </TabsList>
            <TabsContent value="org" className="mt-4">
              <OrgTable
                groups={groups}
                editable={planned && canManage && !busy}
                targets={t.data}
                onSaved={refresh}
              />
            </TabsContent>
            <TabsContent value="people" className="mt-4">
              <PeopleTable
                people={people}
                members={t.data?.members ?? []}
                editable={canManage && !busy}
                onSaved={refresh}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "apply"
                ? "Importar as tarefas do ClickUp?"
                : "Desfazer a importação do ClickUp?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "apply"
                ? `Serão criadas ${fmt(totals.tasks)} tarefas, com ${fmt(totals.newProjects)} projetos novos, conforme a organização revisada. Nenhuma automação é disparada e tarefas já importadas não são repetidas.`
                : "Saem as tarefas, listas, projetos e espaços criados por esta importação. Tarefas editadas depois, com horas ou com subtarefas mantidas ficam no TechProjects."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const k = confirm;
                setConfirm(null);
                if (k) void loop(k);
              }}
            >
              {confirm === "apply" ? "Importar" : "Desfazer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrgTable({
  groups,
  editable,
  targets,
  onSaved,
}: {
  groups: Group[];
  editable: boolean;
  targets?: { projects: Ref[]; spaces: Ref[] };
  onSaved: () => void;
}) {
  const [edit, setEdit] = useState<Group | null>(null);
  const projectName = new Map((targets?.projects ?? []).map((p) => [p.id, p.name]));
  const spaceName = new Map((targets?.spaces ?? []).map((p) => [p.id, p.name]));
  if (!groups.length) return <EmptyState compact title="Nenhuma lista lida" />;
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Onde cada lista do ClickUp entra"
        description="Nome igual a um projeto existente só vincula; o resto vira projeto novo. Ajuste antes de importar."
      />
      <div className="overflow-x-auto rounded-md border border-border-subtle">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No ClickUp</TableHead>
              <TableHead>Espaço no TechProjects</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Lista</TableHead>
              <TableHead className="text-right">Tarefas</TableHead>
              <TableHead className="sr-only">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={g.id} className={cn(g.action === "skip" && "opacity-60")}>
                <TableCell className="max-w-[280px]">
                  <span className="block truncate font-medium" title={g.list_name}>
                    {g.list_name}
                  </span>
                  <span className="block truncate text-xs text-text-secondary">
                    {[g.team_name, g.space_name, g.folder_name].filter(Boolean).join(" › ")}
                  </span>
                </TableCell>
                {g.action === "skip" ? (
                  <TableCell colSpan={3} className="text-sm text-text-secondary">
                    Fora da importação{g.reason ? ` — ${g.reason}` : ""}
                  </TableCell>
                ) : (
                  <>
                    <TableCell className="text-sm">
                      {g.target_space_id ? (
                        (spaceName.get(g.target_space_id) ?? "Espaço existente")
                      ) : (
                        <NewTag>{g.new_space_name}</NewTag>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {g.target_project_id ? (
                        (projectName.get(g.target_project_id) ?? "Projeto existente")
                      ) : (
                        <NewTag>{g.new_project_name}</NewTag>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{g.erp_list_name}</TableCell>
                  </>
                )}
                <TableCell className="text-right tabular-nums">
                  {fmt(g.task_count)}
                  {g.closed_count > 0 && (
                    <span className="block text-xs text-text-secondary">
                      {fmt(g.closed_count)} concluídas
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEdit(g)}
                      aria-label={`Alterar destino de ${g.list_name}`}
                    >
                      Alterar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {edit && targets && (
        <GroupDialog
          group={edit}
          targets={targets}
          onClose={() => setEdit(null)}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}

function NewTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{children}</span>
      <span className="rounded border border-primary/30 bg-primary/10 px-1.5 text-[11px] font-medium text-primary">
        novo
      </span>
    </span>
  );
}

const NEW = "__new__";

function GroupDialog({
  group,
  targets,
  onClose,
  onSaved,
}: {
  group: Group;
  targets: { projects: Ref[]; spaces: Ref[] };
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(setClickUpGroup);
  const [action, setAction] = useState(group.action);
  const [space, setSpace] = useState(group.target_space_id ?? NEW);
  const [newSpace, setNewSpace] = useState(group.new_space_name ?? group.space_name);
  const [project, setProject] = useState(group.target_project_id ?? NEW);
  const [newProject, setNewProject] = useState(
    group.new_project_name ?? group.folder_name ?? group.list_name,
  );
  const [listName, setListName] = useState(group.erp_list_name);
  const [saving, setSaving] = useState(false);
  const invalid =
    action === "import" &&
    ((space === NEW && !newSpace.trim()) ||
      (project === NEW && !newProject.trim()) ||
      !listName.trim());

  async function submit() {
    setSaving(true);
    try {
      await save({
        data: {
          groupId: group.id,
          action,
          spaceId: space === NEW ? null : space,
          newSpace: space === NEW ? newSpace : null,
          projectId: project === NEW ? null : project,
          newProject: project === NEW ? newProject : null,
          listName,
        },
      });
      toast.success("Destino atualizado.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Destino de “{group.list_name}”</DialogTitle>
          <DialogDescription>
            {[group.team_name, group.space_name, group.folder_name].filter(Boolean).join(" › ")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cu-action">O que fazer</Label>
            <Select value={action} onValueChange={(v) => setAction(v as Group["action"])}>
              <SelectTrigger id="cu-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="import">Importar</SelectItem>
                <SelectItem value="skip">Deixar fora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action === "import" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cu-space">Espaço</Label>
                <Select value={space} onValueChange={setSpace}>
                  <SelectTrigger id="cu-space">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW}>Criar espaço novo</SelectItem>
                    {targets.spaces.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {space === NEW && (
                  <Input
                    aria-label="Nome do espaço novo"
                    value={newSpace}
                    onChange={(e) => setNewSpace(e.target.value)}
                    maxLength={120}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Projeto</Label>
                <ProjectPicker value={project} projects={targets.projects} onChange={setProject} />
                {project === NEW && (
                  <Input
                    aria-label="Nome do projeto novo"
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
                    maxLength={200}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-list">Nome da lista no TechProjects</Label>
                <Input
                  id="cu-list"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  maxLength={120}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || invalid}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectPicker({
  value,
  projects,
  onChange,
}: {
  value: string;
  projects: Ref[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label =
    value === NEW
      ? "Criar projeto novo"
      : (projects.find((p) => p.id === value)?.name ?? "Escolha");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Projeto de destino"
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar projeto…" />
          <CommandList>
            <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="criar projeto novo"
                onSelect={() => {
                  onChange(NEW);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn("mr-2 h-4 w-4", value === NEW ? "opacity-100" : "opacity-0")}
                  aria-hidden
                />
                Criar projeto novo
              </CommandItem>
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.id}`}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")}
                    aria-hidden
                  />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PeopleTable({
  people,
  members,
  editable,
  onSaved,
}: {
  people: Person[];
  members: { id: string; name: string; active: boolean }[];
  editable: boolean;
  onSaved: () => void;
}) {
  const save = useServerFn(setClickUpPerson);
  const [pending, setPending] = useState<number | null>(null);
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  if (!people.length)
    return (
      <EmptyState
        compact
        title="Nenhum responsável lido"
        description="Os responsáveis aparecem depois da leitura das tarefas."
      />
    );

  async function decide(
    p: Person,
    userId: string | null,
    st: "confirmed" | "ignored" | "unmatched",
  ) {
    setPending(p.clickup_user_id);
    try {
      await save({ data: { clickupUserId: p.clickup_user_id, userId, status: st } });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Responsáveis do ClickUp"
        description="Só vínculos confirmados entram como responsáveis. Depois de confirmar, use “Completar responsáveis” para preencher tarefas já importadas."
      />
      <div className="overflow-x-auto rounded-md border border-border-subtle">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No ClickUp</TableHead>
              <TableHead className="text-right">Tarefas</TableHead>
              <TableHead>Pessoa no TechERP</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="sr-only">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p) => (
              <TableRow key={p.clickup_user_id}>
                <TableCell>
                  <span className="block font-medium">{p.username ?? "Sem nome"}</span>
                  <span className="block text-xs text-text-secondary">
                    {p.email ?? "sem e-mail"}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt(p.task_count)}</TableCell>
                <TableCell className="min-w-[220px]">
                  {editable ? (
                    <Select
                      value={p.user_id ?? ""}
                      onValueChange={(v) => decide(p, v, "confirmed")}
                      disabled={pending === p.clickup_user_id}
                    >
                      <SelectTrigger
                        aria-label={`Pessoa para ${p.username ?? p.email ?? "responsável"}`}
                      >
                        <SelectValue placeholder="Escolha a pessoa" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                            {m.active ? "" : " (inativo)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm">
                      {p.user_id ? (memberName.get(p.user_id) ?? "—") : "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={
                      p.status === "confirmed"
                        ? "open"
                        : p.status === "suggested"
                          ? "onhold"
                          : p.status === "ignored"
                            ? "closed"
                            : "draft"
                    }
                    label={PERSON_LABEL[p.status]}
                  />
                  {p.match_reason && (
                    <span className="mt-1 block text-xs text-text-secondary">
                      {REASON_LABEL[p.match_reason] ?? p.match_reason}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {editable && p.status === "suggested" && p.user_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => decide(p, p.user_id, "confirmed")}
                      disabled={pending === p.clickup_user_id}
                    >
                      Confirmar
                    </Button>
                  )}
                  {editable && p.status !== "ignored" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => decide(p, null, "ignored")}
                      disabled={pending === p.clickup_user_id}
                    >
                      Ignorar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
