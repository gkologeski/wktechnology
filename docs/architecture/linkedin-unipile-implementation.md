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
| B | Contas pessoais: chaves, owner+tenant, evitar adoção global, UI sem falso sucesso, RLS restritiva, Ajuda | Implementado localmente: 17 testes unitários, tipos e 5 cenários SQL aprovados; testes globais aprovados; lint global bloqueado por formatação preexistente | 1–3 h incluindo SQL/aceite |
| C | Hosted Auth v2 com account_id exato, state de uso único com expiração, reconexão e confirmação segura; webhook v2 e idempotência | Pendente | 4–6 h |
| D | Reserva atômica por conta/ação, dia+semana, teto configurável, pausa, Retry-After e status | Pendente | 4–6 h |
| E | LinkedIn no registry e Inbox; contas pessoais e permissões; associação CRM | Pendente | 6–10 h |
| F | LinkedIn nas sequências e agentes; conta explícita, interromper resposta/recusa | Pendente | 6–10 h |
| G | Testes isolados, negativos, ponta a ponta autorizado e publicação | Pendente | 3–5 h + dependências externas |

Previsão técnica revisada LinkedIn: 24–40 h após auditoria, mais liberação de credenciais e teste humano. A estimativa anterior 16–28 h não abrangia a correção das fronteiras legadas e da assinatura v2. Facebook/Instagram são uma frente posterior; não somar nem duplicar o esforço compartilhado sem novo levantamento.

## Proteções obrigatórias

- Menor limite conhecido; recomendações da Unipile não são limites oficiais garantidos do LinkedIn. As páginas v1 e v2 consultadas divergem em mensagens/dia; não fixar um número como direito contratual. Aplicar perfil conservador configurável e retornar motivo de bloqueio.
- Tentativas reservadas atomicamente antes da chamada externa; todos os caminhos usam a mesma reserva. Não usar sleeps longos em request HTTP: agendar a próxima execução.
- Nenhum retry cego em envio de resultado incerto; reconciliar antes. Restrição/challenge/desconexão pausam a conta, sem trocar remetente para contornar.
- Credenciais apenas no servidor; autenticação hospedada, sem senha/cookies no TechERP. Confirmar variáveis e versão da API sem revelar valores.
- Conta pessoal é privada por padrão. Compartilhamento explícito será uma capacidade posterior, sem grants automáticos a cargos existentes.
- Resposta pausa cadência; recusa adiciona supressão. Resposta não deve ser rotulada como recusa.

## Aceite e status de implantação

Pacote B e compatibilidade da assinatura v2 preparados localmente; ainda não publicados nem aplicados ao banco. A confirmação de nova conta permanece bloqueada de forma segura até o pacote C, sem adoção da listagem global. Não houve envio LinkedIn, alteração de conta, concessão de cargo nem mudança em canais existentes nesta auditoria. Migração aditiva deve ser testada com permitido/sem chave/deny/outro workspace/inativo antes de aplicar. Teste real depende de conta de teste autorizada e Unipile operante; pergunta enviada ao usuário sem solicitar segredos.

Fontes consultadas em 12/11/2026:
- https://developer.unipile.com/v2.0/docs/authenticate-with-hosted-auth
- https://developer.unipile.com/v2.0/docs/configure-a-webhook
- https://developer.unipile.com/v2.0/docs/provider-limits-and-restrictions
- https://developer.unipile.com/docs/provider-limits-and-restrictions
- https://www.linkedin.com/help/linkedin/answer/a551527?lang=en

## Verificação do primeiro pacote

- Permissões: contrato novo aprovado, sem alterar baseline ou concessões.
- Testes direcionados: 17/17; tipos sem erros; lint dos arquivos alterados sem erros (avisos legados permanecem).
- SQL: 5/5 cenários na migração real em PostgreSQL 17 descartável, com contexto de identidade sintético; não é autenticação real GoTrue. Script reproduzível: `python3 tests/unipile/personal-account-rls.py`.
- Ajuda: 247/247 telas cobertas, 427 artigos; artigo LinkedIn atualizado para versão 3. Aplicação editorial ao banco ainda pendente.
- Build completo aprovado. Gate de performance não aprovado por tempo de build e por exigir verificação global completa; não há liberação de deploy.
- Gate global: 53 erros de formatação em 15 arquivos não alterados; nenhum erro de lint nos arquivos deste pacote. A execução inicial de testes teve falhas por Docker bloqueado e Node 20/ESM. Nova execução com Node 22/Docker aprovada: 3.031/3.031 testes. Não há aceite global nem liberação de publicação.
- Usuário confirmou ambiente Unipile e conta de teste existentes; nenhuma senha/chave solicitada.
- Próxima fronteira segura: Scope Unipile por workspace/usuário, sem migrar automaticamente contas existentes (a atribuição é permanente); Hosted Auth deve usar o Scope e validar `account_id` exato, estado, expiração e vínculo antes da confirmação. Documentação: https://developer.unipile.com/v2.0/docs/scopes.
