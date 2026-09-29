import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/techhire/ui";

export function DashboardError({ retry }: { retry: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Não foi possível carregar o dashboard"
      description="Tente novamente. Se o problema continuar, confira seu acesso ao módulo."
      action={<Button onClick={retry}>Tentar novamente</Button>}
    />
  );
}
