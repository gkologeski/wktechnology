# Canais sociais — auditoria e implementação

Data: 12/11/2026. Base auditada: c288067e60847c8e66c19d3d36e4c38db9f12751.
Escopo autorizado: auditoria e implementação de LinkedIn via Unipile; Facebook/Instagram permanecem no plano, sem alteração nesta frente.

## Evidências e o que reaproveitar

| Área | Já existe | Lacuna / decisão |
|---|---|---|
| LinkedIn | `/settings/integrations/linkedin`, Hosted Auth v2, callback e observabilidade | Fluxos escolhem a última conta por workspace; corrigir titularidade e correlação. |
| Dados | `unipile_accounts`, rate buckets, request/message logs | Metadados agregados em produção: uma conta conectada e uma pendente. Nenhuma credencial consultada. Estado conectado não prova envio/recebimento. |
| Permissões | Catálogo `system.linkedin` e RLS baseada no proprietário | RLS original de contas só compara owner; falta cruzar workspace ativo, membership e chaves efetivas. |
| Envios | DM/convites e sequências de sourcing TechHire | Reaproveitar adaptador; não reutilizar acesso administrativo sem verificar o destinatário e o workspace. |
| Limites | Tetos diários, janela, intervalos e request logs | Incremento após envio não é atômico; concorrência ultrapassa cota. Falhas não consomem tentativa; faltam janela semanal, pausa persistente e Retry-After. |
| Webhook | HMAC e normalização v1/v2; resposta pausa sourcing | Assinatura implementada diverge da v2 atual (`unipile-signature`, timestamp + corpo); falta idempotência inbound. Resposta não é opt-out comercial. |
| Atendimento | Registry, bindings, identidade por canal e fila SDR | Enum e runtime aceitam WhatsApp/email/chat; LinkedIn precisa adaptador, conta pessoal e fronteira próprias. |
| Inbox | Casco compartilhado e associação comercial | Não existe canal LinkedIn com mensagens persistidas e leitura autorizada. |
| Sequências | Público, releases, execução, espera e handoff | Canais comerciais atuais: email/WhatsApp/chamada. Adicionar etapa LinkedIn com conta explícita e interrupção por resposta. |
| Ajuda | Artigo Core de LinkedIn e catálogo editorial | Atualizar junto de cada pacote; não publicar ajuda que descreve recursos ainda ausentes. |

## Plano revisado em pacotes verificáveis

| Pacote | Conteúdo | Situação | Estimativa restante |
|---|---|---|---|
| A | Auditoria código/banco/documentação e desenho | Auditada; produção só leitura | Concluído nesta frente de auditoria |
| B | Contas pessoais, owner+tenant, RLS e logs; correção dos bloqueios de lint | Implementado e validado localmente; sem aplicação/publicação | Aceite externo no G |
| C | Hosted Auth v2, conta exata, state de uso único/expiração, Scope pessoal e reconexão legada; webhook assinado e idempotente | Implementado localmente; teste real com a integradora ainda pendente | Aceite externo no G |
| D | Reserva atômica, cotas dia/semana, pausa/Retry-After, recibos e adiamento sem pular etapas | Implementado localmente; testes SQL e regressão executados | Aceite externo no G |
| E | LinkedIn no registry e Inbox; conta pessoal, permissão e associação CRM | Implementado; testes SQL, transporte e tela executados em ambiente isolado | Pronto para aceite de publicação |
| F | LinkedIn nas sequências e agentes; conta explícita, interrupção por resposta/recusa | Implementado; fila SDR e ciclo recibo→resposta→sequência validados em PostgreSQL isolado | Pronto para aceite de publicação |
| G | Aceite integrado e preparação da publicação | Gates finais aprovados na revisão integrada; transporte real confirmado; pronto para publicar. Publicação não executada. | Sem implementação funcional pendente; implantação aguarda autorização |

