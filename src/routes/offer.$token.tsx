import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOfferByToken } from "@/lib/ats/public-offer.functions";

export const Route = createFileRoute("/offer/$token")({
  component: OfferPage,
});

function OfferPage() {
  const { token } = useParams({ from: "/offer/$token" });
  const fn = useServerFn(getOfferByToken);
  const q = useQuery({
    queryKey: ["public-offer", token],
    queryFn: () => fn({ data: { token } }),
  });

  if (q.isLoading) return <div className="p-8 text-center">Carregando...</div>;
  if (q.error)
    return <div className="p-8 text-center text-destructive">{(q.error as Error).message}</div>;
  const o = q.data!;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-3xl font-semibold">{o.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Status: {o.status}
        {o.salary_amount ? ` · ${o.salary_currency} ${o.salary_amount}` : ""}
        {o.start_date ? ` · Início: ${new Date(o.start_date).toLocaleDateString("pt-BR")}` : ""}
      </p>
      <article className="prose prose-sm max-w-none whitespace-pre-wrap rounded border p-6 bg-card">
        {o.body}
      </article>
      <p className="mt-6 text-xs text-muted-foreground">
        Para aceitar oficialmente, conclua a assinatura eletrônica enviada por e-mail.
      </p>
    </div>
  );
}
