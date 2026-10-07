# Matriz de paridade ChatSuite → TechERP (Agentes de IA)

Versão 1 · 2026-10-07 · fonte: inventário observado na interface ChatSuite (conta97, 06/10/2026).
Itens marcados "não validado" no inventário não são tratados como comportamento confirmado.

Legenda de status: **ausente** · **interface** (tela/editor) · **persistido** (banco com RLS) ·
**executável** (runtime usa o parâmetro) · **teste simulado** (sandbox com ferramentas mockadas, coberto por teste) ·
**homologado real** (provado contra o provedor real).

Contrato comum: `src/lib/agents/flow/catalog.ts` (tipos, campos, defaults, validação, saídas, resumo),
`src/lib/agents/flow/runtime.ts` (validação de grafo + executor + trace), `src/lib/agents/flow/sandbox-tools.ts`
(ferramentas simuladas, zero efeitos), `src/components/agents/flow/node-config-form.tsx` (editor contextual).
Testes: `src/lib/agents/flow/runtime.test.ts`, `src/components/agents/prototypes/model.test.ts`.

**Situação geral: não é 100%.** O fluxo, os editores por tipo e o executor existem e são testados no sandbox.
Persistência multiagente, runtime de produção ligado ao grafo e integrações externas seguem pendentes (ver final).

## Construção do fluxo

| Recurso observado | Campos confirmados | Equivalente TechERP | Status | Evidência / dependência |
|---|---|---|---|---|
| Canvas visual | nós, conexões, paleta por categoria, seleção, zoom, minimapa, ajustar, bloqueio, desfazer/refazer, duplicar, busca | `prototypes/flow.tsx`, `flow-nodes.tsx`, `flow-edges.tsx` | interface + teste simulado | Playwright `/tmp/browser/nodes`; organização automática: **ausente** |
| Importar/exportar JSON | arquivo JSON | `flow.tsx` exportJson/importJson (valida tipos) | interface | — |
| Modelos de fluxo (Atendimento simples, Qualificador→Vendas, FAQ+escalar) | — | — | **ausente** | pendente |
| Conferência do fluxo | contador de pendências | `validateGraph` (obrigatórios, portas, ciclos, inalcançáveis, ferramenta indisponível) | executável + teste simulado | `runtime.test.ts` |
| Início | — | `start`: origem Receptivo/Prospecção/Ambas, incluir histórico | executável + teste simulado | origem filtra execução |
| Agente | modelo, raciocínio, meta, tom, estilo, emojis, preço, objetivo, coletar, quando pessoa, prompt, linhas, atraso | `agent` | interface; executor chama `tools.generate` | modelo real via `aiChatFetch`: **pendente** |
| Gerar Prompt | botão | `buildPrompt` (determinístico a partir dos campos) | executável (local) | geração por IA: pendente |
| Classificar | nome, critério, exemplos, padrão | `classify` (uma saída por categoria) | executável + teste simulado | sandbox casa exemplos; classificação por LLM: pendente |
| Condição | E/OU; intenção, mensagem, nome/e-mail/telefone, atributo; é/não é/contém/não contém/preenchido/vazio | `condition` saídas sim/não | executável + teste simulado | ramificação testada |
| Proteções | PII, moderação, jailbreak, NSFW, URLs, injection, customizada, continuar mesmo assim, ok/blocked | `guardrails` | executável + teste simulado | detectores por padrão; moderação por modelo: pendente |
| Aprovação | o que aprovar, pergunta, recusa, exige humano | `approval` (pausa com `pausedAt`) | executável + teste simulado | retomada persistida: pendente |
| Enviar resposta | (painel vazio no inventário) | `reply` com variáveis | executável + teste simulado | campos propostos, não observados |
| Fim / Nota | — | `end` (status) / `sticky` (visual, não executa) | executável / interface | visual distinto (CSS) |
| Variáveis {{nome}} {{telefone}} {{email}} {{empresa}} | inserir no campo em foco | `NodeConfigForm` + `interpolate` | executável + teste simulado | — |

## Conhecimento e ferramentas

