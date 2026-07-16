## Objetivo

Substituir o Copilot atual (Cmd+K) por um **assistente de IA conversacional** com FAB flutuante, capaz de:
- responder perguntas sobre os dados;
- **executar ações no CRM** via tool-calling (cadastros, negócios, chamados, atividades, reuniões, tarefas);
- **fazer perguntas de esclarecimento** quando encontrar ambiguidades, antes de propor a ação;
- **sempre confirmar** antes de gravar;
- persistir **uma conversa contínua por usuário**.

Uso de Lovable AI Gateway com AI SDK (tool calling) e RLS via `requireSupabaseAuth` — cada ação executa como o próprio usuário.

## Backend

### 1. Persistência da conversa (migration)
Reaproveita `copilot_sessions` / `copilot_messages` (uma sessão "default" por `owner_id`).

- Adiciona coluna `parts jsonb` em `copilot_messages` para persistir tool calls, tool results e cards de esclarecimento junto do texto.
- Índice em `copilot_sessions(owner_id, kind='assistant')`.
- RLS já cobre por `owner_id`.

### 2. Server functions — tools do agente
Novo `src/lib/ai-agent/tools.functions.ts` com `createServerFn` + `requireSupabaseAuth` (RLS aplica como o usuário):

**Read-only (executam sem aprovação):**
- `agentSearchEntity({ kind, query })` — busca por nome/e-mail em contact|company|deal|lead|ticket, retorna até 5 matches com `{ id, label, extra }`. **Base do fluxo de desambiguação.**
- `agentListPipelines({ kind })` — pipelines/etapas.
- `agentLookupUser({ query })` — resolve responsável/mencionado por nome.

**Mutadoras (marcadas `needsApproval: true`):**
- `agentCreateContact`, `agentCreateCompany` (com enriquecimento CNPJ), `agentCreateLead`
- `agentCreateDeal`, `agentCreateTicket`
- `agentCreateActivity` (nota/ligação/e-mail), `agentCreateMeeting`, `agentCreateTask`
- `agentMergeCompanies({ primary_id, duplicate_id })` — para o caso "mesclar Acme A e Acme B".

Cada função valida entrada com Zod, reusa helpers existentes (ex.: `enrichCompanyByCNPJ`, criação de meetings) e retorna `{ id, url, summary }`.

### 3. Rota de chat streaming
Novo `src/routes/api/agent/chat.ts` autenticada, com AI SDK + Lovable AI Gateway (`openai/gpt-5.5`):

- Provider helper conforme `ai-sdk-lovable-gateway`.
- Tools declaradas com `tool({ inputSchema, execute, needsApproval })`.
- `stopWhen: stepCountIs(50)` — o modelo pode alternar entre buscar, perguntar, buscar de novo e só então propor a criação.
- Histórico carregado da sessão default; persiste user+assistant em `onFinish` via `toUIMessageStreamResponse({ originalMessages, onFinish })`.

### 4. System prompt — política de esclarecimento

Regras explícitas no prompt (traduz para PT-BR o comportamento do exemplo do usuário):

1. **Sempre** iniciar chamando `agentSearchEntity`/`agentLookupUser`/`agentListPipelines` para resolver todos os vínculos por **nome amigável, nunca por UUID**.
2. Se uma busca retornar **0 resultados** e o vínculo é opcional → prossegue sem ele. Se é obrigatório → pergunta se deve criar a entidade dependente primeiro (ex.: "Não achei a empresa Acme. Quer que eu crie?").
3. Se retornar **≥ 2 resultados** para um mesmo vínculo → **NÃO** propor ação ainda; responder em texto com opções enumeradas `a)`, `b)`, `c)` incluindo, quando aplicável, `a) Mesclar` (para empresas/contatos duplicados) e `n) Criar nova`. Aguarda resposta do usuário.
4. Se campos obrigatórios estiverem faltando (ex.: pipeline para um negócio, entidade-alvo para uma atividade) → perguntar antes de qualquer tool mutadora.
5. Só depois de tudo resolvido, chamar a tool mutadora, que dispara o **card de aprovação** no cliente.
6. Sem inventar valores; ao propor defaults (etapa inicial do pipeline, prioridade "média"), deixar explícito no card de aprovação.

Poucos exemplos few-shot no prompt cobrindo: empresa duplicada, contato sem empresa vinculada, atividade sem entidade-alvo, negócio sem pipeline.

## Frontend

