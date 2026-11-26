import { useImportAccess } from "./use-import-access";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { JourneySource } from "@/lib/projects/imports/import-journey";
import { PROVIDER_LABEL, SOURCE_ROUTE, type ImportQueryScope } from "./import-format";
import { JourneyNotice, ProviderIcon } from "./import-journey-ui";
import { ClockifySource } from "./clockify-source-setup";
import { JibbleSource } from "./jibble-source-setup";
import { ClickUpSource } from "./clickup-source-setup";

/** Credentials stay only in the form until sent to the canonical encrypted connection service. */
export function ImportSourceSheet({
  source,
  scope,
  readOnly,
  onClose,
}: {
  source: JourneySource;
  scope: ImportQueryScope;
  readOnly: boolean;
  onClose: () => void;
}) {
  const access = useImportAccess(scope);
  const client = useQueryClient();
  const editable = source.canManage && access.canManage(source.provider) && !readOnly;
  const configured = async () => {
    await client.invalidateQueries({ queryKey: ["project-import-journey", ...scope] });
    toast.success("Origem confirmada para este workspace. Continue pela jornada de importação.");
    onClose();
  };
  if (!access.canRead(source.provider)) return null;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-xl">
        <SheetHeader className="shrink-0 border-b border-border-subtle p-6 pr-12 text-left">
          <SheetTitle>Conexão {PROVIDER_LABEL[source.provider]}</SheetTitle>
          <SheetDescription>
            Confirme a organização que pode ser importada para o workspace ativo.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="flex items-center gap-3">
            <ProviderIcon provider={source.provider} />
            <div>
              <strong className="text-sm font-medium">
                {source.sourceName ?? "Organização ainda não confirmada"}
              </strong>
              <p className="mt-1 text-xs text-muted-foreground">
                {source.ready
                  ? "Conectado e autorizado para importar"
                  : "Confirme a conexão e o acesso na origem"}
              </p>
            </div>
          </div>
          <JourneyNotice>
            <strong className="font-medium text-foreground">
              A origem é uma escolha explícita.
            </strong>
            <p>
              Importe somente organizações autorizadas para este workspace. Um nome igual não
              confirma que duas empresas são a mesma.
            </p>
          </JourneyNotice>
          {editable ? (
            source.provider === "clockify" ? (
              <ClockifySource scope={scope} onConfigured={configured} />
            ) : source.provider === "jibble" ? (
              <JibbleSource scope={scope} onConfigured={configured} />
            ) : (
              <ClickUpSource scope={scope} onConfigured={configured} />
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Sua sessão pode consultar esta origem, mas não alterar a conexão.
            </p>
          )}
          <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            As credenciais são cifradas no servidor e não voltam ao navegador. Nenhuma pessoa
            importada recebe acesso por consequência da conexão.
          </p>
          {editable && (
            <Button asChild variant="ghost" size="sm">
              <Link to={SOURCE_ROUTE[source.provider]}>Configurações avançadas e agenda</Link>
            </Button>
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t border-border-subtle p-4">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
