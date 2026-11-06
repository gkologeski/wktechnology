# Auditoria complementar — ficha TechPeople

## Escopo e entrega
Auditoria estática, somente leitura, da rota `/people/$id`. Gerados 9 artigos adicionais em `/tmp/help-people-extra-articles.json`, array de objetos com `metadata` e `body_markdown`. Nenhum conteúdo do projeto foi modificado. Não foram consultados registros de pessoas nem incluídos dados pessoais. Não houve execução de fluxos em ambiente autenticado ou teste de integração com banco.

O arquivo `docs/help/people/usar-ficha-pessoa.md` permanece intacto. Seus nomes de abas não substituem os procedimentos específicos agora propostos.

## Formato
As chaves de metadata são as já existentes no front matter dos artigos do projeto: module_key, slug, title, summary, article_type, route_pattern, min_permission, audience, sort_order, version, is_published. Os campos externos metadata/body_markdown atendem ao formato solicitado; não são novas colunas propostas para o banco. O seed atual usa `body_md` (scripts/help-seed-sql.ts), portanto importar este JSON exige conversão pelo agente responsável, não inserção direta do envelope como tabela.

Seções verificadas conforme `HOWTO_SECTIONS` em `tests/help-coverage/help-coverage.ts`: Para que serve, Quem pode fazer, Onde fica, Antes de começar, Passo a passo, Resultado esperado, Regras e limites, Erros comuns, Relacionados. Todos os artigos são howto, people, internal, version 1, publicados e route_pattern literal `/people/$id`. sort_order 120–128 é ordenação editorial proposta, não comportamento extraído do produto.

## Política de min_permission
O campo singular representa a permissão real mínima de descoberta/leitura do recurso tratado; não é uma promessa de suficiência para executar todas as ações. A ficha também exige acesso à pessoa, e a aba exige seu próprio recurso. Não foram criadas chaves de approve/export ou escopos fictícios. O corpo explicita as validações cumulativas e por registro.

Evidências transversais:
- `src/lib/menu-config-people.ts:33–35`: menu Pessoas reconhece people.view.workspace/team/own.
- `src/routes/_authenticated/people.$id.tsx:109–110`: HrScreenAccess de people e HrRecordAccess da pessoa.
- Mesma rota, linhas 325–356 e 650–695: visibilidade de abas por recurso e montagem dos painéis; contratação integrada fica dentro de Alocações.
- `src/lib/access-control/use-person-resource-access.ts`: criação por capacidade `person_<recurso>`, edição/exclusão pela capacidade do registro filho. Não confundir canUpdate da pessoa com autorização dos filhos.

## Matriz artigo / evidências
| Slug | min_permission | Código auditado e comprovação |
|---|---|---|
| gerenciar-alocacoes-na-ficha | techpeople.allocations.view.own | components/people/allocations-panel.tsx: lista, criação, edição, exclusão bloqueada para vínculo; formulário em 499–733; allocation-capacity-fields.tsx: horas e capacidade; allocation-fields.tsx: seletores e rateio; lib/people/allocations.functions.ts:82–115 schema, 219+ acesso, 338 assertHrChildMutation; allocation-rules.ts contratos e soma do rateio |
| lancar-horas-na-ficha | techpeople.timesheet.view.own | components/people/time-entry-dialog.tsx: projeto obrigatório, horas >0, tarefa, data, billable e tarifa; lib/people/timesheet.functions.ts: upsertSchema e upsertTimeEntry |
| aprovar-horas-na-ficha | techpeople.timesheet.view.own | components/people/timesheet-panel.tsx: seleção persistente, barra 517+; lib/people/timesheet.functions.ts:421+ limites e RPCs; lib/projects/time-approval.server.ts: pendingItemsFor exige submissão pendente |
| exportar-timesheet-na-ficha | techpeople.timesheet.view.own | components/people/timesheet-panel.tsx: toCsv 123+, filtered 230+, handleExportCsv 302+, botão CSV 540+; consulta de totais lib/people/timesheet.functions.ts |
| gerenciar-metas-na-ficha | techpeople.goals.view.own | components/people/goals-panel.tsx: capacidades e formulário 255–342; lib/people/performance.functions.ts:150–163 schema, 185 assertHrChildMutation, 231 autorização delete |
| registrar-um-a-um-na-ficha | techpeople.one_on_ones.view.own | components/people/one-on-ones-panel.tsx:212 acesso privado, 272–394 formulário; lib/people/performance.functions.ts:244–262 schema, 297 autorização de mutação e proteção de private_notes |
| registrar-avaliacao-tomador-na-ficha | techpeople.reviews.view.own | components/people/reviews-panel.tsx: DIMENSIONS, botão Nova avaliação 141, formulário 323–433; lib/people/performance.functions.ts:363–377 schema, 399+ autorização, média e submitted_at |
| gerenciar-documentos-na-ficha | techpeople.documents.view.own | rota people.$id.tsx: DocumentsPanel; components/people/document-dialog.tsx: upload e formulário; document-viewer-dialog.tsx: visualização; lib/people/documents.functions.ts:65 autorização, 69–74 status por validade, 182/192 autorização upload, 220 acesso download e URL assinada de 300 segundos |
| gerenciar-acessos-vinculo-na-ficha | techpeople.employment.view.workspace | components/hiring/employment-panel.tsx:63/84 leitura, 85 manage, 167+ ativo, 182/187 system.roles.manage.workspace, 205 lifecycle_enabled; lib/hiring/employment.functions.ts:56–78 leitura, 163+ encerramento, 180+ convite, 238+ revisão e motivos |

