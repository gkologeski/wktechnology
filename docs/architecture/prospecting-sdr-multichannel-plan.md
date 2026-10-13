# TechSales — Agentes, Prospecção e Fluxo Multicanal: plano por fases

Escopo autorizado pelo usuário (2026-10-13) para implementação real no TechSales,
incorporando a reorganização de `/prospecting` já concluída e ainda não publicada
(commit `a21eb8c0b`, ver `docs/architecture/prospecting-redesign-plan.md`).

Referências oficiais consultadas (desenho funcional, não ranking):

- Apollo — Create a Sequence: https://knowledge.apollo.io/hc/en-us/articles/4409231193101-Create-a-Sequence
- Outreach — Sales Engagement overview: https://support.outreach.io/support/solutions/articles/159000433237-sales-engagement-overview
- Salesloft — Cadence automation: https://www.salesloft.com/platform/cadence-automation
- lemlist — Conditions in a campaign sequence: https://help.lemlist.com/en/articles/8290177-how-to-use-conditions-in-your-campaign-sequence
- respond.io — Workflows overview / branch / send a message: https://respond.io/help/workflows/workflows-overview
- respond.io — AI Agents: https://respond.io/help/ai-agents/getting-started-with-ai-agents
- Twilio — WhatsApp key concepts (janela de 24h e template aprovado): https://www.twilio.com/docs/whatsapp/key-concepts

ChatSuite é referência funcional/visual indicada pelo usuário; não foi examinada
nesta implementação, portanto nenhuma afirmação de paridade é feita.

## Regras permanentes do escopo

- Sem prospecção real: nenhuma campanha ativada, nenhum disparo real, Lia
  permanece rascunho/desativada e novas campanhas nascem rascunho.
- Sem publicação até revisão final do usuário.
- RBAC preservado: workspace ativo canônico, membership ativa, deny prevalece,
  "Ver como" somente leitura, `service_role` apenas com gate no servidor.
- Migrations somente aditivas, com backup e teste isolado antes do banco
  compartilhado.
- Portfólio ativo inclui Engenharia de IA & Governança; BPO Administrativo/
  Financeiro e "WK sob medida" não são ofertas — históricos preservados.

## Fase 0 — P0 do WhatsApp (janela de 24 h e modelos) — EXECUTADA

Problema relatado: na Inbox do WhatsApp (+55 48 99110-4003 via +55 48 6137-0317)
o aviso de janela encerrada aparecia junto de "Nenhum modelo aprovado está
disponível", enquanto o texto livre e o botão enviar continuavam habilitados.

Diagnóstico real (consulta somente leitura ao provedor, sem expor credenciais):

- A conexão oficial responde 200 em `/phone_number`: id `1340110922521343`,
  `+55 48 6137-0317`, "WK Technology", `CLOUD_API`.
- `/message_templates` responde 200 com 5 modelos `APPROVED`/`MARKETING` em
  `pt_BR`: `mensagem001` … `mensagem005`.
- A leitura do catálogo pelo app já usa o provedor como fonte oficial
  (`src/lib/whatsapp/templates.server.ts`); a tabela local `wa_templates`
  (0 linhas) é apenas fallback quando o conector não está configurado. A tela
  antiga lia só a tabela local — daí a lista vazia do print.
- Defeito de interface independente do catálogo: a Inbox não consultava a
  janela de 24 h ao abrir a conversa. O estado "modelo obrigatório" só era
  ligado depois de um envio recusado pelo servidor, então o campo de texto, o
  anexo, o Ctrl/Cmd+Enter e o botão enviar seguiam habilitados fora da janela.

Entregas da fase:

1. Inbox consulta a janela ao selecionar a conversa; fora dela bloqueia texto
   livre, anexo, Ctrl/Cmd+Enter e envio antes da chamada ao servidor.
2. Estados distintos e visíveis: verificando janela, erro ao verificar (com
   repetir), canal não conectado, carregando modelos, erro ao carregar (com
   repetir), catálogo vazio de verdade.
3. Ação "Atualizar modelos" funcional (revalida o catálogo no provedor).
4. Rascunho preservado ao trocar de conversa/canal (escopo por conversa já
   existente; o bloqueio não apaga o texto).
5. Servidor continua revalidando janela, modelo aprovado, canal e permissões —
   nenhum envio depende apenas da interface.
6. Template enviado não abre a janela: a janela só avança com mensagem recebida
   (`last_inbound_at`), regra já aplicada em `isWithinServiceWindow`.

Aceite: com a conversa fora da janela, a lista mostra os 5 modelos aprovados do
canal correto, o texto livre fica bloqueado e o envio por modelo funciona.

## Fase 1 — Consistência dos pontos de envio — EXECUTADA

Entregas:

1. Política única em `src/lib/whatsapp/composer-policy.ts` (pura, testada) e
   hook único `src/hooks/use-whatsapp-composer.ts` (janela + catálogo).
2. Aplicada na Inbox do WhatsApp, na Inbox unificada (texto, anexo, atalho,
   botão de IA e envio bloqueados fora da janela, com atalho para o modelo),
   no diálogo de ficha/timeline (`send-whatsapp-dialog`) e no seletor de
   modelos das campanhas.
