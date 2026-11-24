# Links "Complete os dados no cadastro de origem" na revisão da minuta

**Porte P — estimativa ~40 min** (código + teste + Ajuda + verificação no navegador). Sem mudança de banco, permissões ou regras.

## O que muda para você
Abaixo da mensagem vermelha, cada pendência vira um atalho para o cadastro certo:
- **Empresa prestadora** (ex.: Endereço da CMK Kologeski) → abre "Empresas e CNPJs do workspace" já com a edição da empresa selecionada aberta.
- **Signatário** (Nome/CPF do signatário) e **dados da cliente** (Endereço da contraparte) → abre a ficha da empresa cliente da proposta, onde se marca o contato como signatário legal e se informa CPF/endereço.
- Mensagem passa a agrupar: "Complete os dados no cadastro de origem e tente novamente:" seguido de "Empresa prestadora: Endereço — Abrir cadastro" e "Cliente/signatário: Nome do signatário, CPF do signatário — Abrir cadastro".
- Após corrigir, basta voltar e clicar de novo em "Preencher dados da proposta". O link abre em nova aba para não perder edições da minuta não salvas.
- Se você não tiver acesso ao cadastro, o link aparece desabilitado com o motivo (a permissão continua sendo checada na tela de destino).

## Detalhes técnicos
- `fillContractDraftFromProposal` (contract-drafts.functions.ts) passa a retornar `missingFields: {label, group}[]` (grupo de `template-tokens.ts`: Contratante/Contraparte/Signatário), mantendo `missing` para compatibilidade, e `sources: { legalEntityId, companyId }` já resolvidos no contexto (sem novas consultas fora do RLS do usuário).
- Mapeamento puro `missing-field-sources.ts` (grupo → destino, respeitando compra/venda: em compra a prestadora é o fornecedor/empresa) com teste unitário.
- `contract-draft-review-page.tsx`: renderiza os links com `<Link>` (`/companies/$id` e `/settings/legal-entities?edit=<id>`).
- `settings.legal-entities.tsx`: `validateSearch` opcional `edit`; `LegalEntitiesPage` abre o diálogo dessa entidade se existir.
- Contrato de permissões: classificação de apresentação (sem novas ações/dados) com hash atualizado; artigo da Ajuda da revisão de minuta com bump de versão.
- Validação: `permissions:check`, testes do mapeamento, `help:coverage`, build e Playwright na minuta Brooks/CMK (somente leitura). Não publicado até sua conferência.
