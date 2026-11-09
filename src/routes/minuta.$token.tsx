import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  decidePublicContractDraft,
  getPublicContractDraft,
} from "@/lib/contracts/contract-draft-public.functions";
import { isValidDraftToken } from "@/lib/contracts/contract-draft-public-rules";

export const Route = createFileRoute("/minuta/$token")({
  head: () => ({
    meta: [
      { title: "Minuta de contrato — WK Technology" },
      { name: "description", content: "Leia a minuta do contrato e aceite ou peça ajustes." },
      { property: "og:title", content: "Minuta de contrato — WK Technology" },
      {
        property: "og:description",
        content: "Leia a minuta do contrato e aceite ou peça ajustes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicContractDraftPage,
});

const STATUS: Record<string, string> = {
  sent: "Aguardando sua resposta",
  accepted: "Minuta aceita",
  changes_requested: "Ajustes solicitados",
};

function PublicContractDraftPage() {
  const { token } = useParams({ from: "/minuta/$token" });
  const fetchDoc = useServerFn(getPublicContractDraft);
  const decide = useServerFn(decidePublicContractDraft);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [askChanges, setAskChanges] = useState(false);
  const valid = isValidDraftToken(token);
  const q = useQuery({
    queryKey: ["public-contract-draft", token],
    queryFn: () => fetchDoc({ data: { token } }),
    enabled: valid,
    retry: false,
  });
  const m = useMutation({
    mutationFn: (decision: "accept" | "changes") =>
      decide({ data: { token, decision, name, note: note.trim() || null } }),
    onSuccess: (_r, d) => {
      toast.success(d === "accept" ? "Minuta aceita. Obrigado!" : "Pedido de ajustes enviado.");
      q.refetch();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!valid || q.isError || (q.isSuccess && !q.data))
    return (
      <main className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-xl font-semibold">Minuta não encontrada</h1>
        <p className="mt-2 text-muted-foreground">
          O link pode estar incorreto ou a minuta ainda não foi liberada.
        </p>
      </main>
    );
  if (q.isLoading || !q.data)
    return (
      <main className="mx-auto flex max-w-2xl justify-center p-8" role="status">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando minuta" />
      </main>
    );

  const d = q.data;
  const open = d.status === "sent";
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{d.workspace_name ?? "WK Technology"}</p>
        <h1 className="text-2xl font-semibold">{d.title}</h1>
        <Badge variant="secondary">{STATUS[d.status] ?? d.status}</Badge>
      </header>
      <article
        className="prose max-w-none rounded-md border border-border bg-card p-6 text-card-foreground dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(d.body_html) }}
      />
      {open ? (
        <section
          className="space-y-4 rounded-md border border-border bg-card p-6"
          aria-label="Sua resposta"
        >
          <div className="space-y-1">
            <Label htmlFor="mn-name">Seu nome completo</Label>
            <Input id="mn-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {askChanges && (
            <div className="space-y-1">
              <Label htmlFor="mn-note">Quais ajustes você precisa?</Label>
              <Textarea
                id="mn-note"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!askChanges ? (
              <>
                <Button
                  onClick={() => m.mutate("accept")}
                  disabled={m.isPending || name.trim().length < 3}
                >
                  {m.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Aceitar minuta
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAskChanges(true)}
                  disabled={m.isPending}
                >
                  <PencilLine className="mr-2 h-4 w-4" /> Pedir ajustes
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => m.mutate("changes")}
                  disabled={m.isPending || name.trim().length < 3 || note.trim().length < 5}
                >
                  Enviar pedido de ajustes
                </Button>
                <Button variant="ghost" onClick={() => setAskChanges(false)} disabled={m.isPending}>
                  Voltar
                </Button>
              </>
            )}
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          Resposta registrada{d.client_name ? ` por ${d.client_name}` : ""}
          {d.client_decided_at
            ? ` em ${new Date(d.client_decided_at).toLocaleString("pt-BR")}`
            : ""}
          .
        </p>
      )}
    </main>
  );
}
