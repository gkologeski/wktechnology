import { z } from "zod";

/** Limites e planejamento da sequência: e-mail por hora, WhatsApp por dia, ligações sem cota. */
export const planningSchema = z
  .object({
    email: z
      .object({
        hourlyLimit: z.number().int().min(1).max(500),
        safeguardPct: z.number().int().min(5).max(90),
        onLimit: z.enum(["queue_next_hour", "prioritize_followups"]),
      })
      .strict(),
    whatsapp: z
      .object({
        dailyLimit: z.number().int().min(1).max(10000),
        safeguardPct: z.number().int().min(5).max(90),
        minIntervalSeconds: z.number().int().min(5).max(3600),
        maxIntervalSeconds: z.number().int().min(5).max(3600),
        onLimit: z.enum(["queue_next_day", "overflow_to_call", "skip_step"]),
      })
      .strict(),
    recent: z
      .object({
        entryWhatsappDays: z.number().int().min(0).max(90),
        skipWhatsappDays: z.number().int().min(0).max(90),
      })
      .strict(),
    intake: z
      .object({
        mode: z.enum(["auto", "manual"]),
        dailyIntake: z.number().int().min(1).max(1000),
      })
      .strict(),
  })
  .strict()
  .superRefine((p, c) => {
    if (p.whatsapp.maxIntervalSeconds < p.whatsapp.minIntervalSeconds)
      c.addIssue({
        code: "custom",
        message: "O intervalo máximo do WhatsApp deve ser maior ou igual ao mínimo.",
        path: ["whatsapp", "maxIntervalSeconds"],
      });
  });
export type SequencePlanning = z.infer<typeof planningSchema>;

export function defaultPlanning(): SequencePlanning {
  return {
    email: { hourlyLimit: 20, safeguardPct: 20, onLimit: "queue_next_hour" },
    whatsapp: {
      dailyLimit: 250,
      safeguardPct: 15,
      minIntervalSeconds: 30,
      maxIntervalSeconds: 90,
      onLimit: "queue_next_day",
    },
    recent: { entryWhatsappDays: 14, skipWhatsappDays: 7 },
    intake: { mode: "auto", dailyIntake: 20 },
  };
}

/** Teto seguro = limite bruto × (1 − salva-guarda), nunca abaixo de 1. Mesma conta no banco. */
export function safeCap(limit: number, safeguardPct: number) {
  return Math.max(1, Math.floor((limit * (100 - safeguardPct)) / 100));
}

export function businessHoursPerDay(start: string, end: string) {
  const m = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
  return Math.max(1 / 60, (m(end) - m(start)) / 60);
}

/** Fração de contatos que segue para cada toque seguinte (quem responde sai da sequência). */
export const CONTINUATION = 0.85;

type StepLike = { type: string; duration?: number; unit?: string };
/** Dia (0 = entrada) em que cada etapa de envio acontece, somando as esperas. */
export function stepDays(steps: StepLike[]) {
  let day = 0;
  const out: { type: "email" | "whatsapp" | "call"; day: number; touch: number }[] = [];
  let touch = 0;
  for (const s of steps) {
    if (s.type === "wait") {
      const d = s.duration ?? 0;
      day += s.unit === "minutes" ? d / 1440 : s.unit === "hours" ? d / 24 : d;
    } else if (s.type === "email" || s.type === "whatsapp" || s.type === "call") {
      out.push({ type: s.type, day: Math.floor(day), touch: touch++ });
    }
  }
  return out;
}

export type PlanSimulation = {
  emailHourCap: number;
  emailDayCap: number;
  whatsappDayCap: number;
  hoursPerDay: number;
  suggestedIntake: number;
  intake: number;
  peak: { email: number; emailPerHour: number; whatsapp: number; call: number };
  days: { day: number; email: number; whatsapp: number; call: number }[];
  durationDays: number | null;
  exceeds: { email: boolean; whatsapp: boolean };
};

/** Carga diária acumulada (efeito bola de neve) e entrada sugerida que respeita os tetos. */
export function simulatePlan(
  steps: StepLike[],
  settings: { start: string; end: string },
  planning: SequencePlanning,
  audienceSize?: number | null,
): PlanSimulation {
  const touches = stepDays(steps);
  const hoursPerDay = businessHoursPerDay(settings.start, settings.end);
  const emailHourCap = safeCap(planning.email.hourlyLimit, planning.email.safeguardPct);
  const emailDayCap = Math.floor(emailHourCap * hoursPerDay);
  const whatsappDayCap = safeCap(planning.whatsapp.dailyLimit, planning.whatsapp.safeguardPct);
  const factor = (ch: string) =>
    touches.filter((t) => t.type === ch).reduce((a, t) => a + CONTINUATION ** t.touch, 0);
  const fe = factor("email");
  const fw = factor("whatsapp");
  const limits = [fe > 0 ? emailDayCap / fe : Infinity, fw > 0 ? whatsappDayCap / fw : Infinity];
  const raw = Math.min(...limits);
  const suggestedIntake = Math.max(
    1,
    Math.min(1000, Number.isFinite(raw) ? Math.floor(raw) : 1000),
  );
  const intake = planning.intake.mode === "auto" ? suggestedIntake : planning.intake.dailyIntake;
  const lastDay = touches.length ? Math.max(...touches.map((t) => t.day)) : 0;
  const entryDays = audienceSize && audienceSize > 0 ? Math.ceil(audienceSize / intake) : Infinity;
  const days: PlanSimulation["days"] = [];
  const horizon = Math.min(lastDay + 1, 60);
  for (let d = 0; d <= horizon; d++) {
    const load = { day: d + 1, email: 0, whatsapp: 0, call: 0 };
    for (const t of touches) {
      const entryDay = d - t.day;
      if (entryDay < 0 || entryDay >= entryDays) continue;
      load[t.type] += intake * CONTINUATION ** t.touch;
    }
    load.email = Math.round(load.email);
    load.whatsapp = Math.round(load.whatsapp);
    load.call = Math.round(load.call);
    days.push(load);
  }
  const max = (k: "email" | "whatsapp" | "call") => Math.max(0, ...days.map((x) => x[k]));
  const peak = {
    email: max("email"),
    emailPerHour: Math.round((max("email") / hoursPerDay) * 10) / 10,
    whatsapp: max("whatsapp"),
    call: max("call"),
  };
  return {
    emailHourCap,
    emailDayCap,
    whatsappDayCap,
    hoursPerDay,
    suggestedIntake,
    intake,
    peak,
    days,
    durationDays: Number.isFinite(entryDays) ? entryDays + lastDay : null,
    exceeds: { email: peak.emailPerHour > emailHourCap, whatsapp: peak.whatsapp > whatsappDayCap },
  };
}