Previsão inicial revisada: 24–40 h após auditoria. Restante após B–D: 15–25 h para E–G, mais disponibilidade da integradora para o aceite. A estimativa anterior 16–28 h não abrangia a correção das fronteiras legadas e da assinatura v2. Facebook/Instagram são uma frente posterior; não somar nem duplicar o esforço compartilhado sem novo levantamento.

## Proteções obrigatórias

- Menor limite conhecido; recomendações da Unipile não são limites oficiais garantidos do LinkedIn. As páginas v1 e v2 consultadas divergem em mensagens/dia; não fixar um número como direito contratual. Aplicar perfil conservador configurável e retornar motivo de bloqueio.
- Tentativas reservadas atomicamente antes da chamada externa; todos os caminhos usam a mesma reserva. Não usar sleeps longos em request HTTP: agendar a próxima execução.
- Nenhum retry cego em envio de resultado incerto; reconciliar antes. Restrição/challenge/desconexão pausam a conta, sem trocar remetente para contornar.
- Credenciais apenas no servidor; autenticação hospedada, sem senha/cookies no TechERP. Confirmar variáveis e versão da API sem revelar valores.
- Conta pessoal é privada por padrão. Compartilhamento explícito será uma capacidade posterior, sem grants automáticos a cargos existentes.
- Resposta pausa cadência; recusa adiciona supressão. Resposta não deve ser rotulada como recusa.

## Aceite e status de implantação

- Produção permanece intacta. Nenhuma migração deste lote aplicada, mensagem enviada ou conta alterada.
- Conta de teste definida: guilherme@wktechnology.com.br. Consulta apenas de metadados confirmou uma conta LinkedIn conectada, com provider ID e workspace; isso não comprova envio/recebimento.
- Migrações 0336–0341 registradas no journal, em ordem. Credenciais somente nas variáveis seguras; novas contas precisam de Service Key apta a gerenciar Scopes. Reconexão de conta legada conhecida não a transfere para um Scope.
- 42 cenários SQL em PostgreSQL 17 descartável: identidade sintética, DDL/RLS/RPC reais, concorrência e isolamento; não é autenticação GoTrue ou aceite na Unipile.
- Aceite local final: 3.080 testes Vitest aprovados, 42 cenários SQL incluídos em teste de integração, tipos e lint sem erros. Verify completo em 71.2 s. Os 16 arquivos de formatação foram conferidos por árvore sintática normalizada, sem diferença funcional.
- Build final Node 22 sequencial aprovado em 162.1 s; Nitro em 72.2 s e entrada gzip em 262,223 bytes. Performance gate aprovado sem elevar limites. Verify e build conferem com o mesmo fingerprint: `3d06ca5b01dc84cbbe9d899b7c27fe6ee4e1a971e62405e03afa8a733545e398`.
- Ajuda de workspace atualizada para versão 4 e guia pessoal criado na versão 1, com controle próprio de leitura. Cobertura: 248/248 telas, 428 artigos. Sincronização editorial no banco ainda não executada.
- O recurso completo NÃO está pronto para publicar: faltam E, F e aceite externo de G. O lote B–D não deve ser apresentado como Inbox/SDR/automação comercial concluída.

Fontes verificadas:
- https://developer.unipile.com/v2.0/docs/authenticate-with-hosted-auth
- https://developer.unipile.com/v2.0/docs/scopes
- https://developer.unipile.com/v2.0/docs/configure-a-webhook
- https://developer.unipile.com/v2.0/docs/provider-limits-and-restrictions

## Revisão complementar

- URL e menu de LinkedIn usam `system.linkedin`, incluindo leitura pessoal, sem exigir administração genérica de integrações.
- Tokens de candidatos são consultados com o cliente do usuário, `hr_record_access` e filtro de workspace antes de qualquer chamada externa; histórico exige a mesma visibilidade.
- Recibos incertos pausam sourcing para revisão; backpressure agenda nova tentativa mantendo a etapa atual.
- O código está registrado em commits locais; nenhum push, merge ou deploy realizado.

