---
module_key: finance
slug: operar-banco-inter
title: Consultar conexão e extrato do Banco Inter
summary: Consultar conexão e extrato do Banco Inter no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/banking
min_permission: techfinance.banking.view.workspace
audience: internal
sort_order: 190
version: 2
is_published: true
---
# Consultar conexão e extrato do Banco Inter

**Para que serve:** Consultar conexão e extrato do Banco Inter, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.banking`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar conexão e extrato do Banco Inter (`/finance/banking`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Banco Inter e confira status da conexão e disponibilidade do modo mock.
2. Somente com habilitação e autorização, inicie e conclua o fluxo oferecido.
3. Use Sincronizar quando permitido e confira a contagem retornada.
4. Consulte as abas Extrato e Histórico e siga para Conciliação quando necessário.
5. Desconecte apenas com autorização específica.

## Resultado esperado
Conexão e movimentações consultadas segundo o modo efetivamente habilitado.

## Regras e limites
- O resolvedor atual só implementa Inter simulado e exige simulação habilitada; os modos sandbox e produção são rejeitados. Conectar e desconectar exigem `techfinance.banking.manage.workspace` além de `techfinance.banking.view.workspace`. Simulação não é operação bancária real.
- Não documentar habilitação de produção como concluída.
- Sincronizar exige `techfinance.banking_sync.manage.workspace`; demais ações usam os recursos específicos indicados no código.
- Credenciais e tokens nunca devem ser copiados para chamados ou artigos.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Consultar conexão e extrato do Banco Inter](/help-media/finance/operar-banco-inter.webp)
<!-- evidência: src/routes/_authenticated/finance.banking.tsx; src/lib/banking.functions.ts -->
