import { useImportAccess } from "./use-import-access";
import type { ImportProvider } from "@/lib/projects/imports/import-journey";
import type { ImportQueryScope } from "./import-format";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConnectionLoading() {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Carregando conexão…
    </p>
  );
}
export function ConnectionError({
  onRetry,
  scope,
  provider,
}: {
  onRetry: () => void;
  scope: ImportQueryScope;
  provider: ImportProvider;
}) {
  const access = useImportAccess(scope);
  return (
    <div role="alert" className="space-y-3">
      <p className="text-sm">
        Não foi possível consultar a conexão. Confira o acesso à integração antes de repetir.
      </p>
      <Button
        variant="outline"
        disabled={!access.canManage(provider)}
        onClick={() => {
          if (access.canManage(provider)) onRetry();
        }}
      >
        Tentar novamente
      </Button>
    </div>
  );
}
