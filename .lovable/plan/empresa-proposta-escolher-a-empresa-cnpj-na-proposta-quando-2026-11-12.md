# EMPRESA-PROPOSTA — escolher a empresa (CNPJ) na proposta quando a herdada estiver inativa

Porte: M. Estimativa: 2h30 a 3h (implementação, testes, Ajuda e teste no navegador).

## Causa confirmada
- A proposta pega a empresa (CNPJ) do Negócio de origem.
- 1.801 negócios, 952 cotações, 42 contratos e 3 propostas ainda estão ligados à "WK Technology". Ela foi desativada quando virou grupo empresarial.
- A regra do banco recusa novos vínculos com empresa inativa, e por isso aparece "Empresa (CNPJ) inativa, inexistente ou de outro workspace".

## O que muda para o usuário
1. O assistente de proposta ganha o campo **Empresa emissora (CNPJ)** na primeira etapa. Ele lista só as empresas ativas: GM Kologeski, CW Kologeski e CMK Kologeski.
2. Se o Negócio ou a cotação de origem tiver uma empresa ativa, o campo já vem preenchido com ela.
3. Se a empresa de origem estiver inativa (caso da WK Technology), o campo vem vazio. Aparece o aviso "A empresa do negócio está inativa. Escolha a empresa emissora", e não dá para avançar nem salvar rascunho sem escolher.
4. A escolha é gravada só na proposta, e o contrato gerado a partir dela herda essa empresa. Negócios, cotações e registros antigos não mudam e mantêm o histórico com a WK.
5. Em vez do erro técnico, a mensagem passa a ser em português claro e indica o campo.

## Fora do escopo
- Trocar a empresa dos 1.801 negócios e 952 cotações.
- O mesmo ajuste na criação de cotação e de contrato. Essas telas podem ter o mesmo problema; corrijo depois, se você pedir.

## Detalhes técnicos
- Servidor (`src/lib/proposals/functions.ts`, criar/atualizar): aceitar `legal_entity_id` opcional e validar com o cliente do usuário (RLS) que a empresa está ativa e é do mesmo workspace. Se não vier, usar a empresa da origem só quando ela estiver ativa. Se estiver inativa, devolver o erro amigável `LEGAL_ENTITY_REQUIRED`.
- Opções do campo: reaproveitar `listEntityReferences` (`finance-references.functions`), filtrando as ativas. Herdar a permissão de leitura já usada pelo assistente; nenhuma permissão nova.
- `ProposalWizard`: campo Select com label, estado de carregamento, de erro e de lista vazia, e a validação do passo 1 (também no rascunho).
- `sales-flow.server.ts` (Proposta → Contrato): conferir que o contrato usa o `legal_entity_id` da proposta.
- Banco: sem migração. A regra atual continua igual.
- Testes: escolha válida aceita; empresa inativa recusada; empresa de outro workspace recusada; empresa herdada inativa sem escolha leva a `LEGAL_ENTITY_REQUIRED`; empresa herdada ativa é preenchida automaticamente. Atualizar o contrato de permissões dos arquivos alterados.
- Ajuda: artigo "Gerenciar propostas", versão 6, com a seção "Empresa emissora".
- Validação: `permissions:check`, testes de propostas, `help:coverage` e Playwright criando uma proposta a partir de um negócio ligado à WK.
