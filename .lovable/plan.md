# Painel de IA e uso da IA escolhida nas tarefas automáticas

## O que você vai ver
Uma nova página **Configurações › Painel de IA**, com:
- **Resumo no topo:** qual provedor e modelo estão em uso, o status da conexão e um atalho para trocar de provedor (leva a Integrações › Inteligência Artificial).
- **Indicadores do período** (7, 30 ou 90 dias):
  - total de chamadas;
  - custo estimado total;
  - custo médio por chamada;
  - taxa de erro.
- **Histórico de gatilhos:** uma tabela com cada chamada de IA, mostrando:
  - data e hora;
  - recurso que disparou (ex.: Copiloto, Resumo automático, Análise de sentimento, Transcrição de ligação);
  - origem ("Usuário" ou "Automático");
  - quem disparou;
  - provedor e modelo;
  - tokens usados;
  - custo estimado;
  - duração;
  - resultado ("Sucesso" ou "Falha").
- **Na tabela você pode:** buscar, filtrar por recurso, origem, provedor e resultado, navegar por páginas e exportar.
- **Estados da página:** carregando, vazio ("Nenhuma chamada de IA no período") e erro com botão para tentar de novo. Funciona em modo claro e escuro e no celular.
- **Quem vê:** os membros do workspace veem o painel; o custo e o histórico completo aparecem só para administradores.

## Tarefas automáticas usando a IA escolhida
As seis tarefas que hoje rodam sempre na Lovable AI passam a usar o provedor do workspace dono do registro:
- resumos automáticos;
- análise de sentimento de mensagens;
- análise de chamados internos;
- transcrição e resumo de ligações;
- sugestões de vínculo de contrato;
- sugestões de subetapa do pipeline.

**Como o workspace é descoberto:** a tarefa usa o `workspace_id` do próprio registro. Se ele não existir, usa o workspace do dono do registro. Se nenhum dos dois for encontrado, usa a Lovable AI e registra isso no histórico.

**Em caso de falha:** a regra continua a mesma de antes, sem troca automática de provedor. A falha aparece no histórico e marca o status do provedor como "Falha".

## Sobre o custo
- **Provedores externos:** o custo é **estimado**. A conta usa os tokens que o provedor devolve e uma tabela de preços por modelo que fica no sistema. Modelos que não estão na tabela mostram "Sem preço cadastrado".
- **Lovable AI:** o consumo sai dos créditos do workspace e não há um preço por chamada disponível. Por isso o painel mostra os tokens e "Créditos Lovable" em vez de um valor em dinheiro.
- **Preço exato:** o valor final é sempre o da fatura do provedor. O painel deixa isso claro.

## Detalhes técnicos
- **Migração:** tabela `ai_call_logs` com os campos:
  - `workspace_id`, `provider`, `model`, `feature` e `trigger_source` (`user` ou `automatic`);
  - `triggered_by`, `prompt_tokens`, `completion_tokens` e `estimated_cost_usd`;
  - `duration_ms`, `status`, `error` e `created_at`.
  
  Índice por (`workspace_id`, `created_at`). GRANT de select para authenticated e all para service_role. RLS: leitura só para administradores do workspace (`is_workspace_admin_v2`); só o servidor grava. Prompts e respostas **não** são guardados.
- **`aiChatFetch`:** passa a aceitar `{ workspaceId?, feature, triggerSource?, userId? }`.
  - mede a duração;
  - lê `usage` da resposta (para JSON, pelo clone; para stream, pelo último evento, quando existir);
  - grava o log sem bloquear e sem derrubar a chamada se o log falhar.
- **Nome do recurso:** cada um dos cerca de 25 pontos de chamada ganha o seu `feature` (catálogo de rótulos PT-BR em `src/lib/ai/features.ts`).
- **Tarefas automáticas:** as seis tarefas passam o `workspaceId` do registro com `triggerSource: "automatic"`. Nas funções chamadas por outras (`requestAiLinkSuggestions`, `requestSubstatusSuggestions`), o parâmetro é repassado por quem chama.
- **Preços:** tabela estática em `src/lib/ai/pricing.ts`, em USD por 1M de tokens de entrada e de saída, para os modelos sugeridos.
- **Server functions** em `src/lib/ai/ai-usage.functions.ts`, com `requireSupabaseAuth` e checagem de admin: `getAiUsageSummary` e `listAiCallLogs` (paginado e filtrado no servidor).
- **Tela:** rota `/_authenticated/settings/ai-panel`, com link na aba Integrações das Configurações. Usa PageHeader, MetricCard, FilterBar, Table, EmptyState e Skeletons.
- **Validação:** tsgo, ESLint, testes do cálculo de custo e da leitura de `usage`, build, uma chamada real para confirmar que o log é gravado e verificação da página no navegador.