## Revisão integrada de 13/11/2026 — ainda sem publicação

- Inbox pessoal em `/inbox/linkedin`: histórico paginado e realtime filtrado por conversa, resposta na conversa exata, fechamento/reabertura e associação autorizada a Contato/Lead/Empresa/Negócio. Casco White Label compartilhado; testes verificam compositor presente e bloqueio de consulta/envio sem permissão.
- Canais: descoberta só da conta pessoal no workspace, vínculo ao agente publicado e identidade do canal; receptivo e respostas de sequência configurados separadamente. Nenhuma credencial é copiada para o registro do canal.
- SDR: mesma fila, persona publicada, ferramentas, auditoria e CAS dos outros canais. Limites adiam resposta; humano assume sem compartilhar a conta pessoal. Materiais privados limitados a 5 MB no LinkedIn.
- Sequências: etapa LinkedIn com conta explícita, mensagem/variáveis, público compartilhado com URL LinkedIn, condição de perfil disponível, espera por resposta, agente ou humano. Recibo persiste antes da projeção na Inbox. Resposta acorda a sequência e conserva o agente selecionado.
- Nenhum retry cego: novo texto/nonce não contorna recibo incerto na conta; backpressure só libera lease sem avançar etapa quando o envio não começou.
- Três permissões próprias da Inbox registradas sem concessão automática: `techsales.inbox.linkedin.view.own`, `.create.own`, `.manage.own`. Conexão pessoal e permissões de sequência/canal continuam obrigatórias.
- Migrações novas desta revisão: 0342 (Inbox), 0343 (runtime compartilhado), 0344 (sequências). A preparação anterior 0336–0341 também precisa estar aplicada, na ordem do journal. Não reaplicar migrações já registradas.

### Limites explícitos da entrega

A Inbox projeta o journal recebido e envios confirmados pelo TechERP; não importa automaticamente todo o histórico anterior nem envios feitos no aplicativo nativo LinkedIn. A etapa comercial é mensagem, sem convite automático/InMail comprado. O simulador numérico existente cobre e-mail/WhatsApp/chamadas e avisa que as cotas reais LinkedIn podem prolongar a duração. A autorização de envio não é garantia de entrega nem de ausência de restrição pelo provedor.

### Preparação da publicação (não executada)

1. Revisar o commit da branch `codex/linkedin-unipile`, mantendo a main e o aplicativo publicado inalterados até autorização.
2. No ambiente de destino, confirmar variáveis Unipile já configuradas, escopo pessoal e webhook v2 assinado. Nunca colocar segredos no Git ou no relatório.
3. Aplicar somente as migrações pendentes 0336–0344 e sincronizar os tipos; publicar o backend/frontend da mesma revisão.
4. Conferir as chaves da Inbox na matriz, conectar a conta pessoal e atualizar contas em Canais. Habilitar explicitamente a conta e o agente publicado para cada finalidade.
5. Rodar o aceite no destino: usuário proprietário, sem chave, deny, outro workspace e inativo; enviar somente ao perfil de teste autorizado da Andressa, conferir recibo, resposta na Inbox, pausa da sequência e atendimento humano. Não repetir o teste externo se houver resultado incerto.
6. Se necessário, desativar o canal/binding e pausar as sequências LinkedIn antes de reverter o código. Preservar tabelas, journal e recibos; não apagar histórico para fazer rollback.

O teste real de credencial no aplicativo existente retornou “Chave da API Unipile válida”. Isso não equivale ao teste de envio/recebimento da revisão nova. O diagnóstico externo único foi solicitado sem autorização de editar arquivos, migrar ou publicar; seu resultado fica registrado no relatório de aceite.

### Correção confirmada no provedor (13/11)

