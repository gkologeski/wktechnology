// Página pública: candidato escolhe horário de entrevista via token.
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type SlotInfo = {
  ok: boolean;
  status?: string;
  slots?: string[];
  duration_min?: number;
  kind?: string;
  job_title?: string | null;
  candidate_name?: string | null;
  error?: string;
};

export const Route = createFileRoute("/interview/$token")({
  head: () => ({
    meta: [
      { title: "Confirmar horário de entrevista" },
      { name: "description", content: "Escolha seu horário de entrevista." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InterviewBookingPage,
});

function InterviewBookingPage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<SlotInfo | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/interview/${token}`)
      .then((r) => r.json() as Promise<SlotInfo>)
      .then(setInfo)
      .catch(() => setInfo({ ok: false, error: "Erro de rede" }));
  }, [token]);

  const handleConfirm = async () => {
    if (!selected) return;
    setConfirming(true);
    try {
      const r = await fetch(`/api/public/interview/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: selected }),
      });
      const data = (await r.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        toast.error(data.error || "Erro ao confirmar");
      } else {
        setConfirmed(selected);
        toast.success("Horário confirmado!");
      }
    } finally {
      setConfirming(false);
    }
  };

  if (!info) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!info.ok)
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <h1 className="text-xl font-semibold mb-2">Link indisponível</h1>
        <p className="text-muted-foreground">
          {info.error === "expired"
            ? "Este link de agendamento expirou. Entre em contato com o recrutador."
            : "Não foi possível carregar este agendamento."}
        </p>
      </div>
    );
  if (info.status !== "pending_candidate" || confirmed) {
    const when = confirmed ?? "";
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <h1 className="text-xl font-semibold mb-2">Entrevista confirmada ✓</h1>
        <p className="text-muted-foreground">
          {confirmed
            ? `Horário escolhido: ${new Date(when).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}.`
            : "Esta entrevista já foi confirmada anteriormente."}
        </p>
        <p className="text-sm mt-4">Você receberá os detalhes por e-mail.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-1">Escolha seu horário</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {info.job_title ? `Vaga: ${info.job_title}` : ""}
        {info.duration_min ? ` · ${info.duration_min} min` : ""}
      </p>
      <div className="space-y-2">
        {(info.slots ?? []).map((s) => {
          const d = new Date(s);
          return (
            <label
              key={s}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                selected === s ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="slot"
                value={s}
                checked={selected === s}
                onChange={() => setSelected(s)}
              />
              <span className="font-medium">
                {d.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
              </span>
            </label>
          );
        })}
      </div>
      <Button
        className="w-full mt-6"
        onClick={handleConfirm}
        disabled={!selected || confirming}
      >
        {confirming ? "Confirmando…" : "Confirmar horário"}
      </Button>
    </div>
  );
}
