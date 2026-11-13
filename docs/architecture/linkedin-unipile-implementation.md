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
| D | Reserva atômica, cotas dia/semana/mês, pausa/Retry-After, recibos e adiamento sem pular etapas | Implementado localmente; testes SQL e regressão executados | Aceite externo no G |
| E | LinkedIn no registry e Inbox; conta pessoal, permissão e associação CRM | Pendente | 6–10 h |
| F | LinkedIn nas sequências e agentes; conta explícita, interrupção por resposta/recusa | Pendente | 6–10 h |
| G | Aceite integrado, teste real autorizado e preparação/publicação | Validação local parcial; publicação fora do escopo deste turno | 3–5 h + dependências externas |

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