O diagnóstico real encontrou HTTP 501 no endpoint genérico `/{account}/chats/send`. A caixa pessoal habilitada foi consultada antes da correção: `CLASSIC_PRIMARY`. O adaptador de DM agora usa `/{account}/inboxes/CLASSIC_PRIMARY/chats/send` com `users_ids` como string para conversa 1:1, e a listagem usa a mesma caixa. Respostas a conversas existentes continuam usando `/{account}/chats/{chat}/messages/send`. A resposta `ChatStarted` fornece IDs distintos de chat e mensagem; um `Chat.id` isolado nunca é aceito como confirmação de mensagem.

Uma única tentativa corrigida retornou HTTP 200 e a leitura posterior confirmou a mensagem exata e o mesmo recibo. O teste foi somente de transporte com a credencial existente, sem editar código remoto, aplicar migrações ou publicar. Por ser diagnóstico externo à aplicação, não foi inserido artificialmente nos contadores ou na Inbox do ERP. Os fluxos completos de Inbox/canais/SDR/sequências foram exercitados em PostgreSQL isolado. O aceite no aplicativo de destino continua sendo uma verificação pós-implantação, não uma alegação de publicação já realizada.

Fontes do contrato v2: [Start a Chat from Inbox](https://developer.unipile.com/v2.0/reference/startchatfrominbox), [LinkedIn quickstart](https://developer.unipile.com/v2.0/docs/linkedin-quickstart). A entrega usa o produto LinkedIn pessoal Classic; não seleciona automaticamente Sales Navigator, Recruiter ou caixas de páginas de empresa.

### Recebimento v2

A revisão do contrato identificou também o evento `message.new` com o corpo da mensagem em `payload`. O parser agora aceita esse envelope, identifica `is_sender` dentro do payload para ignorar ecos de saída, preserva os eventos legados e não interpreta leitura/edição como resposta. Payload reduzido usa a conta exata, a conversa e a mensagem conhecidas na API v2, passando pela mesma reserva de leitura e verificação do proprietário; IDs divergentes são recusados. Falha de persistência responde 503 para retry idempotente. `account.remove` desativa a conta mapeada e `account.locked` a pausa; falha de sincronização de histórico não equivale a desconexão do atendimento ao vivo.

Contrato: [Event types](https://developer.unipile.com/v2.0/reference/event-types-1) e [Configure a webhook](https://developer.unipile.com/v2.0/docs/configure-a-webhook).

### Compatibilidade com a main em 13/11

A branch incorporou a main `634605d2d`, preservando as novas funcionalidades e artigos das campanhas de ligação. O journal mantém integralmente as migrações de chamadas da main e acrescenta depois, ainda não aplicadas, as migrações deste pacote: `0336_unipile_personal_account_access`, `0337_unipile_secure_auth_flow`, `0338_unipile_atomic_limits`, `0339_unipile_inbound_idempotency`, `0340_unipile_delivery_receipts`, `0341_unipile_log_access`, `0342_linkedin_inbox`, `0343_linkedin_service_runtime` e `0344_linkedin_commercial_sequences`. Prefixos numéricos repetidos pertencem a arquivos distintos; usar a ordem e o nome completo do journal, nunca reaplicar arquivos de chamadas só por terem o mesmo número. Nenhuma migração SQL já existente na main foi alterada.

## Aceite técnico final — 13/11/2026

- Main de referência incorporada: `634605d2d`; nenhum push, merge na main ou deploy realizado.
- Suíte global: 3138 testes aprovados; permissões, tipos e lint sem erros.
- SQL isolado: 67 cenários incluídos na suíte, sem conexões de produção.
- Verificação: 71.06 s; build: 136.74 s; Nitro: 61.49 s. Entrada gzip: 262262 bytes. Orçamentos existentes preservados.
- Ajuda: 249/249 telas cobertas, 429 artigos; conteúdo desta integração atualizado.
- Verify e build completos e imutáveis para o hash `742abddb4f8d00975595c47f0196ad61c960a05b5da2c684bc82b1a0db083eda`.
- Resultado: implementação e preparação técnica concluídas; migrações de destino, publicação e aceite pós-implantação permanecem deliberadamente não executados.
