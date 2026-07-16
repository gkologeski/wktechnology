# Plano — Corrigir agente de IA (buscas retornam Unauthorized)

## Diagnóstico

A conversa mostra dois problemas encadeados:

1. **Falha técnica (raiz):** todas as tools de leitura (`search`, `listPipelines`) retornam `Unauthorized`. Causa: em `src/routes/api/agent/chat.ts`, cada tool chama diretamente `agentSearchEntity({ data })`, `agentListPipelines({ data })` e `agentLookupUser({ data })`. Essas são `createServerFn` com `.middleware([requireSupabaseAuth])`, que lê o header `Authorization` via `getRequest()`. Quando invocadas server-side (dentro do `streamText`), o middleware não recebe o bearer do usuário — o token existe na request do `/api/agent/chat`, mas o wrapper de server-function não repassa esse header ao próprio middleware quando é chamado programaticamente durante o streaming assíncrono. Resultado: `Unauthorized: No authorization header provided` / `Invalid token`.

2. **Falha comportamental (agravante):** ao receber o erro, o agente propôs "criar tudo do zero sem verificar", violando as regras A/B/C do system prompt (nunca inventar, sempre resolver vínculos antes de propor). Ele deveria ter parado e reportado a falha técnica.

## Solução

### 1. Refatorar tools para não depender do middleware de server-function

Em `src/routes/api/agent/chat.ts`:

- No próprio handler `POST`, extrair o bearer do `request.headers.get("authorization")` e montar **uma vez** um `supabase` client autenticado (mesmo padrão de `requireSupabaseAuth`) + resolver `userId` via `supabase.auth.getClaims(token)`.
- Se não houver bearer válido → retornar `401` antes de iniciar o stream (o cliente já envia via `attachSupabaseAuth`).
- Extrair a lógica das 3 tools de leitura para funções puras em um novo `src/lib/ai-agent/tools-impl.ts` que recebem `(supabase, userId, input)`. As `createServerFn` existentes em `tools.functions.ts` passam a ser apenas wrappers que chamam essas funções puras (mantém compatibilidade se algum lugar as invocar).
- Cada `tool({ execute })` no route chama a função pura com o `supabase` já autenticado, capturado no closure.

Isso elimina totalmente o caminho `getRequest()` dentro do stream, que é onde o header se perde.

### 2. Endurecer comportamento em falha

No `AGENT_SYSTEM_PROMPT` (`src/lib/ai-agent/system-prompt.ts`), adicionar regra explícita:

> Se uma ferramenta de leitura retornar erro, **não** proponha criação às cegas. Informe o usuário do erro em texto, peça para tentar novamente, e só prossiga com criação se o usuário disser explicitamente "crie mesmo assim / considere como novo".

### 3. Tratamento de erro nas tools

Envolver cada `execute` em `try/catch` e devolver `{ error: string }` estruturado em vez de propagar exceção (o AI SDK propaga como falha do step). Assim o modelo consegue reagir e mostrar erro amigável em vez de alucinar.

### 4. Validação

- Abrir o drawer do agente em `/leads` e repetir o pedido de teste ("Existe empresa Caspita?"). Verificar em Network que `/api/agent/chat` retorna 200 e as tools produzem resultados reais (não `Unauthorized`).
- Confirmar que uma busca sem resultado retorna array vazio (não erro) e o agente pergunta "criar novo?" corretamente.
- Simular ausência de bearer (deslogar) → route responde 401 antes do stream.

## Detalhes técnicos

Arquivos alterados:
- `src/routes/api/agent/chat.ts` — extrai bearer, monta supabase, chama funções puras, try/catch por tool.
- `src/lib/ai-agent/tools-impl.ts` (novo) — funções puras `searchEntityImpl`, `listPipelinesImpl`, `lookupUserImpl` recebendo `supabase`.
- `src/lib/ai-agent/tools.functions.ts` — read-only fns viram wrappers finos; mutadoras permanecem inalteradas (continuam via `useServerFn` no cliente após aprovação, com bearer normal).
- `src/lib/ai-agent/system-prompt.ts` — nova regra de "não prosseguir em falha".

Sem migrations. Sem mudança de RLS. Sem mudança nas tools de escrita (aprovação humana intacta).

## Fora do escopo

- Não altero a UX do `AgentDrawer` nem o fluxo de aprovação.
- Não mexo em outras server functions do projeto.
