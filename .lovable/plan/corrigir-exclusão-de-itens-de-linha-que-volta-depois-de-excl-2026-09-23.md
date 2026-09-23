# Corrigir exclusão de itens de linha que "volta" depois de excluir

## O que está acontecendo

Nesse negócio ainda existem 3 itens gravados (2x "Outsourcing de TI" e 1x "Hunting de TI").
Eles não foram excluídos: a exclusão foi **bloqueada pela regra de acesso** e a tela
removeu os itens apenas visualmente, sem aviso. Ao recarregar, eles reaparecem.

Motivo confirmado na verificação:

- Os 3 itens pertencem à Cristiane Menezes (ela os criou), e o negócio também é dela.
- Existe uma regra antiga e obrigatória nos itens de linha que só permite excluir quando
  a pessoa é a **criadora do item** ou é reconhecida como administradora — e a checagem de
  administrador dessa regra antiga está comparando a informação errada, então ela **nunca**
  reconhece ninguém como administrador. Resultado prático: só quem criou o item consegue
  excluir/ajustar, mesmo que outra pessoa tenha permissão total no negócio.
- A regra nova, baseada em workspace e permissões, autoriza a exclusão corretamente — mas a
  regra antiga é obrigatória e sobrepõe a permissão.
- A tela não avisa nada porque uma exclusão negada por regra de acesso não devolve erro,
  apenas "0 linhas afetadas", e o modal de itens de linha não confere isso.

## O que será feito

1. **Corrigir a regra de acesso dos itens de linha** (negócios e cotações), para que quem tem
   permissão de editar/excluir o negócio no workspace consiga também excluir e ajustar os itens,
   mantendo o bloqueio para quem está fora do workspace ou sem permissão.
2. **Fazer a tela avisar quando nada foi excluído**: o modal passa a conferir quantas linhas
   foram realmente removidas; se for zero, mostra "Você não tem permissão para excluir este item"
   e o item volta para a lista em vez de desaparecer silenciosamente. Mesmo tratamento para
   alterações de campo bloqueadas.
3. **Revalidar a lista após fechar o modal**, para que a tela nunca mostre um estado diferente
   do que está gravado.
4. Depois disso, excluir os itens de linha restantes desse negócio, se você confirmar que eles
   realmente devem sair.

## Também afetado (mesma causa) — incluir nesta correção

A mesma checagem quebrada aparece em regras de: base de conhecimento, benefícios, documentos,
metas, incidentes, 1:1s e avaliações de pessoas. Hoje isso faz com que gestores/administradores
não consigam ajustar ou excluir registros criados por outra pessoa, mesmo com permissão.
A correção será aplicada de forma consistente nesses casos também, sem afrouxar nada além do
que as permissões do workspace já autorizam.

## Detalhes técnicos

- Corrigir `public.is_workspace_admin_of(_owner, _user)`: hoje procura `workspaces.id = _owner`,
  mas os policies passam `owner_id` (um user id). Passará a resolver a condição de administrador
  pelo workspace do registro / vínculo real do usuário, mantendo `security definer` e
  `search_path = public`.
- Migration aditiva (`CREATE OR REPLACE FUNCTION` + recriação dos policies RESTRICTIVE
  afetados: `deal_line_items`, `quote_line_items`, `kb_articles`, `people_benefits`,
  `people_documents`, `people_goals`, `people_incidents`, `people_one_on_ones`,
  `people_reviews`). Sem `DROP TABLE`/`DROP COLUMN`, sem mudança de schema.
- Os policies RESTRICTIVE passam a exigir: registro do workspace do usuário **e**
  (criador do registro **ou** `user_has_permission(...)` de update/delete no módulo).
  Os policies PERMISSIVE `ws_*` continuam como estão.
- Front-end: `src/components/deals/use-line-items.ts` — `removeRow` e `persistUpdate` passam a
  usar `.select("id")` (padrão de `src/lib/delete-guard.ts`) e tratar `0 linhas` como falha,
  revertendo o cache otimista e exibindo mensagem em pt-BR; invalidação do cache "full" ao
  fechar o modal em `deal-line-items.tsx`.
- Testes: unitário para a checagem de linhas afetadas na exclusão/atualização e verificação SQL
  de que um administrador do workspace consegue excluir item de outro usuário.
- Validações: `bunx vitest run`, `bunx eslint`, `bunx tsgo --noEmit`.

## Riscos

- Alteração de regra de acesso: será restrita a permitir o que as permissões do workspace já
  concedem. Nenhum acesso entre workspaces é aberto.
- Se você preferir, a limpeza dos 3 itens restantes fica para você fazer pela tela depois da
  correção, em vez de eu excluir pelo banco.
