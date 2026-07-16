// Rota de streaming do agente conversacional (Lovable AI Gateway via AI SDK).
// Autentica o bearer no próprio handler e passa um supabase client pronto para
// as tools de leitura — evita depender de getRequest() dentro do streamText,
// que fica sem contexto de request e retornava Unauthorized.
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { AGENT_SYSTEM_PROMPT } from "@/lib/ai-agent/system-prompt";
import { searchEntityImpl, listPipelinesImpl, lookupUserImpl } from "@/lib/ai-agent/tools-impl";

function extractMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export const Route = createFileRoute("/api/agent/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages?: UIMessage[];
          sessionId?: unknown;
          pagePath?: unknown;
        };
        const { messages } = body;
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }
        const sessionId = isUuid(body.sessionId) ? body.sessionId : crypto.randomUUID();
        const pagePath = typeof body.pagePath === "string" ? body.pagePath.slice(0, 200) : "";

        // Autentica bearer manualmente.
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Missing Supabase env", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (claimsErr || !userId) {
          return new Response("Unauthorized", { status: 401 });
        }

        const persistMessages = async (items: UIMessage[]) => {
          const rows = items.filter(
            (message) => message.role === "user" || message.role === "assistant",
          );
          if (!rows.length) return;

          const title = extractMessageText(
            rows.find((message) => message.role === "user") ?? rows[0],
          ).slice(0, 120);
          await supabase.from("copilot_sessions").upsert({
            id: sessionId,
            user_id: userId,
            owner_id: userId,
            title: title || `Assistente${pagePath ? ` · ${pagePath}` : ""}`,
          });

          const ids = rows.map((message) => message.id);
          const { data: existing } = await supabase
            .from("copilot_messages")
            .select("id")
            .in("id", ids);
          const existingIds = new Set((existing ?? []).map((row) => row.id));
          const inserts = rows
            .filter((message) => !existingIds.has(message.id))
            .map((message) => ({
              id: message.id,
              session_id: sessionId,
              role: message.role,
              content: extractMessageText(message),
              parts: message.parts as Json,
              sources: [] as Json,
            }));

          if (inserts.length) {
            await supabase.from("copilot_messages").insert(inserts);
          }
        };

        await persistMessages(messages);

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3.5-flash");

        // Helper: envelopa execução para nunca lançar dentro do stream.
        const safe = async <T>(fn: () => Promise<T>) => {
          try {
            return await fn();
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return { error: message } as const;
          }
        };

        const searchTool = tool({
          description: "Buscar contatos, empresas, negócios, leads ou tickets por nome/email",
          inputSchema: z.object({
            kind: z.enum(["contact", "company", "deal", "lead", "ticket"]),
            query: z.string(),
          }),
          execute: async (input) => safe(() => searchEntityImpl(supabase, input)),
        });

        const listPipelinesTool = tool({
          description: "Lista pipelines e etapas para deal ou ticket",
          inputSchema: z.object({ kind: z.enum(["deal", "ticket"]) }),
          execute: async (input) => safe(() => listPipelinesImpl(supabase, input)),
        });

        const lookupUserTool = tool({
          description: "Localiza um usuário do workspace pelo nome",
          inputSchema: z.object({ query: z.string() }),
          execute: async (input) => safe(() => lookupUserImpl(supabase, input)),
        });

        // Propose tools: apenas ecoam o payload; cliente renderiza card de aprovação.
        const propose = <S extends z.ZodTypeAny>(description: string, schema: S) =>
          tool({
            description,
            inputSchema: schema,
            execute: async (input) => ({ __proposal: true, payload: input }),
          });

        const result = streamText({
          model,
          system: `${AGENT_SYSTEM_PROMPT}\n\nContexto da tela atual: ${pagePath || "não informado"}. Use esse contexto para preferir atualizar o registro aberto quando a intenção do usuário for edição.`,
          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(50),
          tools: {
            search: searchTool,
            listPipelines: listPipelinesTool,
            lookupUser: lookupUserTool,
            proposeCreateContact: propose("Propor criação de contato (requer aprovação humana)", z.object({
              first_name: z.string(),
              last_name: z.string().optional(),
              email: z.string().optional(),
              phone: z.string().optional(),
              company_id: z.string().optional(),
              company_name: z.string().optional(),
            })),
            proposeCreateCompany: propose("Propor criação de empresa (requer aprovação)", z.object({
              name: z.string(),
              cnpj: z.string().optional(),
              description: z.string().optional(),
              phone: z.string().optional(),
            })),
            proposeCreateLead: propose("Propor criação de lead (requer aprovação)", z.object({
              first_name: z.string(),
              last_name: z.string().optional(),
              email: z.string().optional(),
              phone: z.string().optional(),
              source: z.string().optional(),
              company_name: z.string().optional(),
            })),
            proposeUpdateContact: propose("Propor atualização de contato existente (requer aprovação)", z.object({
              id: z.string(),
              first_name: z.string().optional(),
              last_name: z.string().optional(),
              email: z.string().optional(),
              phone: z.string().optional(),
              company_id: z.string().optional(),
              company_name: z.string().optional(),
            })),
            proposeUpdateLead: propose("Propor atualização de lead existente (requer aprovação)", z.object({
              id: z.string(),
              first_name: z.string().optional(),
              last_name: z.string().optional(),
              email: z.string().optional(),
              phone: z.string().optional(),
              source: z.string().optional(),
              company_name: z.string().optional(),
              status: z.enum(["new", "contacted", "qualified", "disqualified"]).optional(),
            })),
            proposeCreateDeal: propose("Propor criação de negócio (requer aprovação)", z.object({
              name: z.string(),
              value: z.number().optional(),
              pipeline_id: z.string().optional(),
              stage_id: z.string().optional(),
              company_id: z.string().optional(),
              contact_id: z.string().optional(),
              expected_close_date: z.string().optional(),
              description: z.string().optional(),
            })),
            proposeCreateTicket: propose("Propor criação de chamado (requer aprovação)", z.object({
              subject: z.string(),
              description: z.string().optional(),
              pipeline_id: z.string(),
              stage: z.string().optional(),
              priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
              assignee_id: z.string().optional(),
              contact_id: z.string().optional(),
              company_id: z.string().optional(),
              deal_id: z.string().optional(),
            })),
            proposeCreateActivity: propose("Propor registro de atividade/nota (requer aprovação)", z.object({
              type: z.enum(["note", "call", "email", "task", "meeting"]),
              subject: z.string().optional(),
              body: z.string().optional(),
              due_date: z.string().optional(),
              related_contact_id: z.string().optional(),
              related_company_id: z.string().optional(),
              related_deal_id: z.string().optional(),
              related_lead_id: z.string().optional(),
              related_ticket_id: z.string().optional(),
            })),
            proposeCreateTask: propose("Propor criação de tarefa (requer aprovação)", z.object({
              subject: z.string(),
              body: z.string().optional(),
              due_date: z.string().optional(),
              related_contact_id: z.string().optional(),
              related_company_id: z.string().optional(),
              related_deal_id: z.string().optional(),
              related_lead_id: z.string().optional(),
              related_ticket_id: z.string().optional(),
            })),
            proposeCreateMeeting: propose("Propor agendamento de reunião (requer aprovação)", z.object({
              subject: z.string(),
              body: z.string().optional(),
              starts_at: z.string(),
              related_contact_id: z.string().optional(),
              related_company_id: z.string().optional(),
              related_deal_id: z.string().optional(),
              related_lead_id: z.string().optional(),
            })),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onEnd: async ({ responseMessage }) => {
            await persistMessages([responseMessage]);
          },
        });
      },
    },
  },
});
