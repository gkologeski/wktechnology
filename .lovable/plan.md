# DADOS-ADITIVO — Corrigir o erro ao criar contrato a partir do Aditivo_NEXID

Porte: M. Estimativa: 60–90 min (mais 15 min para o artigo da Ajuda e as permissões).

## Por que o erro acontece (confirmado nos dados)
O modelo exige todos os campos que usa. Para a proposta da NEXID LTDA faltam:
- **Endereço**: a empresa NEXID LTDA está sem endereço e sem cidade.
- **Nome e CPF do signatário**: a NEXID tem 1 contato, mas ele não está marcado como signatário legal.
- **Escopo do serviço, Valor mensal e Valor mensal por extenso**: hoje só vêm dos padrões do modelo ou de um serviço do catálogo, nunca da proposta. Como a proposta tem entrada e saldo (não é mensal), esses campos ficam vazios.

O sistema só avisa no último passo, o que obriga a voltar e não diz onde corrigir.

## O que será feito
1. **Novo quadro "Dados do modelo" no passo Dados.** Ele lista cada campo que o modelo usa e mostra, para cada um, se está "Preenchido" ou "Falta", com o valor que vai entrar no contrato.
2. **Preencher na hora o que é só do contrato:** campos para **Escopo do serviço** e **Valor mensal**. O valor por extenso é calculado sozinho. O escopo já vem com os itens da proposta, se existirem.
3. **Atalhos para o que é cadastro:** quando faltar o endereço da empresa ou o signatário, aparece um link para abrir a ficha da empresa ou do contato e completar o dado. O sistema não inventa valores.
4. **Endereço da empresa pelo CNPJ:** se a empresa não tiver endereço, ele é buscado nos dados oficiais do CNPJ, como já acontece com a prestadora, sem sobrescrever o que já foi cadastrado.
5. **Aviso antecipado:** o botão Avançar do passo Dados avisa sobre os campos que faltam, em vez de só mostrar o erro no final.
6. Atualizar o artigo da Ajuda "Gerar contrato" e o registro de permissões. As permissões atuais de contratos continuam valendo.

## O que você pode fazer agora, sem esperar
- Na empresa NEXID LTDA, preencha endereço e cidade.
- No contato da NEXID, marque "Signatário legal" e informe o CPF.
- No modelo Aditivo_NEXID, defina um escopo e um valor mensal padrão, ou retire essas variáveis se não se aplicarem a este aditivo.

## Detalhes técnicos
- `template-merge.server.ts`: novo modo "diagnóstico" (sem gravar) que devolve os campos usados e os que faltam; entradas opcionais `serviceScope` e `monthlyValue`; escopo derivado dos itens da proposta; o endereço da contraparte é preenchido por `lookupCnpjAddress` só quando estiver vazio, pelo cliente do usuário (RLS).
- `contract-wizard.tsx`: quadro de diagnóstico, campos novos e validação no passo 2.
- A checagem rígida no servidor continua como última barreira.
- Testes: campos faltantes detectados, escopo e valor mensal informados liberam a geração, endereço cadastrado nunca é sobrescrito.
