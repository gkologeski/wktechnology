import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { RichHtmlEditor, HtmlContent } from "@/components/rich-html-editor";
import { CalendarDays, Clock, MapPin, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/book/$slug")({
  component: PublicBookingPage,
  head: () => ({
    meta: [
      { title: "Agendar reunião — WK Technology CRM" },
      { name: "description", content: "Escolha um horário disponível para agendar uma reunião." },
      { property: "og:title", content: "Agendar reunião — WK Technology CRM" },
      {
        property: "og:description",
        content: "Escolha um horário disponível para agendar uma reunião.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type PageInfo = {
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  timezone: string;
  color: string;
  location: string | null;
};
type Slot = { start: string; end: string };

function PublicBookingPage() {
  const { slug } = Route.useParams();
  const [info, setInfo] = useState<PageInfo | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({
    invitee_name: "",
    invitee_email: "",
    invitee_phone: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  useEffect(() => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 30 * 86400_000).toISOString();
    fetch(
      `/api/public/booking/${slug}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    )
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "not_found");
        return r.json();
      })
      .then((j) => {
        setInfo(j.page);
        setSlots(j.slots);
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [slug]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const d = new Date(s.start);
      const key = d.toLocaleDateString(undefined, {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [slots]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/booking/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, start: selected, timezone: tz }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "erro");
      setMeetLink(typeof j.meet_link === "string" ? j.meet_link : null);
      setConfirmed(true);
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  if (error && !info)
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive">{error}</div>
    );
  if (!info) return null;

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="max-w-md w-full bg-card border rounded-lg p-8 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
          <h1 className="text-2xl font-semibold">Agendamento confirmado</h1>
          <p className="text-muted-foreground">Enviamos os detalhes para {form.invitee_email}.</p>
          {selected && (
            <p className="font-medium">
              {new Date(selected).toLocaleString(undefined, {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </p>
          )}
          {meetLink ? (
            <a
              href={meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Entrar na reunião
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">
              O organizador enviará o link da reunião por e-mail.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-5xl mx-auto bg-card border rounded-lg overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside
          className="p-6 border-b md:border-b-0 md:border-r"
          style={{ borderColor: undefined }}
        >
          <div className="h-2 rounded mb-4" style={{ background: info.color }} />
          <h1 className="text-xl font-semibold">{info.title}</h1>
          {info.description && (
            <HtmlContent html={info.description} className="text-sm text-muted-foreground mt-2" />
          )}
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> {info.duration_minutes} min
            </div>
            {info.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {info.location}
              </div>
            )}
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Fuso: {tz}
            </div>
          </div>
        </aside>
        <main className="p-6">
          {!selected ? (
            <>
              <h2 className="font-semibold mb-4">Escolha um horário</h2>
              {byDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem horários disponíveis nos próximos 30 dias.
                </p>
              ) : (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                  {byDay.map(([day, dslots]) => (
                    <div key={day}>
                      <div className="font-medium text-sm mb-2 capitalize">{day}</div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {dslots.map((s) => (
                          <Button
                            key={s.start}
                            variant="outline"
                            size="sm"
                            onClick={() => setSelected(s.start)}
                          >
                            {new Date(s.start).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4 max-w-md">
              <div className="text-sm">
                <button onClick={() => setSelected(null)} className="text-primary underline">
                  ← voltar
                </button>
                <p className="mt-2 font-medium">
                  {new Date(selected).toLocaleString(undefined, {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input
                  value={form.invitee_name}
                  onChange={(e) => setForm({ ...form, invitee_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <EmailInput
                  value={form.invitee_email}
                  onChange={(v) => setForm({ ...form, invitee_email: v })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <PhoneInput
                  value={form.invitee_phone}
                  onChange={(v) => setForm({ ...form, invitee_phone: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <RichHtmlEditor
                  value={form.notes}
                  onChange={(html) => setForm({ ...form, notes: html })}
                  minHeight={120}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                disabled={!form.invitee_name || !form.invitee_email || submitting}
                onClick={submit}
                className="w-full"
              >
                {submitting ? "Confirmando…" : "Confirmar agendamento"}
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
