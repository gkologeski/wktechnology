# ENDERECO-ATUAL — contrato usa o endereço atual da empresa

**Porte:** P · **Estimativa:** 20–30 min

## Causa (confirmada)
- O cadastro da NEXID LTDA já tem endereço, cidade (Ponta Grossa), UF (PR) e CEP, gravados pelo enriquecimento hoje às 19:14 UTC.
- Quando o contrato vem de uma proposta aceita, o sistema usa a **cópia da proposta guardada no momento do aceite**. Nessa época a empresa ainda não tinha endereço, por isso aparece "Falta".
- "Valor mensal" e o extenso também aparecem como "Falta" porque a proposta tem entrada + saldo, sem mensalidade. Isso é esperado: basta digitar o "Valor mensal (R$)" no assistente, e o extenso sai sozinho.

## O que muda
1. Os **dados cadastrais da contratante** (endereço, cidade, UF, CEP e CNPJ) passam a vir do cadastro atual da empresa, quando ele está preenchido. Valores, itens, condições de pagamento e texto da proposta continuam vindo da cópia aceita, sem mudança.
2. O quadro "Dados do modelo" no assistente segue a mesma regra, então mostra o endereço atual.
3. O endereço passa a incluir o CEP, se ele estiver no cadastro.
4. A Ajuda "Gerar contrato de modelo" ganha uma nota: os dados da empresa vêm da ficha atual.

## Fora do escopo
- O valor mensal não será preenchido automaticamente, porque a proposta não tem mensalidade.
- Nada muda no aceite da proposta nem na cópia guardada.

## Detalhes técnicos
- `template-merge.server.ts`: depois de `loadAcceptedProposalSource`, ler `companies` (address, city, state, cep, cnpj) pelo cliente do usuário (RLS) e no mesmo workspace. Fazer merge campo a campo, dando preferência ao cadastro quando ele não está vazio. O lookup do CNPJ continua como último recurso.
- `diagnoseContractTemplate` herda o mesmo fluxo de merge.
- Teste unitário da regra de merge: cadastro preenchido vence a cópia vazia; cadastro vazio mantém a cópia.
- Bump da `version` do artigo da Ajuda e do official-catalogue. Hash atualizado em permission-contracts.json. Sem permissão nova, porque reusa a geração de contrato.
- Validação: vitest dos contratos, tsgo e o assistente no Playwright com a proposta 32dba375.
