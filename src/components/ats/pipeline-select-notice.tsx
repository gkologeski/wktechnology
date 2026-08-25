// Aviso presentacional exibido abaixo do seletor de pipeline.
// Diferencia "sem pipeline visível por permissão" de "falha ao carregar".
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

type Props = {
  /** mensagem de erro de carregamento, se houver */
  error?: string | null;
  /** ação de nova tentativa quando houver erro */
  onRetry?: () => void;
  /** exibe link para a tela de pipelines */
  showManageLink?: boolean;
};

export function PipelineSelectNotice({ error, onRetry, showManageLink = true }: Props) {
  if (error) {
    return (
      <div
        role="alert"
        className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">Não foi possível carregar os pipelines.</span>
        {onRetry ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
            onClick={onRetry}
          >
            <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
            Tentar novamente
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-1 flex flex-wrap items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[11px] text-text-secondary"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p>
          Nenhum pipeline visível para você. Suas permissões atuais não permitem ver os pipelines
          deste workspace.
        </p>
        <p className="text-text-tertiary">
          Peça a um administrador acesso de visualização de pipelines
          {showManageLink ? (
            <>
              {" "}
              ou defina um pipeline em{" "}
              <Link
                to="/pipelines"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Configurações de pipelines
              </Link>
              .
            </>
          ) : (
            "."
          )}
        </p>
      </div>
    </div>
  );
}
