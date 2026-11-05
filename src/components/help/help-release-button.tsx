import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { releaseOfficialHelp } from "@/lib/help/help-release.functions";

export function HelpReleaseButton({ allowed }: { allowed: boolean }) {
  const fn = useServerFn(releaseOfficialHelp);
  const client = useQueryClient();
  const [result, setResult] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      if (!allowed) throw new Error("Sem permissão para atualizar a Ajuda oficial.");
      return fn();
    },
    onSuccess: async (data) => {
      setResult(`${data.applied} artigos atualizados; ${data.preserved} versões preservadas.`);
      await client.invalidateQueries({
        predicate: (query) => String(query.queryKey[0]).startsWith("help-"),
      });
    },
  });
  if (!allowed) return null;
  return (
    <div className="space-y-2">
      <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        <RefreshCw className="mr-2 h-4 w-4" />
        {mutation.isPending ? "Atualizando…" : "Atualizar Ajuda oficial"}
      </Button>
      {result && (
        <p role="status" className="text-sm text-muted-foreground">
          {result}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}
    </div>
  );
}
