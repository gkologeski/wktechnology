# Confirmar as 5 pessoas dos grupos do Clockify

## Situação conferida no banco
- Os grupos "GP -> Admin" e "WK - Interno" estão vazios no TechProjects.
- As 5 pessoas deles já casaram por e-mail igual com membros do workspace WK, mas a confirmação ainda está pendente:
  - Financeiro WK Technology (financeiro@wkconsultoria.com.br)
  - Hugo Bulegon (hugo.bulegon@wktechnology.com.br)
  - Guilherme Machado Kologeski (guilherme@wktechnology.com.br)
  - Aline Wolf (aline@wktechnology.com.br)
  - Nicolas Fernandes Kologeski (nicolas.kologeski@wktechnology.com.br), do grupo WK - Interno
- A montagem dos grupos só usa pessoas confirmadas. Por isso essas 5 ficaram de fora.

## O que farei
1. Abrir a aba Pessoas do importador do Clockify pelo navegador (Playwright) e confirmar essas 5 associações pelo próprio botão da tela, mantendo o registro de quem decidiu.
2. Rodar de novo a etapa de catálogos, que pode ser repetida sem duplicar nada, para incluir as 5 pessoas nos grupos.
3. Conferir no banco: o "GP -> Admin" fica com 4 membros e o "WK - Interno" com 1; os outros grupos não mudam.

## O que não muda
- Nenhum login, convite, papel ou permissão é criado ou alterado. Os grupos são apenas informativos.
- Nada muda no Clockify, nenhum aviso é enviado e nada é publicado.
- Só o workspace WK é afetado. Nenhum código, schema ou regra de acesso é alterado.

## Detalhes técnicos
- `clockify_mappings` (entity_type `user`): as 5 linhas passam de `decision='auto'` para `confirmed`, com o mesmo `target_id`.
- Depois, `clockify_import_catalogs` faz a inserção idempotente em `project_people_group_members`.
- Se a tela não permitir confirmar casamentos `auto` um a um, a alternativa é uma atualização de dados restrita a esses 5 `external_id` no workspace WK. Isso será informado no relatório.
