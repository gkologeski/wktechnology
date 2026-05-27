// Seletor de workspace ativo (header da sidebar).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { listMyWorkspaces, setActiveWorkspace } from "@/lib/workspaces.functions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function WorkspaceSwitcher() {
  const { user } = useAuth();
  const listFn = useServerFn(listMyWorkspaces);
  const setFn = useServerFn(setActiveWorkspace);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-workspaces", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const switchMut = useMutation({
    mutationFn: (workspace_id: string) => setFn({ data: { workspace_id } }),
    onSuccess: () => {
      toast.success("Workspace alterado");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const workspaces = data?.workspaces ?? [];
  const active = workspaces.find((w) => w.id === data?.active_workspace_id) ?? workspaces[0];

  if (isLoading || workspaces.length === 0) return null;

  // Único workspace: só mostra o nome, sem dropdown.
  if (workspaces.length === 1) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip={active?.name} className="gap-2">
            {active?.logo_url
              ? <img src={active.logo_url} alt="" className="h-5 w-5 rounded object-cover" />
              : <Building2 className="h-4 w-4" />}
            <span className="truncate font-medium">{active?.name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip={active?.name} className="gap-2">
              {active?.logo_url
                ? <img src={active.logo_url} alt="" className="h-5 w-5 rounded object-cover" />
                : <Building2 className="h-4 w-4" />}
              <span className="truncate font-medium flex-1 text-left">{active?.name ?? "Workspace"}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Seus workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => w.id !== active?.id && switchMut.mutate(w.id)}
                disabled={switchMut.isPending}
              >
                {w.logo_url
                  ? <img src={w.logo_url} alt="" className="h-4 w-4 rounded mr-2 object-cover" />
                  : <Building2 className="h-4 w-4 mr-2" />}
                <span className="flex-1 truncate">{w.name}</span>
                {w.id === active?.id && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
