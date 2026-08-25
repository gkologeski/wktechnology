// Fase 7 — Servidor: processa a régua de cobrança.
// Enrola faturas vencidas em dunning_runs e avança passos conforme offset_days.
import type { SupabaseClient } from "@supabase/supabase-js";

type Step = {
  offset_days: number;
  channel: "email" | "whatsapp" | "task" | "escalation";
  template?: string;
  template_id?: string | null;
  subject?: string;
  body?: string;
};

type Policy = {
  id: string;
  workspace_id: string;
  owner_id: string;
  active: boolean;
  is_default: boolean;
  steps: Step[];
};

type Invoice = {
  id: string;
  workspace_id: string;
  owner_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  contact_id: string | null;
  company_id: string | null;
};

function renderTokens(text: string, ctx: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_m, k) => {
    const v = ctx[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

async function loadTemplate(
  supabase: SupabaseClient,
  templateId: string | null | undefined,
): Promise<{ subject?: string | null; body: string } | null> {
  if (!templateId) return null;
  const { data } = await supabase
    .from("charging_templates")
    .select("subject, body, active")
    .eq("id", templateId)
    .maybeSingle();
  if (!data || data.active === false) return null;
  return { subject: data.subject, body: data.body };
}

async function resolveRecipient(
  supabase: SupabaseClient,
  invoice: Invoice,
): Promise<{ customerName: string; phone: string | null; email: string | null }> {
  let customerName = "";
  let phone: string | null = null;
  let email: string | null = null;
  if (invoice.contact_id) {
    const { data } = await supabase
      .from("contacts")
      .select("first_name, last_name, phone, mobile_phone, email")
      .eq("id", invoice.contact_id)
      .maybeSingle();
    customerName = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim();
    phone = data?.mobile_phone || data?.phone || null;
    email = data?.email || null;
  }
  if ((!customerName || !phone || !email) && invoice.company_id) {
    const { data } = await supabase
      .from("companies")
      .select("name, phone, email")
      .eq("id", invoice.company_id)
      .maybeSingle();
    if (!customerName) customerName = data?.name ?? "";
    if (!phone) phone = data?.phone ?? null;
    if (!email) email = data?.email ?? null;
  }
  return { customerName, phone, email };
}

async function resolveContext(
  supabase: SupabaseClient,
  invoice: Invoice,
  step: Step,
): Promise<{
  tokens: Record<string, string | number>;
  phone: string | null;
  email: string | null;
  customerName: string;
}> {
  const today = new Date();
  const due = new Date(invoice.due_date);
  const daysOverdue = Math.max(0, daysBetween(today, due));
  const { customerName, phone, email } = await resolveRecipient(supabase, invoice);
  void step;
  return {
    tokens: {
      invoice_number: invoice.invoice_number,
      amount: invoice.amount.toFixed(2),
      currency: invoice.currency,
      due_date: invoice.due_date,
      days_overdue: daysOverdue,
      customer_name: customerName || "Cliente",
    },
    phone,
    email,
    customerName,
  };
}

async function executeStep(
  supabase: SupabaseClient,
  invoice: Invoice,
  policy: Policy,
  step: Step,
): Promise<Record<string, unknown>> {
  const { tokens: ctx, phone, email, customerName } = await resolveContext(supabase, invoice, step);
  const tmpl = await loadTemplate(supabase, step.template_id);
  const subject = renderTokens(tmpl?.subject ?? step.subject ?? "", ctx);
  const body = renderTokens(tmpl?.body ?? step.body ?? "", ctx);

  const eventBase = {
    at: new Date().toISOString(),
    channel: step.channel,
    offset_days: step.offset_days,
    subject: subject || undefined,
    body,
    template_id: step.template_id ?? null,
  };

  if (step.channel === "task") {
    await supabase.from("activities").insert({
      workspace_id: invoice.workspace_id,
      owner_id: policy.owner_id,
      type: "task",
      subject: subject || `Cobrança fatura ${invoice.invoice_number}`,
      body,
      contact_id: invoice.contact_id,
      company_id: invoice.company_id,
      metadata: { source: "dunning", invoice_id: invoice.id, policy_id: policy.id },
    });
    return { ...eventBase, status: "task_created" };
  }

  if (step.channel === "escalation") {
    await supabase.from("activities").insert({
      workspace_id: invoice.workspace_id,
      owner_id: policy.owner_id,
      type: "note",
      subject: `Cobrança escalada — ${invoice.invoice_number}`,
      body,
      contact_id: invoice.contact_id,
      company_id: invoice.company_id,
      metadata: {
        source: "dunning",
        invoice_id: invoice.id,
        policy_id: policy.id,
        escalation: true,
      },
    });
    return { ...eventBase, status: "escalated" };
  }

  if (step.channel === "whatsapp") {
    if (!phone) {
      return { ...eventBase, status: "error", error: "Contato sem telefone" };
    }
    try {
      const { sendWhatsAppFromServer } = await import("@/lib/whatsapp-send.server");
      const result = await sendWhatsAppFromServer({
        supabase,
        workspaceId: invoice.workspace_id,
        to: phone,
        body,
        contactId: invoice.contact_id,
        templateName: step.template_id ? `dunning:${step.template_id}` : "dunning",
        source: { origin: "dunning", invoice_id: invoice.id, policy_id: policy.id },
      });
      return {
        ...eventBase,
        status: "sent",
        provider: "twilio",
        message_sid: result.sid,
        provider_status: result.status,
        to: result.to,
      };
    } catch (err) {
      console.error("[dunning] whatsapp send failed", err);
      return {
        ...eventBase,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (step.channel === "email") {
    if (!email) {
      return { ...eventBase, status: "error", error: "Contato sem e-mail" };
    }
    try {
      const { sendTransactionalEmailFromServer } = await import("@/lib/email-send.server");
      const result = await sendTransactionalEmailFromServer({
        supabase,
        templateName: "dunning-notice",
        recipientEmail: email,
        idempotencyKey: `dunning:${policy.id}:${invoice.id}:${step.offset_days}`,
        templateData: {
          subject,
          body,
          invoiceNumber: invoice.invoice_number,
          customerName: customerName || "Cliente",
        },
      });
      if (result.status === "sent") {
        return {
          ...eventBase,
          status: "sent",
          provider: "lovable-email",
          message_id: result.messageId,
          to: email,
        };
      }
      if (result.status === "suppressed") {
        return { ...eventBase, status: "suppressed", to: email, message_id: result.messageId };
      }
      return { ...eventBase, status: "error", error: result.error };
    } catch (err) {
      console.error("[dunning] email send failed", err);
      return {
        ...eventBase,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { ...eventBase, status: "queued" };
}

export async function processDunningRuns(supabase: SupabaseClient) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // 1) Enrolar faturas em atraso ainda sem run em políticas ativas padrão
  const { data: policies } = await supabase
    .from("dunning_policies")
    .select("id, workspace_id, owner_id, active, is_default, steps")
    .eq("active", true)
    .eq("is_default", true);

  const enrolled: string[] = [];
  for (const p of (policies ?? []) as Policy[]) {
    const { data: invoices } = await supabase
      .from("customer_invoices")
      .select("id, workspace_id, invoice_number")
      .eq("workspace_id", p.workspace_id)
      .in("status", ["sent", "overdue"])
      .lte("due_date", today);
    for (const inv of invoices ?? []) {
      const { data: existing } = await supabase
        .from("dunning_runs")
        .select("id")
        .eq("invoice_id", inv.id)
        .eq("policy_id", p.id)
        .maybeSingle();
      if (existing) continue;
      const firstOffset = p.steps?.[0]?.offset_days ?? 0;
      const nextRun = new Date();
      nextRun.setUTCDate(nextRun.getUTCDate() + Math.max(0, firstOffset));
      const { error: insertError } = await supabase.from("dunning_runs").insert({
        workspace_id: p.workspace_id,
        invoice_id: inv.id,
        policy_id: p.id,
        status: "active",
        current_step: 0,
        history: [],
        next_run_at: nextRun.toISOString(),
      });
      if (!insertError) enrolled.push(inv.id);
    }
  }

  // 2) Processar runs prontos
  const { data: runs } = await supabase
    .from("dunning_runs")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", now.toISOString())
    .limit(200);

  let executed = 0;
  let completed = 0;
  let stopped = 0;

  for (const run of runs ?? []) {
    const { data: policy } = await supabase
      .from("dunning_policies")
      .select("*")
      .eq("id", run.policy_id)
      .maybeSingle();
    if (!policy || !policy.active) continue;
    const { data: invoice } = await supabase
      .from("customer_invoices")
      .select(
        "id, workspace_id, owner_id, invoice_number, amount, currency, due_date, status, contact_id, company_id",
      )
      .eq("id", run.invoice_id)
      .maybeSingle();
    if (!invoice) continue;

    // Parar se fatura foi paga/cancelada
    if (["paid", "canceled", "cancelled", "void"].includes(invoice.status)) {
      await supabase
        .from("dunning_runs")
        .update({ status: "stopped", next_run_at: null })
        .eq("id", run.id);
      stopped++;
      continue;
    }

    const steps = (policy.steps ?? []) as Step[];
    const stepIndex: number = run.current_step ?? 0;
    const step = steps[stepIndex];
    if (!step) {
      await supabase
        .from("dunning_runs")
        .update({ status: "completed", next_run_at: null })
        .eq("id", run.id);
      completed++;
      continue;
    }

    const event = await executeStep(supabase, invoice as Invoice, policy as Policy, step);
    executed++;

    const history = Array.isArray(run.history) ? [...run.history, event] : [event];
    const nextStep = steps[stepIndex + 1];
    let nextRunAt: string | null = null;
    let nextStatus: "active" | "completed" = "completed";
    if (nextStep) {
      const due = new Date(invoice.due_date);
      const target = new Date(due);
      target.setUTCDate(target.getUTCDate() + nextStep.offset_days);
      // Nunca agenda no passado
      const scheduled =
        target.getTime() > now.getTime() ? target : new Date(now.getTime() + 60_000);
      nextRunAt = scheduled.toISOString();
      nextStatus = "active";
    }

    await supabase
      .from("dunning_runs")
      .update({
        status: nextStatus,
        current_step: stepIndex + 1,
        history,
        next_run_at: nextRunAt,
      })
      .eq("id", run.id);
  }

  return {
    enrolled: enrolled.length,
    executed,
    completed,
    stopped,
  };
}
