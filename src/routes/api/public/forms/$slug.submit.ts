import { validateEmailAddress } from "@/lib/email-address";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureLeadRelationsSafe } from "@/lib/leads/lead-relations";
import { checkLeadDuplicate } from "@/lib/leads/lead-duplicate-check";
import {
  formSubmitCorsHeaders,
  getVisitorIp,
  TURNSTILE_FAILED_MESSAGE,
  verifyTurnstileToken,
} from "@/lib/forms/public-submit-guard.server";

import {
  humanPhone,
  isPhoneValidationError,
  workspacePhoneCountry,
} from "@/lib/phone/phone-boundary";
type FormField = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select" | "number";
  required?: boolean;
};

export const Route = createFileRoute("/api/public/forms/$slug/submit")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, {
          status: 204,
          headers: formSubmitCorsHeaders(request.headers.get("origin")),
        }),
      POST: async ({ request, params }) => {
        // CORS restrito ao site institucional (www e raiz, HTTPS).
        const cors = formSubmitCorsHeaders(request.headers.get("origin"));
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

        const ip = getVisitorIp(request.headers);

        // Cloudflare Turnstile: validado no servidor antes de qualquer gravação.
        const turnstile = await verifyTurnstileToken(body["cf-turnstile-response"], ip);
        if (!turnstile.success) {
          console.warn("[forms.submit] Turnstile recusado", {
            slug: params.slug,
            codes: turnstile.errorCodes,
          });
          return Response.json(
            { ok: false, error: TURNSTILE_FAILED_MESSAGE },
            { status: 400, headers: cors },
          );
        }

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
        /** Telefones já normalizados em E.164 (o envio bruto fica em `clean`). */
        const phones: Record<string, string> = {};
        const phoneCountry = await workspacePhoneCountry(supabaseAdmin, form.workspace_id);
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
          if (f.type === "email" && raw != null && String(raw).trim()) {
            const result = validateEmailAddress(raw);
            if (!result.ok)
              return Response.json(
                { error: `${f.label}: ${result.message}`, code: "invalid_email", field: f.key },
                { status: 422, headers: cors },
              );
            clean[f.key] = result.value;
          }
          if (v && (f.type === "tel" || ["phone", "telefone", "tel"].includes(f.key))) {
            try {
              const e164 = humanPhone(v, { field: f.key, country: phoneCountry });
              if (e164) phones[f.key] = e164;
            } catch (e) {
              if (isPhoneValidationError(e)) {
                return Response.json(
                  { error: `${f.label}: ${e.message}`, code: e.code, field: f.key },
                  { status: 422, headers: cors },
                );
              }
              throw e;
            }
          }
        }

        const ua = request.headers.get("user-agent");
        const referer = request.headers.get("referer");

        let leadId: string | null = null;
        let contactId: string | null = null;
        /** Nome informado no envio quando difere do lead já cadastrado. */
        let submittedNameNote: string | null = null;

        const email = clean.email || clean.Email;
        const phone = phones.phone || phones.telefone || phones.tel;
        const firstName =
          clean.first_name || clean.firstName || (clean.name?.split(" ")[0] ?? "Lead");
        const lastName =
          clean.last_name ||
          clean.lastName ||
          (clean.name ? clean.name.split(" ").slice(1).join(" ") || null : null);
        const company = clean.company || clean.company_name || null;
        const jobTitle = clean.job_title || clean.cargo || null;

        if (form.target === "lead") {
          // Visitante nunca deve ver erro interno de duplicidade: se o lead já
          // existe, o envio é anexado a ele.
          const dup = await checkLeadDuplicate(supabaseAdmin, {
            workspaceId: form.workspace_id,
            email: email || null,
            phone: phone || null,
          }).catch(() => null);

          if (dup?.duplicate && dup.existingId) {
            leadId = dup.existingId;
            const { data: existing } = await supabaseAdmin
              .from("leads")
              .select(
                "id, first_name, last_name, email, phone, company_name, assigned_to, owner_id",
                // Cargo canônico somente quando informado no formulário.
              )
              .eq("id", leadId)
              .maybeSingle();
            if (existing) {
              const patch: {
                last_name?: string;
                email?: string;
                phone?: string;
                company_name?: string;
                job_title?: string;
                last_form_submission_at?: string;
              } = { last_form_submission_at: new Date().toISOString() };
              if (!existing.last_name && lastName) patch.last_name = lastName;
              if (!existing.email && email) patch.email = email;
              if (!existing.phone && phone) patch.phone = phone;
              if (!existing.company_name && company) patch.company_name = company;
              if (jobTitle) patch.job_title = jobTitle;
              const { error: uerr } = await supabaseAdmin
                .from("leads")
                .update(patch)
                .eq("id", leadId);
              if (uerr) console.error("[forms.submit] lead update failed", uerr.message);

              // Nome informado no envio difere do cadastro: destaca na nota.
              const submitted = [firstName, lastName].filter(Boolean).join(" ").trim();
              const current = [existing.first_name, existing.last_name]
                .filter(Boolean)
                .join(" ")
                .trim();
              if (submitted && current && submitted.toLowerCase() !== current.toLowerCase()) {
                submittedNameNote = submitted;
              }

              // Avisa o responsável de que o lead recebeu um novo envio.
              const notifyUser = existing.assigned_to || existing.owner_id;
              if (notifyUser) {
                const { error: nerr } = await supabaseAdmin.from("notifications").insert({
                  owner_id: notifyUser,
                  user_id: notifyUser,
                  workspace_id: form.workspace_id,
                  type: "form_submission",
                  title: "Novo envio de formulário",
                  body: `${current || submitted || "Lead"} enviou o formulário "${form.name ?? params.slug}" novamente.`,
                  link: `/leads/${leadId}`,
                  entity: "lead",
                  entity_id: leadId,
                });
                if (nerr) console.error("[forms.submit] notification failed", nerr.message);
              }
            }
          } else {
            const { data: lead, error: lerr } = await supabaseAdmin
              .from("leads")
              .insert({
                workspace_id: form.workspace_id,
                owner_id: form.owner_id,
                first_name: firstName,
                last_name: lastName,
                email: email || null,
                phone: phone || null,
                company_name: company,
                job_title: jobTitle,
                source: `form:${params.slug}`,
                custom_fields: clean,
                last_form_submission_at: new Date().toISOString(),
              })
              .select("id")
              .single();
            if (lerr || !lead) {
              console.error("[forms.submit] lead insert failed", lerr?.message);
              // Rede de segurança: se o insert falhou por duplicidade (regra do
              // banco), anexa o envio ao lead existente em vez de perder o contato.
              const retry = await checkLeadDuplicate(supabaseAdmin, {
                workspaceId: form.workspace_id,
                email: email || null,
                phone: phone || null,
              }).catch(() => null);
              if (retry?.duplicate && retry.existingId) {
                leadId = retry.existingId;
                const { error: uerr } = await supabaseAdmin
                  .from("leads")
                  .update({ last_form_submission_at: new Date().toISOString() })
                  .eq("id", leadId);
                if (uerr) console.error("[forms.submit] lead touch failed", uerr.message);
              } else {
                return Response.json(
                  { error: "Não foi possível enviar agora, tente novamente." },
                  { status: 500, headers: cors },
                );
              }
            } else {
              leadId = lead.id;
            }
          }
          // Garante empresa e contato vinculados ao lead
          const rel = await ensureLeadRelationsSafe(supabaseAdmin, leadId);
          contactId = rel?.contactId ?? null;
        } else {
          // Reaproveita contato existente por e-mail/telefone no mesmo workspace
          let existingContactId: string | null = null;
          if (email || phone) {
            let cq = supabaseAdmin
              .from("contacts")
              .select("id")
              .eq("workspace_id", form.workspace_id)
              .limit(1);
            cq = email ? cq.ilike("email", email) : cq.eq("phone", phone!);
            const { data: found } = await cq.maybeSingle();
            existingContactId = found?.id ?? null;
          }
          if (existingContactId) {
            contactId = existingContactId;
          } else {
            const { data: contact, error: cerr } = await supabaseAdmin
              .from("contacts")
              .insert({
                workspace_id: form.workspace_id,
                owner_id: form.owner_id,
                first_name: firstName,
                last_name: lastName,
                email: email || null,
                phone: phone || null,
                custom_fields: clean,
              })
              .select("id")
              .single();
            if (cerr || !contact) {
              console.error("[forms.submit] contact insert failed", cerr?.message);
              return Response.json(
                { error: "Não foi possível enviar agora, tente novamente." },
                { status: 500, headers: cors },
              );
            }
            contactId = contact.id;
          }
        }

        // Sem sessão: o tenant vem do formulário (o DEFAULT depende de auth.uid()).
        const { error: subErr } = await supabaseAdmin.from("form_submissions").insert({
          form_id: form.id,
          owner_id: form.owner_id,
          workspace_id: form.workspace_id,
          data: clean,
          lead_id: leadId,
          contact_id: contactId,
          ip,
          user_agent: ua,
          referer,
        });
        if (subErr) console.error("[forms] falha ao gravar envio:", subErr.code, subErr.message);

        // Nota na timeline com os campos preenchidos, na ordem definida no
        // formulário. Falha aqui não invalida o envio: apenas registra log.
        // O corpo é HTML (a timeline renderiza via HtmlContent/DOMPurify), com
        // escape nos valores enviados pelo visitante.
        const escapeHtml = (s: string) =>
          s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        const filled = fields
          .filter((f) => clean[f.key])
          .map(
            (f) =>
              `<p><strong>${escapeHtml(String(f.label || f.key))}:</strong> ${escapeHtml(String(clean[f.key]))}</p>`,
          );
        if (submittedNameNote) {
          filled.unshift(
            `<p><em>Nome informado no envio: ${escapeHtml(submittedNameNote)}</em></p>`,
          );
        }
        if (filled.length && (leadId || contactId)) {
          const { error: aerr } = await supabaseAdmin.from("activities").insert({
            owner_id: form.owner_id,
            workspace_id: form.workspace_id,
            created_by: form.owner_id,
            assigned_to: form.owner_id,
            type: "note",
            subject: `Formulário enviado: ${form.name ?? params.slug}`,
            body: filled.join(""),
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