Caminhos abreviados na tabela estão sob `src/`.

## Achados importantes e limites de comprovação
1. **Horas:** o guia nominal diz 0 a 24; o schema realmente aceita isso, mas o diálogo exige >0. O novo howto distingue os dois níveis e orienta >0 a 24 na tela.
2. **Aprovação:** botões não têm gate de capacidade neste painel. A ação real usa submissões pendentes e RPC de decisão, com aprovador explícito e sem autoaprovação conforme o handler; não documentar um simples `timesheet.approve` como autorização suficiente. Auditoria das regras SQL efetivamente instaladas no ambiente não foi realizada.
3. **Reabertura:** máximo 200, versus 500 para aprovação. O motivo padrão é enviado sem diálogo de motivo. Não inventar um campo na ficha.
4. **Seleção:** mudança de filtros não limpa seleção. O guia orienta limpar e selecionar novamente; exportação ignora seleção e usa filtered.
5. **CSV:** BOM UTF-8, ponto e vírgula. Ausência de tarifa/custo vira zero no CSV, mesmo quando cartões retornam null. Trata-se de ressalva real de interpretação, não garantia de custo zero. Totais do período não são recalculados pelos filtros locais.
6. **Privacidade:** taxas/margens usam acesso privado; notas privadas de 1:1 usam one_on_ones_private. Nenhuma edição de perfil substitui essas autorizações.
7. **Avaliações:** botão é “Nova avaliação”; o diálogo se chama “Nova avaliação do tomador”. Enviada é status salvo; não há evidência de e-mail disparado por esse fluxo.
8. **Documentos:** limite 20 MB é verificado no cliente. Extensões são as do seletor; não se promete validação de MIME no servidor. O status por validade é calculado no upsert; sem comprovação de job diário ou notificação externa. Arquivo usa URL assinada, não acesso público permanente.
9. **Acessos:** view/manage são `.workspace` completos. Convite e revisão exigem adicionalmente `system.roles.manage.workspace` na interface. Encerramento só aparece para vínculo ativo quando lifecycle_enabled não está habilitado. Não recomendar exclusão de alocação governada para revogar vínculo.
10. **Escopo adicional:** não foram gerados novos guias para onboarding, incidentes, benefícios ou psicossocial, fora do pedido. Nem novos endpoints, nomes de tabelas de ajuda ou chaves de permissão foram propostos.

## Validação e alterações
Validação local independente do JSON: estrutura, metadados conhecidos, seções obrigatórias, slugs sem colisão com docs/help/people, rota uniforme, links relacionados existentes e permissões presentes no código. Sem build/typecheck, seed, migração ou escrita no repositório. `git status --short` permaneceu vazio na inspeção.

Nenhuma alteração de código é necessária para entregar estes arquivos. Integração posterior: criar os artigos com seus respectivos metadata/body_markdown, preservando o guia nominal e convertendo ao formato do mecanismo de publicação existente. As ressalvas acima não foram “corrigidas” no projeto.