| Recurso | Equivalente | Status | Dependência |
|---|---|---|---|
| Buscar KB (fontes, sempre consultar) | `kb_search`: fontes permitidas, relevância mínima, fallback | executável + teste simulado (escopo + vencimento) | ingestão/retrieval real: **pendente** |
| Base RAG (upload PDF/TXT/DOCX, trechos, status) | aba Conhecimento (texto local) | interface parcial | upload/ingestão/reprocessamento: **ausente** |
| Governança comercial (tipo, fonte, responsável, revisar antes de) | `expiresAt` no sandbox | parcial | campos de UI: pendente |
| Perguntas sem resposta / treinador / revisão de aprendizado | contador "0 neste teste" | interface mínima | **pendente** |
| Catálogo | `catalog`: ativos, pode citar preço, categoria | executável + teste simulado | serviços reais do workspace: pendente; BPO inativo é filtrado |
| Buscar cliente | `find_customer` | executável (sandbox) | CRM real: pendente |
| Capturar lead | `capture_lead`: contato/negócio, funil, etapa, dedupe, só com evidência | interface + efeito simulado | funis/etapas reais: pendente (opções demo rotuladas) |
| Etiquetas permitidas | `tag` | interface + efeito simulado | etiquetas reais da Inbox: pendente |
| Enviar mídia | `send_media` biblioteca aprovada | interface + efeito simulado | storage: pendente |
| Agendar lembrete | `reminder` minutos + mensagem | interface + efeito simulado | respeito à janela 24h já existe no SDR |
| Agendamento | `schedule`: anfitrião, distribuição, duração, buffer, antecedência, fuso, tipo, confirmação, notificações | executável + teste simulado (anfitrião por agente) | Google Agenda: **depende de credencial/homologação** |
| Handoff humano | `handoff`: destino, equipe/pessoa, mensagem, resumo, fora do expediente | executável + teste simulado | Inbox real: pendente |
| Transferência entre agentes | `transfer_agent` destinos permitidos (sem destino = bloqueado, diferente do ChatSuite) | executável + teste simulado | loop guard em produção: pendente |
| Nota interna | `internal_note` | executável + teste simulado | — |
| Avaliar atendimento | `evaluate` lê avaliação existente | executável (sandbox) | — |
| Prospecção ativa / canais / template / limites | `prospecting` + SDR existente (`src/lib/prospecting/sdr`) | SDR persistido e homologado no piloto; bloco: interface | ligar bloco ao SDR: pendente |
| HTTP Request | `http`: nome, descrição, método, URL {param}, cabeçalhos, corpo, auth, conexão, caminho | interface + validação SSRF/allowlist testada | adaptador servidor + cofre: **pendente**; bloqueia lançamento |
| Regras de ativação (gatilho/filtro/roteamento/horário/escalonamento) | — | **ausente** | pendente |

## Operação

| Recurso | Status | Observação |
|---|---|---|
| Lista/criar/duplicar/arquivar agentes | interface (local) | duplicar zera canal; persistência multiagente pendente |
| Persona / estilo / atraso / agregação / horário | persona e tom do SDR **persistidos e versionados** (rotas SDR); demais: campos do bloco Agente | agregação/rajadas já existem no SDR |
| Ativação, canais, homologação | homologação + allowlist **homologado real** no piloto SDR; protótipo: switch desabilitado | não ativar novos canais |
| Checklist de lançamento | interface (usa `validateStep` + `validateGraph`) | ferramenta indisponível bloqueia |
| Chat de teste | **teste simulado com o mesmo executor** + trace | anexos/áudio: ausentes (não exibidos como disponíveis) |
| Métricas operacionais e de qualidade | SDR tem métricas reais de fila/envio; protótipo: demonstrativas rotuladas | por agente/versão/origem: pendente |
| Supervisor, treinador, testes de regressão | **ausente** | pendente |
| Integrações Tecimob, Sienge, Loja Integrada, Mercado Livre, Omnibees, FlexCalls, TTS, multimodal, cursos | **ausente** | dependem de contrato/credencial; não simular conectividade |

## Pendências para chegar à paridade (ordem sugerida)

1. Migração aditiva: `ai_agents`, `ai_agent_versions` (draft/published, grafo JSON), `ai_agent_knowledge`, vínculo de canais; GRANT + RLS por workspace; reaproveitar persona/versões do SDR.
2. Server functions de salvar rascunho, publicar (promoção atômica) e rollback; editor real usando o mesmo `NodeConfigForm` com seletores alimentados por workspace (agendas, equipes, funis, etapas, fontes, conexões).
3. Adaptadores de produção de `Tools` (KB, catálogo, CRM, Inbox, agenda) e ligação do executor ao worker de inbound, com trace persistido e métricas por agente/versão/origem.
4. Ingestão de conhecimento (upload, trechos, validade, reprocessamento) e perguntas sem resposta.
5. HTTP no servidor com cofre e allowlist; integrações externas somente com documentação oficial e credenciais do usuário.
