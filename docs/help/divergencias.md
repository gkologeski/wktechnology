# Divergências entre código e doutrina RBAC

Registro de comportamentos do código que divergem de `docs/architecture/security-rbac.md`.
A Ajuda documenta o comportamento pretendido; o item fica aqui até ser corrigido.

| Data | Módulo | Tela/recurso | Divergência | Situação |
|---|---|---|---|---|
| 05/11/2026 | core | Auditoria de acesso | 15 políticas `TO public` herdadas (ex.: `field_permission_rules`, `job_roles`, `permission_sets`, `email_send_log`) e 1 política de escrita para anon em `app_settings`, conforme `tests/access-audit/baseline-2026-11-05.txt` | A revisar em frente própria |

## TechSales (crm) — Fase 2 (pontos para auditoria; não comprovados como falha)

- `contacts.tsx` × `use-can-delete.tsx`: barra em massa aceita `delete.own`, ficha do contato não.
- `grid/bulk-edit.functions.ts`: autenticação + RLS, sem checagem granular explícita no servidor.
- `settings.quotes.tsx`: "Gerar proposta" sem `SalesAction` na tela.
- `sales-flow.server.ts` `proposalFromQuote`: sem checagem de criação no helper (depende do chamador/RLS).
- `tasks.queues*.tsx`, `prospecting.campaigns*.tsx`, `scripts-page.tsx` (Novo/editar), `settings.rotation.tsx`, `settings.sequences.tsx`, `settings.calendars.tsx`, `settings.booking.tsx`, `dashboards.tsx`, `reports.tsx`, `settings.portal.tsx`, `settings.kb.tsx`, `settings.macros.tsx`, `entity-list.tsx`: ações de escrita sem bloqueio granular visível na tela (servidor/RLS não auditados integralmente).
- `inbox-assignment.functions.ts`: aceita membership com status diferente de `inactive`; a doutrina exige `active`.

## TechHire (ats) — encontradas na Fase 2 (05/11/2026)

- **Sem permissão própria na tela/servidor:** Dashboard, Briefing, Copilot, DEI Analytics, Flags de risco, Match Scores, Insights, todo o Hunting, todo o Sourcing (exceto Multi-posting) e E-mails por etapa conferem só login e workspace (RLS por pertencimento). Pela doutrina de `security-rbac.md`, cada tela deveria ter recurso/ação `techhire.*` próprio. A Ajuda documenta o acesso atual e o marca como divergência.
- **Inbox de sourcing:** o botão "Pausar" envia `stopped` e encerra a inscrição, em vez de pausar.
- **Indicações:** status e bônus aparecem em inglês (`submitted`, `under_review`…), contrariando a regra de idioma PT-BR.
- **Multi-posting:** os três sites estão fixos em modo simulado (`isMock: true`), não por detecção de credenciais.
- **Sequências de outreach:** o status das inscrições aparece sem tradução; "Aguardar aceite do convite" não é validado como posterior a um convite.
- **E-mails por etapa:** a descrição usa `{{candidate_name}}`/`{{job_title}}`, e os botões inserem `{{candidate.first_name}}`/`{{job.title}}`.
- **Talent Pools:** o tipo "Smart" está marcado "em breve", mas pode ser selecionado e salvo.

## TechPeople

- **Dashboard, Meu time:** sem permissão própria; qualquer membro ativo com o módulo entra (dados limitados pelo banco).
- **Benefícios, Documentos, Incidentes, Riscos psicossociais, Faturamento, Margem, Analytics:** o menu aceita gestor pelo perfil mesmo sem a chave; a tela não tem bloqueio próprio, só as consultas do servidor.
- **Importar do Google Forms:** o menu aparece com `people.create.own` ou `people.update.workspace`, mas o servidor exige sete chaves no workspace.
- **Onboarding/Offboarding:** a descrição diz "ativos"/"em andamento", mas planos concluídos e cancelados também aparecem.
- **Dashboard:** considera aberto o plano com status `canceled` (o código compara com `cancelled`), podendo contar planos cancelados.
- **Documentos a vencer:** lista até 60 dias, mas o status "A vencer" é marcado com 30 dias; aparecem documentos "Válidos".
- **Modelos de onboarding:** nome com 1 caractere habilita "Salvar", mas o servidor recusa (mínimo 2).
- **Importar do Google Forms:** comentário fala em "ocorrência mais completa", mas vale a primeira linha do CPF; motivos de linhas rejeitadas são descartados.
- **Analytics:** turnover usa headcount atual (o tipo cita "médio"); soma de benefícios não filtra por pessoa ativa; desativações da sincronização não aparecem na lista da prévia.
- **Faturamento de horas:** alocação só com horas não aprovadas não aparece para "Aprovar pendentes"; a prévia não exclui horas já lançadas no financeiro, a geração exclui.
- **Margem por contrato:** descrição diz "margem líquida", mas é só receita menos custo de horas.
- **Recursos de catálogo sem uso:** `techpeople.analytics`, `techpeople.import` e `techpeople.my_team` existem, mas as telas usam outras chaves.

## TechContracts — auditoria documental (05/11/2026)

- O menu lateral não declara chave mínima individual; a Ajuda conserva a leitura por módulo. Botões do cabeçalho e associação de serviços não possuem todos os bloqueios locais de ação; não equivalem a autorização do servidor.
- Dashboard usa autenticação e RLS, sem middleware granular explícito no handler examinado; consulta até 2.000 contratos e soma valores sem conversão de moedas. Listas auxiliares limitadas a 8.
- Serviços em execução consulta até 200 registros; limpar filtros não limpa busca. Salvar Status = Ativo e executar Ativar são caminhos distintos.
- Salvar padrões exige defaults.manage e contracts.update.workspace; a exigência cumulativa não fica explícita na tela.
- Gerar de modelo usa funções autenticadas sem middleware granular explícito de modelos nos endpoints examinados; permanece dependente das outras barreiras de acesso.
- Documento enviado para assinatura sela o conteúdo e altera estado, sem comprovação de e-mail enviado pelo ramo SQL auditado. Provedor selecionável não comprova integração operacional.
- `/settings/clauses` usa proposal_clauses e permissões TechSales; não é evidência de editor de cláusulas de contrato.
- Importação cria rascunho antes de finalizar. Cancelar não remove esse rascunho. Falha de upload no lote pode seguir sem aviso; upload e criação não são transação única.
- Lote não limita inclusão a 50 arquivos, mas pareamento final aceita até 50 IDs; falha de vínculo de aditivo mantém rascunho criado e não garante repetição automática.
- Diagnóstico de Principal/Aditivo consulta até 2.000 registros; fila e análise de vínculos até 500. Sugestão não comprova correspondência.
- Margem do card de compras aninhadas é diferença de valores totais, sem conversão monetária, rateio por vigência ou pagamentos. Rentabilidade é estimada, não lucro realizado.
- A auditoria de acesso foi repetida nesta etapa: mesmos 39 apontamentos preexistentes; nenhuma categoria nova e nenhum apontamento nas tabelas da Ajuda. Nenhuma correção de RBAC realizada nesta frente documental.
- A geração automática da migration de conteúdo escolheu `0307_help_seed_contracts`, coexistindo com `0307_shared_audience_company_catalog`; nomes completos distintos e journal sequencial válido (`drizzle-kit check`). O journal é protegido pelo ambiente; tentativa de renumerar para prefixo livre foi recusada, sem alteração. Revalidar concorrência antes do aceite.
