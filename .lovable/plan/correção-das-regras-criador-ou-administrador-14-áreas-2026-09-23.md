# Correção das regras "criador ou administrador" (14 áreas)

As duas primeiras partes do pedido já foram feitas nos turnos anteriores. Na tela de contatos, as empresas aparecem com link e os contatos sem empresa continuam visíveis. Nos presets, os preços do HubSpot foram aplicados e os presets que faltavam foram criados, com validação em um negócio e em uma cotação. Este plano cobre só a parte que ainda falta.

## Objetivo
Qualquer administrador do workspace, ou quem tem a permissão do módulo, deve conseguir ver, editar e excluir nessas áreas. Deixa de valer a exigência de ser o criador do registro. O bloqueio entre workspaces diferentes continua.

## Regras obrigatórias encontradas hoje (30 regras em 16 tabelas)
- **TechContracts e cotações (fase 1):** contratos (ver e editar) e itens de cotação (incluir, editar e excluir).
- **TechSales:** itens de linha do negócio (incluir e excluir).
- **TechService:** base de conhecimento (editar e excluir), macros (ver) e políticas de SLA (ver).
- **TechPeople:** alocações, benefícios, documentos, metas, incidentes, 1:1s e avaliações.
- **TechProjects:** projetos (ver e editar).

## Fases (uma migração por fase, com teste por papel antes e depois)
1. Contratos e itens de cotação.
2. Itens de linha do negócio.
3. TechService.
4. TechPeople. Os dados sensíveis continuam protegidos pelas checagens de "ver dados sensíveis" que já existem.
5. TechProjects.

## Como cada regra será trocada
- A regra obrigatória atual é substituída por outra com o mesmo nome e a mesma ação. A nova regra exige que o registro seja do workspace da pessoa. Além disso, a pessoa precisa ser administradora do workspace ou ter a permissão do módulo para aquela ação.
- As regras que já liberam o acesso não mudam.
- A tela: as exclusões e edições desses módulos já avisam quando nada foi gravado. Vou conferir cada um e completar onde faltar.

## Validação
- Consultas simulando três pessoas: um administrador que não criou o registro, um membro sem permissão e alguém de outro workspace. Cada uma tenta ver, editar e excluir.
- Teste no navegador: editar e excluir um contrato e um item de cotação criados por outra pessoa.
- Rodar o relatório de auditoria de acesso de novo. A meta é chegar a 0 áreas com a regra de criador.
- Testes, lint e checagem de tipos.

## Detalhes técnicos
- `DROP POLICY` + `CREATE POLICY ... AS RESTRICTIVE` usando `workspace_id IN (select current_user_workspaces())` AND (`is_workspace_admin_v2(workspace_id, auth.uid())` OR `user_can_act('<recurso>','<ação>', ...)`).
- Tabelas filhas (`quote_line_items`, `deal_line_items`) resolvem o workspace pelo pai (`quotes`/`deals`) via EXISTS.
- A estrutura do banco e as permissões concedidas não mudam.
