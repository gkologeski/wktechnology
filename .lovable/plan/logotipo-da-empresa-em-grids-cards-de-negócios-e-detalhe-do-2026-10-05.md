# Logotipo da empresa em grids, cards de Negócios e detalhe do Negócio

## Causa confirmada (cards de Negócios)
O quadro busca a lista de nomes de empresas sem filtro; o banco devolve só as primeiras 1.000 em ordem alfabética, de um total de 32.034. Dos 1.575 negócios com empresa, a maioria não encontra o nome, e o card esconde a linha "Empresa" inteira (nome e logotipo). Os campos dos cards estão ligados: os 3 funis com campos configurados incluem "Empresa", e os 7 sem configuração usam o padrão, que também inclui.

## O que será feito
1. **Cards, lista e tabela de Negócios**: o nome e o logotipo da empresa passam a vir da mesma busca em lote, feita pelos negócios exibidos (já usada para os logotipos). Assim toda empresa vinculada aparece, sem o limite de 1.000.
2. **Detalhe do Negócio**:
   - no cabeçalho, trocar "Empresa associada" pelo logotipo e nome da empresa (com link para a ficha);
   - no quadro "Empresa" das associações, trocar a inicial genérica pelo logotipo (manual → site/domínio → iniciais), na mesma cascata já usada. O mesmo quadro aparece em Contatos, Leads e Tickets, que também passam a mostrar o logotipo.
3. **Grids com coluna Empresa**: mostrar o logotipo pequeno ao lado do nome em Contatos, Leads, Tickets, Faturas, Propostas e Projetos, carregando os logotipos da página atual em lote.
   - Quando a linha só tem o nome digitado da empresa, sem vínculo a uma empresa cadastrada (comum em Leads), aparecem as iniciais.

## Fora do escopo
Sem mudança em banco, permissões ou regras. Nenhuma coluna nova, e nenhuma funcionalidade removida.

## Detalhes técnicos
- `useCompanyLogos` já retorna `name`. Em `deals.tsx`, montar `lookups.companies` a partir dele, mesclado com a lista atual. Remover a dependência da consulta `["companies","select"]` sem limite, que também colide com a de Contatos (`limit 200`, mesma chave).
- `deals.$id.tsx`: `useCompanyLogos([deal.company_id])` + `CompanyAvatarFromInfo` + `Link` para `/companies/$id`.
- `company-cards.tsx`: incluir `logo_url, logo_source, website` no select e trocar `EntityAvatar` por `CompanyAvatar`.
- Grids: `useCompanyLogos(rows.map(r => r.company_id))` por tela e render da célula com `CompanyAvatarFromInfo size="xs"`. Antes de cada tela, verificar se ela tem `company_id`; se não tiver, usar só as iniciais.
- Validação: Playwright no quadro, na lista e na tabela de Negócios, no detalhe do Negócio e em cada grid (claro e escuro, mais celular em um deles); typecheck, eslint dos arquivos, testes e build.
