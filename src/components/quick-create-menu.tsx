// Botão "+" no header com atalhos para criar entidades.
import { Link } from "@tanstack/react-router";
import { Plus, UserPlus, Users, Building2, Briefcase, ListTodo, Video, StickyNote, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const items = [
  { to: "/leads", label: "Lead", icon: UserPlus },
  { to: "/contacts", label: "Contato", icon: Users },
  { to: "/companies", label: "Empresa", icon: Building2 },
  { to: "/deals", label: "Negócio", icon: Briefcase },
  { to: "/tickets", label: "Ticket", icon: LifeBuoy },
  { to: "/tasks", label: "Tarefa", icon: ListTodo },
  { to: "/meetings", label: "Reunião", icon: Video },
  { to: "/notes", label: "Nota", icon: StickyNote },
] as const;

export function QuickCreateMenu() {
  return (
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
          <DropdownMenuItem key={it.to} asChild>
            <Link to={it.to}>
              <it.icon className="h-4 w-4 mr-2" />
              {it.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
