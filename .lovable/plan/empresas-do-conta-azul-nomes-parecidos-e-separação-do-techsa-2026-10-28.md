# Empresas do Conta Azul: nomes parecidos e separação do TechSales

Porte M. Estimativa: 3–4 h de trabalho, mais a sua revisão das sugestões. Não inclui a carga dos lançamentos, que segue no plano anterior.

## O que muda para você
1. **Nomes parecidos viram sugestão, nunca vínculo automático.** Para cada cliente ou fornecedor do Conta Azul sem CNPJ igual nem nome idêntico, o sistema procura empresas do TechERP com nome parecido (ignorando acentos, "Ltda", "ME", "S/A", abreviações e ordem das palavras) e dá uma nota de semelhança.
   - Nota alta com um único candidato: aparece como "Sugerido", e você confirma com um clique.
   - Vários candidatos ou nota média: aparece em "Revisar", com as opções lado a lado (nome, CNPJ, cidade, se já tem negócios).
   - Sem candidato: "Nova empresa".
   - Nada é vinculado sem a sua confirmação. Você pode confirmar em massa os "Sugeridos".
2. **Empresas só financeiras ficam fora do TechSales.** As empresas novas vindas do Conta Azul entram no cadastro único, marcadas como **"Financeiro"** (cliente ou fornecedor financeiro).
   - Aparecem no TechFinance: lançamentos, vendas e cadastro de clientes/fornecedores.
   - **Não aparecem** nas listas, buscas, filtros, painéis e Kanban do TechSales, nem na prospecção, campanhas, Lia e enriquecimento.
   - Se um dia virar oportunidade comercial, uma ação "Levar para o TechSales" muda a marcação, sem duplicar a empresa.
   - Empresas que já existem no TechSales e forem vinculadas continuam como estão; só ganham o vínculo com o Conta Azul.
3. **Tela de revisão** em Configurações › Integrações › Conta Azul › "Clientes e fornecedores", com abas Sugeridos, Revisar, Novas e Vinculadas, filtros e confirmação em massa.

## Decisão já assumida (pode mudar)
- Pessoas físicas do Conta Azul seguem a mesma regra, como Contatos marcados "Financeiro".

## Garantias
- Só workspace WK; nada muda no Conta Azul; nenhuma empresa existente é renomeada, mesclada ou apagada.
- A sincronização automática continua pausada até a carga aprovada.
- Permissões: revisar e confirmar exige gestão de integrações; ver empresas financeiras exige acesso ao Financeiro. Deny e membro ativo respeitados no servidor e no banco.
- Sem publicar.

## Detalhes técnicos
- Migration aditiva: `companies.audience text not null default 'sales'` com check (`sales`, `finance`), índice `(workspace_id, audience)`; igual em `contacts`. Todas as 32.111 empresas atuais ficam `sales` (nenhuma mudança visível).
- Tabela `contaazul_person_links` (workspace, id Conta Azul, perfil, empresa/contato local, situação `suggested|review|new|linked|confirmed|ignored`, nota, candidatos, quem confirmou/quando) com GRANT, RLS por workspace e `user_can_act`.
- Semelhança: função pura em `contaazul-reconcile.ts` (tokens normalizados, remoção de sufixos, Jaro-Winkler + sobreposição de tokens; pré-filtro por pg_trgm no banco), com testes de fixtures (acentos, abreviações, ordem, homônimos → revisão).
- TechSales: filtro `audience = 'sales'` nas consultas de empresas/contatos de lista, busca, kanban, facetas, prospecção, campanhas, SDR e enriquecimento (mapear todos os pontos antes de editar). Fichas abertas por link direto continuam acessíveis a quem tem permissão.
- Permissão nova `finance.contaazul_people` (view/manage) no catálogo e em `/settings/permissions`, contratos em `permission-contracts.json` com cenários permitido/sem chave/deny/outro workspace/inativo.
- Gates: permissions:check, testes, lint, typecheck, build; Playwright na tela de revisão e conferência de que empresa "Financeiro" não aparece em Empresas do TechSales.