### 5. Substituir o Copilot Cmd+K
- `src/components/copilot-cmdk.tsx` → substituído por `src/components/ai-agent/agent-drawer.tsx` (Sheet lateral direito, 480px). Cmd+K continua abrindo o mesmo drawer.
- FAB único (`Sparkles`) no canto inferior direito.
- AI Elements: `Conversation`, `Message`, `MessageResponse`, `PromptInput`, `Tool`, `Shimmer` (instalar via `bun x ai-elements@latest add ...`).
- Cliente: `useChat` com `DefaultChatTransport({ api: '/api/agent/chat' })`, renderizando `message.parts`.

### 6. UX de esclarecimento vs. aprovação (dois momentos distintos)

**a) Esclarecimento (pré-execução):** as opções `a)`, `b)`, `c)` vindas do modelo em texto são renderizadas como **chips clicáveis** logo abaixo da mensagem. Clicar num chip envia automaticamente a resposta correspondente (ex.: "b) Escolher a Acme A") — o usuário também pode digitar livremente. Não há gravação envolvida nesta etapa.

**b) Aprovação (pré-gravação):** para cada tool part mutadora em `input-available`, renderiza `ToolApprovalCard` com resumo dos campos (com nomes resolvidos, não UUIDs) + botões **Aprovar** / **Cancelar** que chamam `addToolResult({ approved: true|false })`. Após execução → card verde com link para a entidade; erros → card vermelho.

Read-only tools mostram apenas um chip discreto ("Buscando empresas…" / "Encontrei 2 empresas").

### 7. Estados e UX
- Empty state com 4 sugestões contextuais.
- Shimmer "Pensando…" em `submitted`/`streaming`.
- Input com autofocus após envio, aprovação e clique em chip de esclarecimento.
- Botão "Nova conversa" limpa `copilot_messages` da sessão default (sem threads).
- Erros de gateway (429/402) via toast + linha inline.

### 8. Limpeza
- Remove `<CopilotCmdK />` do root; substitui pelo novo componente.
- Mantém `copilot.tsx` (Recruiter Copilot ATS) e `chat-trigger.tsx` (mensageiro) intactos.

## Segurança

- Tools rodam via `requireSupabaseAuth` — RLS autoritativa; modelo nunca acessa `service_role`.
- `LOVABLE_API_KEY` só server-side.
- Confirmação client-side é UX; autorização real é RLS.
- Validação Zod estrita; erros voltam estruturados ao modelo, que reformula ou pergunta.

## Arquivos

**Novos**
- `src/components/ai-agent/agent-drawer.tsx`
- `src/components/ai-agent/agent-trigger.tsx`
- `src/components/ai-agent/tool-approval-card.tsx`
- `src/components/ai-agent/tool-result-card.tsx`
- `src/components/ai-agent/clarification-chips.tsx` — extrai `a)`, `b)`, `c)` do texto do assistente
- `src/lib/ai-agent/tools.functions.ts`
- `src/lib/ai-agent/system-prompt.ts`
- `src/lib/ai-gateway.server.ts` (se ausente)
- `src/routes/api/agent/chat.ts`
- migration: `parts jsonb` em `copilot_messages` + índice

**Alterados**
- `src/routes/__root.tsx` — troca `<CopilotCmdK />` por `<AgentTrigger />` + `<AgentDrawer />`.
- `package.json` — `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible` + AI Elements.

**Removidos**
- `src/components/copilot-cmdk.tsx`.

## Fora do escopo

- Threads múltiplas.
- Update/delete e ações em massa.
- Voz (STT/TTS).
- Undo pós-execução.

## Validação manual

1. "Crie um contato João Silva, joao@acme.com, empresa Acme" com 2 Acmes cadastradas → IA responde com opções `a) Mesclar / b) Acme A / c) Acme B / n) Criar nova`, renderizadas como chips clicáveis; nenhuma gravação ocorre até a escolha.
2. Escolher `b)` → IA mostra card de aprovação com "Empresa: Acme A (SP)" → Aprovar → card verde com link.
3. "Registrar uma ligação com Pedro" sem contato Pedro cadastrado → IA pergunta se cria o contato antes.
4. "Novo negócio Contrato XPTO" sem pipeline → IA pergunta o pipeline listando opções.
5. Recarregar → conversa persistida retorna com chips e cards no estado anterior.
6. Cancelar aprovação → nada é gravado; conversa segue.
