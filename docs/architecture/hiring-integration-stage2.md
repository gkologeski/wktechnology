# Contratação integrada — etapa 2

## Comportamento entregue

A vaga/requisição existente (`ats_jobs`, `/jobs/$id`) recebe a aba **Demanda e aprovações**, sem criar outro cadastro ou outro pipeline. Finalidade (cliente, interno ou gestão compartilhada), vínculo profissional e cobrança são dimensões distintas. Cliente exige negócio do mesmo workspace; interno/gestão não aceitam negócio e usam cobrança não aplicável. O negócio pode ser vinculado nas propriedades da vaga antes de salvar a demanda.

A alçada é configurada por área do workspace: gestor → CEO, com substitutos explícitos. A configuração exige administrador ativo e chave própria; não concede permissão ao aprovador. Cada solicitação registra revisão, solicitante, configuração e aprovadores; o solicitante nunca decide a própria demanda. Gestor e CEO iguais podem atender os dois papéis com uma decisão. Ausência, inatividade ou falta de permissão impede o pedido. Rejeição exige justificativa; correção dos dados inicia nova revisão. Não há substituição inferida para aprovar demanda própria.

Editar a demanda invalida decisões anteriores; alterar alçada também invalida a autorização das demandas afetadas. Uma vaga governada publicada volta a suspensa quando seu conteúdo muda. Publicar exige aprovação concluída. Vagas históricas permanecem como estavam; salvar explicitamente a demanda as inclui no novo fluxo. Ativação é por workspace, não global. A configuração de uma área ativa a governança de novas vagas no workspace; áreas sem configuração continuam bloqueadas ao solicitar aprovação.

Notificações são gravadas na transação da solicitação/decisão, apenas para a próxima etapa. O outbox de e-mail é privado, com claim transacional, rechecagem de elegibilidade, limite de cinco tentativas e chave idempotente no provedor. O e-mail contém um link, sem dados financeiros/pessoais da vaga. A rota `hiring-approvals-tick` exige `CRON_SECRET`; a migração prepara o agendamento usando o scheduler autenticado existente, inicialmente inativo, para ativação após publicação. Falhas não desfazem decisões e são indicadas na aba. Não declarar entrega de e-mail sem retorno do provedor; supressão não equivale a envio.

## Catálogo e permissões

`service_catalog.staffing_kind` permite classificação explícita: nenhum, Hunting, Outsourcing ou Squad. Squad reaproveita a modalidade Outsourcing no perfil. Classificação explícita prevalece sobre o nome; valor nulo mantém compatibilidade pelo nome do catálogo. Serviço inativo não habilita novo perfil nem nova associação em negócio/cotação. Referências históricas ficam intactas; não há exclusão de catálogo ou de itens antigos. A classificação exige edição do catálogo no workspace ativo.

Novas chaves gerenciáveis em Configurações → Permissões:

- `techhire.hiring_demands.view.workspace`
- `techhire.hiring_demands.update.workspace`
- `techhire.hiring_demands.create.workspace` (solicitar aprovação)
- `techhire.hiring_demands.approve.workspace`
- `techhire.hiring_policies.manage.workspace`

UI e funções autenticadas validam chaves; SQL revalida membership ativa, workspace ativo, deny, visibilidade da vaga, alçada e revisão. Não há concessão automática a todos os cargos/tenants. Mudanças de configuração operacional da WK e concessões locais são registradas no relatório privado, sem identificadores pessoais neste documento público.

## Validação e limites

Gate integral: 2.600 testes em 338 arquivos, tipos e lint sem erros; avisos de lint existentes não foram tratados como falha. Inclui 12 cenários da migração nova em PostgreSQL descartável, com leitura RLS no papel restrito, proteção contra alteração direta, ordem das decisões, invalidação, ausência/autoaprovação, outbox e catálogo. As claims SQL são fixtures, não login GoTrue. Os 73 testes existentes de permissionamento PostgreSQL também fazem parte do gate. Build e limites de performance aprovados; recibos de commit, CI e hash publicado ficam no relatório de entrega.

Esta etapa não implementa o gate de assinatura contratual em todas as entradas, admissão/acesso, CNPJ/vigência, alocações ou provisão/faturamento. Essas entregas continuam nas etapas 3–7. Aprovar a demanda não representa contratação, assinatura de contrato, convite ou autorização de cobrança.
