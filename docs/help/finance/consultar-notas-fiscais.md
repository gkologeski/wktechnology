---
module_key: finance
slug: consultar-notas-fiscais
title: Consultar NFS-e e arquivos disponíveis
summary: Consultar NFS-e e arquivos disponíveis no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/nfse
min_permission: techfinance.nfse.view.workspace
audience: internal
sort_order: 240
version: 1
is_published: true
---
# Consultar NFS-e e arquivos disponíveis

**Para que serve:** Consultar NFS-e e arquivos disponíveis, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.nfse`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar NFS-e e arquivos disponíveis (`/finance/nfse`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Filtre por status e empresa/grupo.
2. Alterne lista e Kanban para consultar a situação dos registros.
3. Confira número RPS/nota, valor, erro e emissão quando presentes.
4. Abra PDF ou XML somente se o registro fornecer o link.
5. Use exportação quando autorizado.

## Resultado esperado
Registros fiscais existentes consultados; nenhum documento é emitido por esta consulta.

## Regras e limites
- Kanban não permite atualizar/excluir registros.
- A consulta do servidor limita a 200 registros recentes.
- Exportação exige `techfinance.nfse.export.workspace`.
- O adaptador atual de emissão retorna erro explícito; comentário sobre sandbox no arquivo não significa emissão habilitada.

### Campos e controles
Status; RPS; número da nota; valor; código de serviço; erro; emissão; links PDF/XML quando presentes.

## Erros comuns
“Emissão fiscal indisponível: o adaptador NFS-e não está habilitado. Nenhuma nota foi emitida.”: não há nota emitida; solicite orientação administrativa.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar NFS-e e arquivos disponíveis; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.nfse.tsx; src/lib/nfse.functions.ts -->
