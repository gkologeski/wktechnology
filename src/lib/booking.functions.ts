import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WeekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WindowSchema = z.object({
  start: z.string().regex(/^\d{1,2}:\d{2}$/),
  end: z.string().regex(/^\d{1,2}:\d{2}$/),
});
const AvailabilitySchema = z
  .object(
    Object.fromEntries(
      WeekdayKeys.map((k) => [k, z.array(WindowSchema).max(8).optional()]),
    ) as Record<(typeof WeekdayKeys)[number], z.ZodOptional<z.ZodArray<typeof WindowSchema>>>,
  )
  .partial();

const PageInput = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/i),
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  duration_minutes: z.number().int().min(5).max(480),
  buffer_before_minutes: z.number().int().min(0).max(240).default(0),
  buffer_after_minutes: z.number().int().min(0).max(240).default(0),
  calendar_account_id: z.string().uuid().nullable().optional(),
  availability: AvailabilitySchema.default({}),
  timezone: z.string().min(1).max(80),
  min_notice_hours: z.number().int().min(0).max(720).default(2),
  max_advance_days: z.number().int().min(1).max(365).default(30),
  active: z.boolean().default(true),
  target: z.enum(["lead", "contact"]).default("lead"),
  color: z.string().max(20).default("#6366f1"),
  location: z.string().max(240).nullable().optional(),
});

export const listBookingPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("booking_pages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertBookingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = { ...data, owner_id: userId };
    if (data.id) {
      const { error } = await supabase.from("booking_pages").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("booking_pages")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const deleteBookingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("booking_pages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ page_id: z.string().uuid().optional() }).default({}).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("bookings")
      .select("*, booking_pages(title,slug)")
      .order("start_at", { ascending: false })
      .limit(200);
    if (data.page_id) q = q.eq("page_id", data.page_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bookings")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_reason: data.reason ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
