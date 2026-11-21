# NOTIFICA-CENTRAL — pacote 2: destinatários e fronteira de acesso

## Escopo e implantação

O pacote acrescenta regras de destinatário ao passo `send_notification` do motor de Workflows existente. Não cria outro motor, não ativa os eventos `planned` do catálogo e não introduz envios externos. O schema e a migração são preparados e testados localmente; sua presença no repositório não significa aplicação em produção. Não publicar o código dependente do gateway antes de aplicar a migração na entrega autorizada.

O contrato compartilhado está em `src/lib/notification-recipients.ts`. O adaptador de execução fica em `src/lib/notification-dispatch.server.ts`; ele chama o gateway SQL `notification_workflow_dispatch`. Tipos e validação das ações ficam em `src/lib/workflows/types.ts` e `schemas.ts`.

## Seleção é intenção, não autorização

`NotificationRecipientRule` aceita de uma a dez regras:

| Regra                | Intenção                                                                 |
| -------------------- | ------------------------------------------------------------------------ |
| `workflow_owner`     | Executor autorizado da versão publicada do workflow                      |
| `user` + `id`        | Membro indicado explicitamente                                           |
| `source_responsible` | Responsável canônico atual da origem                                     |
| `source_creator`     | Criador canônico da origem                                               |
| `area_manager`       | Gestor com vínculo comprovado no contexto da origem                      |
| `pending_approvers`  | Aprovadores nomeados da etapa pendente atual                             |
| `project_members`    | Participantes atuais do projeto associado à origem                       |
| `team` + `id`        | Membros de uma equipe explícita do workspace                             |
| `job_role` + `id`    | Usuários vinculados a um cargo explícito no workspace                    |
| `followers`          | Reservado; não há fonte persistida de seguidores comprovada neste pacote |

O schema exige UUID em seleções nomeadas e rejeita campos desconhecidos. Deduplicar candidatos não concede acesso. A ausência de responsável, alçada, equipe ou fonte de seguidores não amplia o público para criador, administrador ou CEO.

## Compatibilidade com fluxos salvos

`recipients` é opcional. Quando ausente, `effectiveNotificationRecipients` mantém o membro de `user_id`, se configurado, ou o executor do workflow. O campo legado permanece no tipo e no schema; uma seleção vazia legada equivale à ausência de seleção. Quando existem regras explícitas, elas prevalecem sobre `user_id`.

O formulário não dispara `onChange` somente por abrir um fluxo antigo. Destinos avançados ou não disponíveis para a entidade são preservados, sem reescrever IDs nem pedir UUID manual. Editar título ou corpo também não remove essas regras.

A nova execução passa pela fronteira protegida mesmo quando a versão salva usa somente a seleção legada. Essa proteção não altera o JSON publicado, a responsabilidade do registro ou uma etapa de aprovação.

## Gateway atômico e conteúdo mínimo

O gateway SQL é exclusivo de serviço. Ele vincula workflow, execução, versão, entidade, registro e posição a dados reais, em vez de confiar no snapshot enviado pelo executor. Resolve candidatos com dados atuais, exige membership ativo no workspace da origem e usa a leitura RLS do sujeito para confirmar que cada candidato pode consultar o registro nos módulos atendidos.

Selecionar um cargo, uma equipe ou um aprovador não substitui a leitura da origem, nem neutraliza uma negação efetiva. A mesma ocorrência, posição e destinatário não deve criar um segundo aviso em uma repetição. O retorno resume contagens e motivos técnicos; não é uma API pública para inspecionar permissões de terceiros.

Algumas políticas de ATS e Financeiro dependem também do workspace ativo do perfil. Se a leitura não puder ser confirmada nesse contexto, o candidato é negado de forma conservadora. O resolvedor não altera o perfil, o workspace ativo ou os cargos da pessoa para fazê-la passar.

Leitura da linha não comprova permissão para todos os campos privados. Por isso o adaptador não executa `renderTokens` com `ctx.after` ou `ctx.vars` para compor a notificação. Título e corpo com variáveis são convertidos pelo gateway em aviso neutro para consultar no TechERP. Títulos e corpos estáticos são mantidos; o operador deve evitar conteúdo sensível escrito diretamente nesses campos.

Resolução, autorização, deduplicação, preferência e gravação permanecem no caminho protegido. Não retornar destinatários para uma gravação posterior desprotegida em TypeScript.

### Destino de navegação

Um link deve corresponder a rota interna existente. Não inventar `/applications/$id`, `/interviews/$id` ou `/quotes/$id`: essas fichas próprias não foram localizadas no roteador atual. As candidaturas e entrevistas são tratadas por diálogos de uma vaga; cotações são tratadas na ficha do negócio ou na lista existente.

Rotas comprovadas incluem `/tasks/$id` para atividades e `/projects/tasks?taskId=<id>` para a tarefa de projeto. Marcos podem direcionar à ficha do projeto associado, sem prometer abertura automática da aba Marcos. Vagas usam `/jobs/$id`; `/ats/jobs/$id` é um redirecionamento legado válido.

