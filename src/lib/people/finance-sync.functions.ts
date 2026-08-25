// TechPeople · Sprint 12 — Integração com TechFinance.
// Materializa custos de folha (base + benefícios ativos) como recorrências
// financeiras mensais (direction=payable), uma por pessoa ativa.
// Idempotente: identifica recorrências existentes pela tag no `template.notes`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const TAG_PREFIX = "[people_payroll:";
const tagFor = (personId: string) => `${TAG_PREFIX}${personId}]`;

const inputSchema = z.object({
  dayOfMonth: z.number().int().min(1).max(28).default(5).optional(),
  dryRun: z.boolean().optional(),
});

export type PayrollSyncResult = {
  created: number;
  updated: number;
  deactivated: number;
  skipped: number;
  total_monthly: number;
  currency: string;
  items: {
    person_id: string;
    person_name: string;
    monthly_amount: number;
    action: "created" | "updated" | "deactivated" | "skipped";
  }[];
};

type PersonMini = {
  id: string;
  full_name: string;
  status: string;
  monthly_cost: number | null;
  archived: boolean;
  currency: string | null;
};

type BenefitMini = {
  person_id: string;
  monthly_value: number;
  active: boolean;
  starts_on: string | null;
  ends_on: string | null;
};

type RecurrenceRow = {
  id: string;
  active: boolean;
  template: Record<string, unknown> | null;
};

export const materializePeoplePayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => inputSchema.parse(i ?? {}))
  .handler(async ({ data, context }): Promise<PayrollSyncResult> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const dayOfMonth = data.dayOfMonth ?? 5;
    const dryRun = data.dryRun ?? false;

    // Pessoas ativas
    const peopleQ = await (
      supabase.from("people") as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: boolean,
          ) => {
            neq: (k: string, v: string) => Promise<{ data: PersonMini[] | null; error: unknown }>;
          };
        };
      }
    )
      .select("id, full_name, status, monthly_cost, archived, currency")
      .eq("archived", false)
      .neq("status", "terminated");
    if ((peopleQ as { error?: unknown }).error) throw (peopleQ as { error: Error }).error;
    const people: PersonMini[] = peopleQ.data ?? [];

    // Benefícios ativos vigentes
    const today = new Date().toISOString().slice(0, 10);
    const benQ = await (
      supabase.from("people_benefits") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: boolean) => Promise<{ data: BenefitMini[] | null; error: unknown }>;
        };
      }
    )
      .select("person_id, monthly_value, active, starts_on, ends_on")
      .eq("active", true);
    const benefits: BenefitMini[] = (benQ.data ?? []).filter(
      (b) => (!b.starts_on || b.starts_on <= today) && (!b.ends_on || b.ends_on >= today),
    );
    const benefitsByPerson = new Map<string, number>();
    for (const b of benefits) {
      benefitsByPerson.set(
        b.person_id,
        (benefitsByPerson.get(b.person_id) ?? 0) + Number(b.monthly_value ?? 0),
      );
    }

    // Recorrências existentes (payable) do workspace
    const recQ = await (
      supabase.from("financial_recurrences") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: string) => Promise<{ data: RecurrenceRow[] | null; error: unknown }>;
        };
      }
    )
      .select("id, active, template")
      .eq("direction", "payable");
    const recs: RecurrenceRow[] = recQ.data ?? [];
    const recByPerson = new Map<string, RecurrenceRow>();
    for (const r of recs) {
      const notes = String((r.template as Record<string, unknown> | null)?.notes ?? "");
      const m = notes.match(/\[people_payroll:([0-9a-f-]{36})\]/i);
      if (m) recByPerson.set(m[1], r);
    }

    const activeIds = new Set(people.map((p) => p.id));
    const items: PayrollSyncResult["items"] = [];
    let created = 0;
    let updated = 0;
    let deactivated = 0;
    let skipped = 0;
    let totalMonthly = 0;
    const currency = people[0]?.currency ?? "BRL";

    // Data inicial: próximo dia dayOfMonth
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
    if (startDate < now) startDate.setMonth(startDate.getMonth() + 1);
    const startStr = startDate.toISOString().slice(0, 10);

    for (const p of people) {
      const base = Number(p.monthly_cost ?? 0);
      const bens = benefitsByPerson.get(p.id) ?? 0;
      const amount = base + bens;
      if (amount <= 0) {
        items.push({
          person_id: p.id,
          person_name: p.full_name,
          monthly_amount: 0,
          action: "skipped",
        });
        skipped++;
        continue;
      }
      totalMonthly += amount;
      const existing = recByPerson.get(p.id);
      const template = {
        description: `Folha · ${p.full_name}`,
        amount,
        currency: p.currency ?? "BRL",
        notes: `${tagFor(p.id)} Base ${base.toFixed(2)} + Benefícios ${bens.toFixed(2)}`,
      };

      if (existing) {
        const prevAmount = Number(
          (existing.template as Record<string, unknown> | null)?.amount ?? 0,
        );
        const needsUpdate = Math.abs(prevAmount - amount) > 0.001 || !existing.active;
        if (needsUpdate && !dryRun) {
          const upd = await (
            supabase.from("financial_recurrences") as unknown as {
              update: (v: Record<string, unknown>) => {
                eq: (k: string, v: string) => Promise<{ error: unknown }>;
              };
            }
          )
            .update({ template, active: true })
            .eq("id", existing.id);
          if ((upd as { error?: unknown }).error) throw (upd as { error: Error }).error;
        }
        items.push({
          person_id: p.id,
          person_name: p.full_name,
          monthly_amount: amount,
          action: needsUpdate ? "updated" : "skipped",
        });
        if (needsUpdate) updated++;
        else skipped++;
      } else {
        if (!dryRun) {
          const ins = await (
            supabase.from("financial_recurrences") as unknown as {
              insert: (v: Record<string, unknown>) => Promise<{ error: unknown }>;
            }
          ).insert({
            workspace_id: workspaceId,
            owner_id: userId,
            direction: "payable",
            template,
            cadence: "monthly",
            day_of_month: dayOfMonth,
            start_date: startStr,
            next_run_date: startStr,
            active: true,
          });
          if ((ins as { error?: unknown }).error) throw (ins as { error: Error }).error;
        }
        items.push({
          person_id: p.id,
          person_name: p.full_name,
          monthly_amount: amount,
          action: "created",
        });
        created++;
      }
    }

    // Desativa recorrências de pessoas que não estão mais ativas
    for (const [personId, rec] of recByPerson) {
      if (activeIds.has(personId) || !rec.active) continue;
      // rec.active === true e pessoa não está ativa → desativar
    }
    for (const [personId, rec] of recByPerson) {
      if (activeIds.has(personId)) continue;
      if (!rec.active) continue;
      if (!dryRun) {
        const upd = await (
          supabase.from("financial_recurrences") as unknown as {
            update: (v: Record<string, unknown>) => {
              eq: (k: string, v: string) => Promise<{ error: unknown }>;
            };
          }
        )
          .update({ active: false })
          .eq("id", rec.id);
        if ((upd as { error?: unknown }).error) throw (upd as { error: Error }).error;
      }
      deactivated++;
    }

    return {
      created,
      updated,
      deactivated,
      skipped,
      total_monthly: totalMonthly,
      currency,
      items: items.sort((a, b) => a.person_name.localeCompare(b.person_name)),
    };
  });
