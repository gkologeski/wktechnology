// Rota de streaming do agente conversacional (Lovable AI Gateway via AI SDK).
// Estratégia:
// - Tools de LEITURA executam de verdade no servidor.
// - Tools de "propose*" apenas ecoam o payload para o cliente. O cliente renderiza
//   um card verde de aprovação e, na aprovação, chama diretamente a server function
//   correspondente (agentCreate*). Isso garante que nenhuma escrita ocorra sem
//   confirmação humana explícita.
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { AGENT_SYSTEM_PROMPT } from "@/lib/ai-agent/system-prompt";
import {
  agentSearchEntity,
  agentListPipelines,
  agentLookupUser,
} from "@/lib/ai-agent/tools.functions";

export const Route = createFileRoute("/api/agent/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3.5-flash");

        const searchTool = tool({
          description: "Buscar contatos, empresas, negócios, leads ou tickets por nome/email",
          inputSchema: z.object({
            kind: z.enum(["contact", "company", "deal", "lead", "ticket"]),
            query: z.string(),
          }),
          execute: async (input) => agentSearchEntity({ data: input }),
        });

        const listPipelinesTool = tool({
          description: "Lista pipelines e etapas para deal ou ticket",
          inputSchema: z.object({ kind: z.enum(["deal", "ticket"]) }),
          execute: async (input) => agentListPipelines({ data: input }),
        });

        const lookupUserTool = tool({
          description: "Localiza um usuário do workspace pelo nome",
          inputSchema: z.object({ query: z.string() }),
          execute: async (input) => agentLookupUser({ data: input }),
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
          system: AGENT_SYSTEM_PROMPT,
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

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
