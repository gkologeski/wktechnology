import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
// TechProjects Ciclo 4 — medições, geração no Financeiro e rentabilidade (tarifas em billing-rates.functions.ts).
// Toda regra e autorização ficam no banco (`project_rate_*`, `project_billing_*`, `project_measurement_*`,
// `project_profitability`); aqui só validamos a forma da entrada e chamamos como o usuário (RLS).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import {
  hash,
  isoDate,
  listScope,
  money,
  profitabilityInput,
  reason,
  shortReason,
  tz,
  uuid,
} from "@/lib/projects/billing.schemas";
import { loadMeasurementDetail, rpc } from "@/lib/projects/billing.server";
import type { MeasurementRow, Profitability } from "@/lib/projects/billing.types";

// ============= medições =============

export const listMeasurements = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "view")])
  .inputValidator((i: unknown) => listScope.parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    return rpc<{ total: number; rows: MeasurementRow[] }>(
      context.supabase,
      "project_measurements_list",
      {
        p_ws: ws,
        p_project: data.projectId ?? null,
        p_contract: data.contractId ?? null,
        p_limit: data.pageSize,
        p_offset: (data.page - 1) * data.pageSize,
      },
    );
  });

export const getMeasurement = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "view")])
  .inputValidator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => loadMeasurementDetail(context.supabase, data.id));

export const buildMeasurement = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "manage")])
  .inputValidator((i: unknown) =>
    z
      .object({
        configId: uuid,
        month: isoDate,
        kind: z.enum(["regular", "complement"]),
        timezone: tz,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const id = await rpc<string>(context.supabase, "project_measurement_build", {
      p_cfg: data.configId,
      p_month: data.month,
      p_kind: data.kind,
      p_tz: data.timezone,
    });
    return { id };
  });

export const refreshMeasurement = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "manage")])
  .inputValidator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) =>
    rpc<{ lines_hash: string; revision: number }>(context.supabase, "project_measurement_refresh", {
      p_id: data.id,
    }),
  );

export const addMeasurementAdjustment = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "manage")])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: uuid,
        description: z.string().trim().min(3).max(200),
        amount: z
          .number()
          .finite()
          .refine((n) => n !== 0, "Valor diferente de zero"),
        reason,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "project_measurement_add_adjustment", {
      p_id: data.id,
      p_description: data.description,
      p_amount: data.amount,
      p_reason: data.reason,
    });
    return { ok: true };
  });

export const addMeasurementSuccessEvent = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "manage")])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: uuid,
        refType: z.enum(["ats_offer", "ats_application"]),
        refId: uuid,
        base: money.nullable(),
        reason,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "project_measurement_add_success_event", {
      p_id: data.id,
      p_ref_type: data.refType,
      p_ref: data.refId,
      p_base: data.base,
      p_reason: data.reason,
    });
    return { ok: true };
  });

export const removeMeasurementLine = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "manage")])
  .inputValidator((i: unknown) => z.object({ lineId: uuid, reason: shortReason }).parse(i))
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "project_measurement_remove_line", {
      p_line: data.lineId,
      p_reason: data.reason,
    });
    return { ok: true };
  });

export const submitMeasurement = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "manage")])
  .inputValidator((i: unknown) => z.object({ id: uuid, hash }).parse(i))
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "project_measurement_submit", { p_id: data.id, p_hash: data.hash });
    return { ok: true };
  });

export const returnMeasurement = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "manage")])
  .inputValidator((i: unknown) => z.object({ id: uuid, reason }).parse(i))
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "project_measurement_return", {
      p_id: data.id,
      p_reason: data.reason,
    });
    return { ok: true };
  });

export const approveMeasurement = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "approve")])
  .inputValidator((i: unknown) => z.object({ id: uuid, hash }).parse(i))
  .handler(async ({ data, context }) => {
    const status = await rpc<string>(context.supabase, "project_measurement_approve", {
      p_id: data.id,
      p_hash: data.hash,
    });
    return { status };
  });

export const recheckMeasurement = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "manage")])
  .inputValidator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const status = await rpc<string>(context.supabase, "project_measurement_recheck", {
      p_id: data.id,
    });
    return { status };
  });

export const generateMeasurementEntry = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurement_finance", "create")])
  .inputValidator((i: unknown) => z.object({ id: uuid, hash, dueDate: isoDate }).parse(i))
  .handler(async ({ data, context }) =>
    rpc<{
      status: string;
      financial_entry_id?: string | null;
      error?: string;
      idempotent?: boolean;
    }>(context.supabase, "project_measurement_generate", {
      p_id: data.id,
      p_hash: data.hash,
      p_due: data.dueDate,
    }),
  );

export const linkMeasurementLegacy = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurement_finance", "create")])
  .inputValidator((i: unknown) => z.object({ id: uuid, entryId: uuid, hash, reason }).parse(i))
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "project_measurement_link_legacy", {
      p_id: data.id,
      p_entry: data.entryId,
      p_hash: data.hash,
      p_reason: data.reason,
    });
    return { ok: true };
  });

export const reverseMeasurement = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurement_reverse", "manage")])
  .inputValidator((i: unknown) => z.object({ id: uuid, reason }).parse(i))
  .handler(async ({ data, context }) =>
    rpc<{ cancelled_entries: number; unlinked_legacy: number }>(
      context.supabase,
      "project_measurement_reverse",
      { p_id: data.id, p_reason: data.reason },
    ),
  );

export const cancelMeasurement = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.measurements", "manage")])
  .inputValidator((i: unknown) => z.object({ id: uuid, reason }).parse(i))
  .handler(async ({ data, context }) => {
    await rpc(context.supabase, "project_measurement_cancel", {
      p_id: data.id,
      p_reason: data.reason,
    });
    return { ok: true };
  });

// ============= rentabilidade =============

export const getProfitability = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.profitability", "view")])
  .inputValidator((i: unknown) => profitabilityInput.parse(i))
  .handler(async ({ data, context }) => {
    const { monthRangeBounds } = await import("@/lib/projects/billing.shared");
    const ws = await resolveActiveWorkspace(context.userId);
    const { from, to } = monthRangeBounds(data.fromMonth, data.toMonth);
    return rpc<Profitability>(context.supabase, "project_profitability", {
      p_ws: ws,
      p_project: data.projectId ?? null,
      p_contract: data.contractId ?? null,
      p_from: from,
      p_to: to,
      p_currency: data.currency.toUpperCase(),
    });
  });

export const exportProfitability = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techprojects.profitability", "export")])
  .inputValidator((i: unknown) => profitabilityInput.parse(i))
  .handler(async ({ data, context }) => {
    const { monthRangeBounds } = await import("@/lib/projects/billing.shared");
    const ws = await resolveActiveWorkspace(context.userId);
    const { from, to } = monthRangeBounds(data.fromMonth, data.toMonth);
    return rpc<Profitability>(context.supabase, "project_profitability", {
      p_ws: ws,
      p_project: data.projectId ?? null,
      p_contract: data.contractId ?? null,
      p_from: from,
      p_to: to,
      p_currency: data.currency.toUpperCase(),
    });
  });
