import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTaskQueues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("task_queues")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // counts
    const ids = (data ?? []).map((q) => q.id);
    let counts: Record<string, { pending: number; total: number }> = {};
    if (ids.length) {
      const { data: items } = await context.supabase
        .from("task_queue_items")
        .select("queue_id, completed_at, skipped_at")
        .in("queue_id", ids);
      counts = (items ?? []).reduce((acc: Record<string, { pending: number; total: number }>, it) => {
        const k = it.queue_id as string;
        acc[k] ??= { pending: 0, total: 0 };
        acc[k].total += 1;
        if (!it.completed_at && !it.skipped_at) acc[k].pending += 1;
        return acc;
      }, {});
    }
    return { items: (data ?? []).map((q) => ({ ...q, counts: counts[q.id] ?? { pending: 0, total: 0 } })) };
  });

export const createTaskQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().min(1).max(120), description: z.string().max(500).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("task_queues")
      .insert({ ...data, owner_id: context.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { item: row };
  });

export const deleteTaskQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("task_queues").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const addItemSchema = z.object({
  queue_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        contact_id: z.string().uuid().optional(),
        lead_id: z.string().uuid().optional(),
        deal_id: z.string().uuid().optional(),
        activity_id: z.string().uuid().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const addQueueItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => addItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: maxRow } = await context.supabase
      .from("task_queue_items")
      .select("position")
      .eq("queue_id", data.queue_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const start = (maxRow?.position ?? -1) + 1;
    const rows = data.items.map((it, idx) => ({
      ...it,
      queue_id: data.queue_id,
      owner_id: context.userId,
      position: start + idx,
    }));
    const { error } = await context.supabase.from("task_queue_items").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, added: rows.length };
  });

type Item = {
  id: string;
  queue_id: string;
  position: number;
  activity_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  deal_id: string | null;
  completed_at: string | null;
  skipped_at: string | null;
  notes: string | null;
};

export const getQueueWithItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ queue_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: q, error: qe } = await context.supabase
      .from("task_queues")
      .select("*")
      .eq("id", data.queue_id)
      .single();
    if (qe) throw new Error(qe.message);

    const { data: items, error } = await context.supabase
      .from("task_queue_items")
      .select("*")
      .eq("queue_id", data.queue_id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);

    // hydrate
    const contactIds = [...new Set((items as Item[]).map((i) => i.contact_id).filter(Boolean) as string[])];
    const leadIds = [...new Set((items as Item[]).map((i) => i.lead_id).filter(Boolean) as string[])];
    const dealIds = [...new Set((items as Item[]).map((i) => i.deal_id).filter(Boolean) as string[])];

    const [contacts, leads, deals] = await Promise.all([
      contactIds.length
        ? context.supabase.from("contacts").select("id, first_name, last_name, email, phone").in("id", contactIds)
        : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null }[] }),
      leadIds.length
        ? context.supabase.from("leads").select("id, first_name, last_name, email, phone, company_name").in("id", leadIds)
        : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; company_name: string | null }[] }),
      dealIds.length
        ? context.supabase.from("deals").select("id, name, value, currency").in("id", dealIds)
        : Promise.resolve({ data: [] as { id: string; name: string; value: number; currency: string }[] }),
    ]);

    const contactsMap = Object.fromEntries((contacts.data ?? []).map((c) => [c.id, c]));
    const leadsMap = Object.fromEntries((leads.data ?? []).map((l) => [l.id, l]));
    const dealsMap = Object.fromEntries((deals.data ?? []).map((d) => [d.id, d]));

    return {
      queue: q,
      items: (items as Item[]).map((i) => ({
        ...i,
        contact: i.contact_id ? contactsMap[i.contact_id] : null,
        lead: i.lead_id ? leadsMap[i.lead_id] : null,
        deal: i.deal_id ? dealsMap[i.deal_id] : null,
      })),
    };
  });

export const updateQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["complete", "skip", "reopen"]),
        notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, string | null> = { notes: data.notes ?? null };
    if (data.action === "complete") {
      patch.completed_at = new Date().toISOString();
      patch.skipped_at = null;
    } else if (data.action === "skip") {
      patch.skipped_at = new Date().toISOString();
      patch.completed_at = null;
    } else {
      patch.completed_at = null;
      patch.skipped_at = null;
    }
    const { error } = await context.supabase.from("task_queue_items").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
