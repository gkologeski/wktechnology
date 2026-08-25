// Botão "+" no header com atalhos para criar entidades.
// Navega para a rota da entidade adicionando ?create=1 — a página detecta o
// parâmetro (useAutoCreateParam) e abre automaticamente o modal de cadastro.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Plus,
  UserPlus,
  Users,
  Building2,
  Briefcase,
  ListTodo,
  Video,
  StickyNote,
  LifeBuoy,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveModule } from "@/lib/modules/active-module";
import { AssociateCandidateJobDialog } from "@/components/ats/associate-candidate-job-dialog";

type QuickItem = {
  to:
    | "/leads"
    | "/contacts"
    | "/companies"
    | "/deals"
    | "/tickets"
    | "/tasks"
    | "/meetings"
    | "/notes";
  label: string;
  icon: typeof Plus;
  /** false para rotas que ainda não têm modal de cadastro (apenas navega). */
  hasCreateModal: boolean;
};

const items: readonly QuickItem[] = [
  { to: "/leads", label: "Lead", icon: UserPlus, hasCreateModal: true },
  { to: "/contacts", label: "Contato", icon: Users, hasCreateModal: true },
  { to: "/companies", label: "Empresa", icon: Building2, hasCreateModal: true },
  { to: "/deals", label: "Negócio", icon: Briefcase, hasCreateModal: true },
  { to: "/tickets", label: "Ticket", icon: LifeBuoy, hasCreateModal: true },
  { to: "/tasks", label: "Tarefa", icon: ListTodo, hasCreateModal: true },
  { to: "/meetings", label: "Reunião", icon: Video, hasCreateModal: false },
  { to: "/notes", label: "Nota", icon: StickyNote, hasCreateModal: false },
] as const;

export function QuickCreateMenu() {
  const navigate = useNavigate();
  const activeModule = useActiveModule();
  const [associateOpen, setAssociateOpen] = useState(false);

  // Atalho global: outros componentes (Copilot ⌘K, atalho de teclado) podem
  // disparar `ats:associate-open` para abrir o diálogo a partir de qualquer
  // tela.
  useEffect(() => {
    function onOpen() {
      setAssociateOpen(true);
    }
    window.addEventListener("ats:associate-open", onOpen as EventListener);
    return () => window.removeEventListener("ats:associate-open", onOpen as EventListener);
  }, []);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Criar novo">
            <Plus className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Criar</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((it) => (
            <DropdownMenuItem
              key={it.to}
              onSelect={(e) => {
                e.preventDefault();
                navigate({
                  to: it.to,
                  search: it.hasCreateModal ? ({ create: 1 } as never) : undefined,
                });
              }}
            >
              <it.icon className="h-4 w-4 mr-2" />
              {it.label}
            </DropdownMenuItem>
          ))}
          {activeModule === "ats" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>TechHire</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setAssociateOpen(true);
                }}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Associar candidato a vaga
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AssociateCandidateJobDialog open={associateOpen} onOpenChange={setAssociateOpen} />
    </>
  );
}
