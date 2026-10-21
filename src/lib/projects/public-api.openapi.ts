// Contrato OpenAPI 3.1 da API pública v1 do TechProjects. Exemplos são fictícios.
export const PROJECTS_OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "TechERP — API pública v1 (TechProjects)",
    version: "1.6.0",
    description:
      "Projetos, tarefas e apontamentos visíveis ao DONO da chave (mesmas permissões, negações e membership ativo da tela). Custos, tarifas e títulos financeiros nunca são expostos. Criação segue as regras do fluxo de horas: rascunho, vínculo com o projeto, sem sobreposição e sem competência fechada.",
  },
  servers: [{ url: "/api/public/v1" }],
  components: {
    securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Chave lvb_..." } },
    headers: {
      RateLimit: { schema: { type: "integer" }, description: "X-RateLimit-Limit / Remaining / Reset" },
      RequestId: { schema: { type: "string" }, description: "X-Request-Id para suporte" },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: { error: { type: "string" }, message: { type: "string" } },
      },
      Meta: {
        type: "object",
        properties: {
          limit: { type: "integer", maximum: 200 },
          offset: { type: "integer" },
          total: { type: "integer" },
          has_more: { type: "boolean" },
        },
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          status: { type: "string", enum: ["planning", "active", "on_hold", "done", "cancelled"] },
          company_id: { type: ["string", "null"], format: "uuid" },
          starts_at: { type: ["string", "null"], format: "date" },
          due_at: { type: ["string", "null"], format: "date" },
          deal_id: { type: ["string", "null"], format: "uuid" },
          can_track: { type: "boolean", description: "Dono da chave pode apontar hoje" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Task: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          project_id: { type: "string", format: "uuid" },
          title: { type: "string" },
          status: { type: "string" },
          assignee_id: { type: ["string", "null"], format: "uuid" },
          start_at: { type: ["string", "null"], format: "date" },
          due_at: { type: ["string", "null"], format: "date" },
          priority: { type: ["string", "null"] },
        },
      },
      TimeEntry: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          project_id: { type: "string", format: "uuid" },
          task_id: { type: ["string", "null"], format: "uuid" },
          user_id: { type: "string", format: "uuid" },
          entry_date: { type: "string", format: "date" },
          entry_kind: { type: ["string", "null"], enum: ["interval", "duration", "timer", null] },
          start_time: { type: ["string", "null"] },
          end_time: { type: ["string", "null"] },
          duration_seconds: { type: ["integer", "null"] },
          timezone: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          billable: { type: "boolean" },
          status: { type: "string", enum: ["draft", "submitted", "approved", "rejected", "locked"] },
          source: { type: "string" },
          revision: { type: "integer" },
          locked: { type: "boolean" },
          period_closed: { type: "boolean" },
        },
      },
      TimeEntryInput: {
        type: "object",
        required: ["project_id", "task_id", "entry_date"],
        additionalProperties: false,
        properties: {
          project_id: { type: "string", format: "uuid" },
          task_id: { type: "string", format: "uuid" },
          entry_date: { type: "string", format: "date" },
          mode: { type: "string", enum: ["interval", "duration"] },
          start_time: { type: "string", example: "09:00:00" },
          end_time: { type: "string", example: "10:30:15" },
          duration_seconds: { type: "integer", minimum: 60, maximum: 86400 },
          duration_minutes: { type: "integer", deprecated: true },
          timezone: { type: "string", example: "America/Sao_Paulo" },
          description: { type: "string", maxLength: 2000 },
          billable: { type: "boolean" },
          external_id: { type: "string", maxLength: 180 },
        },
      },
    },
  },
  security: [{ bearer: [] }],
  paths: {
    "/projects": {
      get: {
        summary: "Listar projetos (escopo read)",
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string", maxLength: 120 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": { description: "Página de projetos" },
          "401": { description: "Chave ausente/inválida/revogada/vencida" },
          "403": { description: "Escopo insuficiente ou dono inativo" },
          "429": { description: "Limite por chave atingido (Retry-After)" },
        },
      },
    },
    "/project-tasks": {
      get: {
        summary: "Listar tarefas (escopo read)",
        parameters: [
          { name: "project_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "offset", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Página de tarefas" } },
      },
    },
    "/time-entries": {
      get: {
        summary: "Listar apontamentos visíveis ao dono da chave (escopo read)",
        parameters: [
          { name: "project_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "user_id", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "offset", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Página de apontamentos" } },
      },
      post: {
        summary: "Criar apontamento em rascunho do dono da chave (escopo write)",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string", minLength: 8, maxLength: 200 },
            description: "Obrigatória (ou external_id no corpo). Válida por 7 dias.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TimeEntryInput" },
              example: {
                project_id: "00000000-0000-4000-8000-000000000001",
                task_id: "00000000-0000-4000-8000-000000000002",
                entry_date: "2026-03-04",
                start_time: "09:00:00",
                end_time: "10:30:15",
                timezone: "America/Sao_Paulo",
              },
            },
          },
        },
        responses: {
          "201": { description: "Criado (rascunho)" },
          "200": { description: "Repetição do mesmo pedido (Idempotent-Replayed: true)" },
          "400": { description: "Corpo inválido ou sem Idempotency-Key" },
          "403": { description: "Sem vínculo para apontar, sem permissão ou dono inativo" },
          "404": { description: "Atividade não pertence ao projeto" },
          "409": {
            description: "Conflito: mesma Idempotency-Key com outro conteúdo, sobreposição ou competência fechada",
          },
          "429": { description: "Limite por chave atingido" },
        },
      },
    },
  },
} as const;