Quando não existe detalhe ou parâmetro de abertura comprovado, o destino pode ser uma lista existente, como `/finance/banking`, `/settings/quotes`, `/settings/recurring` ou `/invoices?view=table`, sem inventar um parâmetro de registro. `recurring_plans` e `subscription_invoices` pertencem à tela `/settings/recurring`; não confundir com `/finance/recurrences`, que atende outra entidade. Um link para pai associado exige vínculo de workspace e autorização adequados; não deduzir a origem pelo título do aviso. Sem destino comprovado, manter `link` nulo é preferível a enviar uma rota falsa. O aviso neutro e a Ajuda não devem prometer acesso direto ao detalhe nesses casos.

## Fontes canônicas e ambiguidades

- **Negócios:** líder das equipes do responsável, por `user_groups` e `user_group_members.is_leader`, somente quando há um único líder elegível. A função canônica de perfis de vaga distingue ausência de dono/equipe/líder e ambiguidade. Nunca escolher o primeiro de vários líderes.
- **Pessoas:** `people.manager_id` aponta para `people.id`, não para usuário. O gestor precisa pertencer ao mesmo workspace, não estar arquivado e ter `profile_id` vinculado a membro ativo, além da leitura da origem.
- **Vagas:** área e `hiring_area_policies`. Quando existe solicitação da revisão atual, o gestor vem da etapa registrada nessa solicitação, com a mesma revisão da política. O criador da vaga não é presumido como solicitante. Uma solicitação atual encerrada ou desatualizada não permite voltar ao principal. Antes de haver solicitação nessa revisão, o principal configurado pode receber um aviso informativo, sem substituição automática. Falta, inatividade ou permissão negada não dispara promoção ao CEO.
- **Contratos:** aprovador nomeado da etapa atual, respeitando pendência e revisão/generação vigente, com leitura e permissão atual de aprovar a etapa. Para aprovações de Workflow, o predicado canônico exige leitura e gerenciamento da aprovação. Perder a permissão de decisão exclui a seleção como aprovador; uma seleção explícita como audiência continua dependendo apenas do acesso à origem. Cargo com nome semelhante não cria uma nomeação nem autoriza decidir.
- **Projetos:** `project_members` do projeto da origem. Aprovação de horas possui regras próprias em `project_time_approvers`, incluindo validade, revogação, profissional e delegação; participar do projeto não concede aprovação de horas.
- **Equipes e cargos:** vínculos explícitos e limitados ao workspace. Cargos globais de sistema não tornam a seleção global; a associação do usuário e suas permissões continuam contextualizadas no workspace.
- **Seguidores:** `workflow_subscriptions` é assinatura administrativa de eventos, não uma lista de seguidores do registro. Sem fonte comprovada, não há fan-out por esse alvo.

`hiring_formalization_recipient` retorna e-mail da contraparte externa e não serve como resolvedor de aprovadores internos. Os helpers de alçada e elegibilidade existentes continuam privados; nenhum helper de personificação genérica é exposto a usuários autenticados.

## Formulário do passo

`NotificationForm` usa os componentes compartilhados que herdam o White Label. Oferece executor, membro específico, responsável e criador. Ofertas contextuais:

- Pessoas: **Gestor da pessoa**.
- Negócios: **Líder da equipe do negócio**.
- Vagas: **Gestor da área de recrutamento**.
- Contratos: **Aprovadores da etapa atual**.
- Projetos, tarefas e marcos: **Membros do projeto**.

Equipes, cargos e seguidores ainda não recebem seletores novos neste formulário; ficam para a configuração completa de regras. Valores já salvos continuam visíveis como preservados. Membro específico usa o seletor existente por nome, e o formulário impede o fallback para digitação de UUID quando a lista está vazia, carregando ou indisponível.

## Preferências e efeitos

O gateway consulta `inapp` do grupo `workflow` antes de criar o aviso. `preferences_disabled` representa supressão, sem apagar histórico ou concluir tarefa. A repetição já registrada também é resultado válido. Sem destinatário elegível e sem uma supressão reconhecida, o adaptador devolve erro visível no resultado do passo, em vez de alegar envio.

Esta mudança não unifica todos os produtores legados de notificação ou e-mail. Não introduz preferências por workspace, WhatsApp, opt-in, modelos Meta, horário de silêncio, resumos ou escalonamento. A leitura e a marcação do histórico pessoal continuam com o contrato atual do pacote 1; não se presume proveniência de workspace em registros antigos.

## Validação e limites

A entrega deve validar a fronteira real com os cinco cenários distintos: permitido, ausência de chave, negação explícita, outro workspace e membro inativo, além de origem inexistente, versão/execução inválida, regras ambíguas, vínculos e substitutos, deduplicação e supressão por preferência. Os testes de UI exercitam seleção contextual, compatibilidade legada, preservação de regras, limite de dez e ausência de entrada manual de UUID, sem rede.

Os testes da fronteira executam o gateway e predicados canônicos em PostgreSQL descartável, incluindo chamadas HTTP no PostgREST 14.1 fixado por digest e JWT HS256 assinados com segredo efêmero local. Esse ensaio verifica a API e a autenticação criptográfica da RPC; não representa login pelo GoTrue nem execução contra produção. Não reaproveitar o teste antigo de filtro pessoal como prova de que o destinatário possui membership, permissões ou leitura RLS real. Após autorização de implantação, aplicar a migração, publicar a revisão validada e realizar o aceite com sessões reais do ambiente; esses atos não são consequência automática deste pacote local.

A Ajuda correspondente é atualizada nas fontes e no catálogo editorial. Aplicar o conteúdo no app continua sendo uma operação editorial autenticada da entrega autorizada.