3. Estados distintos em todos: verificando, erro ao verificar, canal não
   conectado, carregando catálogo, erro de catálogo e catálogo vazio de
   verdade — com ação "Atualizar modelos".
4. `catch(() => [])` removido da validação de modelo: falha de catálogo agora
   devolve `TEMPLATE_CHECK_FAILED` (antes virava "modelo não aprovado").
5. Variáveis completas: cabeçalho de texto, corpo, mídia obrigatória, rodapé e
   botões lidos de `template-shape.ts`; o servidor recusa envio incompleto
   (`TEMPLATE_VARIABLES_INCOMPLETE`) e a Meta recebe o componente de header.
6. Chave de cache por workspace + canal (phone_number_id) + idioma.
7. `sendWhatsAppFromServer` (régua de cobrança) também exige modelo fora da
   janela.

Prova (somente leitura, sem envio): conta conectada +55 48 6137-0317
"WK Technology" (CLOUD_API) com 5 modelos APPROVED pt_BR, 3 variáveis cada;
na Inbox a conversa fora da janela lista mensagem001…mensagem005, o texto
livre fica bloqueado e "Enviar modelo" só habilita com as variáveis
preenchidas.

## Fase 2 — `/agents/sdr`: configuração completa por agente — EXECUTADA

Migration aditiva `0130_sdr_agent_per_agent_config` em `sdr_playbooks`:
`assigned_to`, `offer_keys`, `material_ids`, `allowed_tools`, `channels`,
`guardrails`, `kb_sources` (defaults preservam o comportamento atual).

Contrato único em `src/lib/prospecting/sdr/agent-config.ts` (schema, escopo de
catálogo/materiais, trecho de prompt), usado pelo runtime (`worker.server.ts`),
pelo teste do agente e pela nova aba "Configuração do agente". O workspace
controla apenas liga/desliga e limites técnicos; nenhum campo global
sobrescreve a configuração do agente. Logs por agente na mesma aba.

Provas isoladas (`agent-config.test.ts`): dois agentes no mesmo workspace com
catálogos e ferramentas distintos, persona em rascunho não vaza para produção,
agenda só é oferecida com a ferramenta ligada e turno de outro workspace é
descartado.

### Escopo original da fase

Identidade/persona/prompt, KB e catálogo ativo, ferramentas permitidas,
qualificação/CRM/variáveis, materiais, responsável e agenda dedicados,
handoff/fila/expediente, canais suportados, guardrails, teste com o prompt de
runtime, versões draft/publicação/rollback, logs e métricas. Vários agentes
independentes; configuração global não sobrescreve agente. Reaproveitar
`sdr_playbooks` / `sdr_agent_versions`, aditivo quando necessário.
Aceite: dois agentes coexistem com configurações distintas e o runtime usa o
agente escolhido, não o primeiro playbook.

## Fase 3 — Fluxo visual operacional (pendente)

Canvas com criar/salvar/editar/duplicar/validar/testar/publicar versão, zoom,
pan, nós arrastáveis, arestas e inspetor por tipo. Blocos: início (manual/
segmento/evento), e-mail, WhatsApp (canal + modelo aprovado + parâmetros),
esperar, aguardar resposta com timeout, condição E/OU, paralelo com junção
definida, ligar/desligar agente, qualificar/mapear CRM, material, agenda,
handoff, tag/campo, tarefa/ligação, encerrar. Cada bloco com parâmetros reais e
saídas sucesso/erro/timeout. Estender o motor de workflows existente
(`src/lib/workflows/engine/`), sem segundo motor.
Aceite: um fluxo salvo executa em modo de teste com provedores falsos e o
inspetor recusa publicar nó sem integração disponível.

## Fase 4 — Multicanal real (pendente)

E-mail e WhatsApp em ramos paralelos por contato com contexto unificado;
resposta em um canal pausa/cancela abordagens nos outros conforme política;
idempotência por workspace/run/nó/canal, leases CAS, retry/backoff, envio
incerto nunca repetido cegamente; falha de um canal não derruba o outro;
junção paralela com all/any e cancelamento explícito; inbound de e-mail real
aciona continuação.
Aceite: E2E multicanal com provedores falsos, sem envio real, cobrindo
duplicidade, opt-out, resposta e cancelamento.

## Fase 5 — Sincronização operacional e histórico (pendente)

Remetente/WABA por workspace, modelos, calendário, opt-out, deduplicação,
listas, horários e cotas comerciais separadas do disjuntor técnico. Sem canais
inexistentes (LinkedIn automático vira tarefa manual honesta). Histórico e logs
com run, nó, canal, agente, versão e status do provedor.
Aceite: histórico de uma execução mostra todos esses campos com dados reais.

## Gates

`bun run verify` e `bun run build` completos ao final de cada fase, com testes
significativos: catálogo lista no canal correto, erro diferente de vazio, janela
de 24 h, escopos own/team/workspace e outro tenant, agente ligado/desligado por
agente, grafo inválido/ciclo/paralelo/timeout/retry/opt-out/cancelamento por
resposta, rascunho vs publicado.
