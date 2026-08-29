import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureLeadRelationsSafe } from "@/lib/leads/lead-relations";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type FormField = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select" | "number";
  required?: boolean;
};

export const Route = createFileRoute("/api/public/forms/$slug/submit")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request, params }) => {
        let body: Record<string, unknown> = {};
        const ct = request.headers.get("content-type") ?? "";
        try {
          if (ct.includes("application/json")) {
            body = (await request.json()) as Record<string, unknown>;
          } else if (ct.includes("form")) {
            const fd = await request.formData();
            body = Object.fromEntries(fd.entries());
          }
        } catch {
          return Response.json({ error: "Invalid body" }, { status: 400, headers: cors });
        }

        // honeypot
        if (typeof body._hp === "string" && body._hp.length > 0) {
          return Response.json({ ok: true }, { headers: cors });
        }

        // time-to-fill: bots submit forms in milliseconds; require at least 1.5s
        const ts = Number(body._ts);
        if (Number.isFinite(ts) && ts > 0) {
          const elapsed = Date.now() - ts;
          if (elapsed < 1500) {
            return Response.json({ ok: true }, { headers: cors });
          }
        }

        const ip =
          request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || null;

        const { data: form, error: ferr } = await supabaseAdmin
          .from("forms")
          .select(
            "id, name, workspace_id, owner_id, target, fields, active, redirect_url, success_message, submit_count",
          )

          .eq("slug", params.slug)
          .maybeSingle();
        if (ferr) return Response.json({ error: ferr.message }, { status: 500, headers: cors });
        if (!form || !form.active)
          return Response.json({ error: "Not found" }, { status: 404, headers: cors });

        // rate limit: max 5 submissions per IP per form in 10 minutes
        if (ip) {
          const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          const { count } = await supabaseAdmin
            .from("form_submissions")
            .select("id", { count: "exact", head: true })
            .eq("form_id", form.id)
            .eq("ip", ip)
            .gte("created_at", since);
          if ((count ?? 0) >= 5) {
            return Response.json(
              { error: "Too many submissions, try again later." },
              { status: 429, headers: cors },
            );
          }
        }

        const fields = (form.fields as unknown as FormField[]) ?? [];
        const clean: Record<string, string> = {};
        for (const f of fields) {
          const raw = body[f.key];
          const v = raw == null ? "" : String(raw).slice(0, 5000).trim();
          if (f.required && !v) {
            return Response.json(
              { error: `Campo "${f.label}" obrigatório` },
              { status: 400, headers: cors },
            );
          }
          if (v) clean[f.key] = v;
        }

        const ua = request.headers.get("user-agent");
        const referer = request.headers.get("referer");

        let leadId: string | null = null;
        let contactId: string | null = null;

        const email = clean.email || clean.Email;
        const phone = clean.phone || clean.telefone || clean.tel;
        const firstName =
          clean.first_name || clean.firstName || (clean.name?.split(" ")[0] ?? "Lead");
        const lastName =
          clean.last_name ||
          clean.lastName ||
          (clean.name ? clean.name.split(" ").slice(1).join(" ") || null : null);
        const company = clean.company || clean.company_name || null;

        if (form.target === "lead") {
          const { data: lead, error: lerr } = await supabaseAdmin
            .from("leads")
            .insert({
              owner_id: form.owner_id,
              first_name: firstName,
              last_name: lastName,
              email: email || null,
              phone: phone || null,
              company_name: company,
              source: `form:${params.slug}`,
              custom_fields: clean,
            })
            .select("id")
            .single();
          if (lerr) return Response.json({ error: lerr.message }, { status: 500, headers: cors });
          leadId = lead.id;
          // Garante empresa e contato vinculados ao lead
          const rel = await ensureLeadRelationsSafe(supabaseAdmin, lead.id);
          contactId = rel?.contactId ?? null;
        } else {
          const { data: contact, error: cerr } = await supabaseAdmin
            .from("contacts")
            .insert({
              owner_id: form.owner_id,
              first_name: firstName,
              last_name: lastName,
              email: email || null,
              phone: phone || null,
              custom_fields: clean,
            })
            .select("id")
            .single();
          if (cerr) return Response.json({ error: cerr.message }, { status: 500, headers: cors });
          contactId = contact.id;
        }

        await supabaseAdmin.from("form_submissions").insert({
          form_id: form.id,
          owner_id: form.owner_id,
          data: clean,
          lead_id: leadId,
          contact_id: contactId,
          ip,
          user_agent: ua,
          referer,
        });

        // Nota na timeline com os campos preenchidos, na ordem definida no
        // formulário. Falha aqui não invalida o envio: apenas registra log.
        const filled = fields
          .filter((f) => clean[f.key])
          .map((f) => `${f.label || f.key}: ${clean[f.key]}`);
        if (filled.length && (leadId || contactId)) {
          const { error: aerr } = await supabaseAdmin.from("activities").insert({
            owner_id: form.owner_id,
            workspace_id: form.workspace_id,
            created_by: form.owner_id,
            assigned_to: form.owner_id,
            type: "note",
            subject: `Formulário enviado: ${form.name ?? params.slug}`,
            body: filled.join("\n"),
            related_lead_id: leadId,
            related_contact_id: contactId,
          });
          if (aerr) console.error("[forms.submit] activity insert failed", aerr.message);
        }

        await supabaseAdmin
          .from("forms")
          .update({ submit_count: (form.submit_count ?? 0) + 1 })
          .eq("id", form.id);

        return Response.json(
          {
            ok: true,
            message: form.success_message,
            redirect_url: form.redirect_url,
          },
          { headers: cors },
        );
      },
    },
  },
});
