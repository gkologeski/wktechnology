---
module_key: contracts
slug: gerar-de-modelo
title: Gerar contrato pelo diálogo de modelo publicado
summary: Gerar contrato pelo diálogo de modelo publicado no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts
min_permission:
audience: internal
sort_order: 25
version: 7
is_published: true
---
# Gerar contrato pelo diálogo de modelo publicado
**Para que serve:** Gerar contrato pelo diálogo de modelo publicado.
**Quem pode fazer:** Membro ativo com criação de contratos no escopo próprio ou workspace, leitura do modelo, da Proposta Comercial e da pessoa jurídica prestadora. As permissões efetivas e o RLS continuam aplicáveis; deny prevalece.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Modelo publicado disponível.

## Passo a passo
1. Clique em "Gerar de modelo".
2. Em "Gerar contrato a partir de modelo", escolha "Modelo publicado".
3. Para o modelo de hunting, escolha a **Proposta Comercial aceita** e a **pessoa jurídica prestadora**. O aceite é o do cliente, não a aprovação interna.
4. Preencha "Serviço (opcional)" e "Título do contrato (opcional)" se necessário.
5. Use "Pré-visualizar" para revisar o texto mesclado.
6. Clique em "Gerar contrato".
![Tela: Gerar contrato pelo diálogo de modelo publicado, sem dados pessoais reais](/help-media/contracts/gerar-de-modelo.webp)

No assistente **Novo contrato**, a etapa **Dados** também permite escolher a Proposta Comercial aceita e a prestadora quando a origem é um modelo. Para origem em proposta, a lista contém apenas propostas aceitas pelo cliente.

## Resultado esperado
"Contrato gerado em rascunho." e abertura da ficha.

## Regras e limites
- Prévia não é requisito obrigatório de geração, mas permite revisão.
- Empresa e negócio vêm do contexto; não são seletores desse diálogo.
- Trocar modelo, proposta, pessoa jurídica, serviço ou título limpa a prévia.
- `proposal.id`, `proposal.title`, `proposal.version` e `proposal.decided_at` vêm da versão aceita. A data é exibida no fuso de São Paulo.
- Os dados da cliente e os itens são preservados no envio da proposta. Alterar depois a cotação, o negócio ou os cadastros não altera a proposta enviada.
- O contrato guarda a versão aceita e não permite trocar ou apagar esse vínculo. A ficha mostra a proposta e a data do aceite.
- Variáveis usadas no modelo precisam estar preenchidas para gerar um contrato vinculado à proposta. Cadastre os dados ausentes antes de continuar.
- A prestadora vem da pessoa jurídica selecionada ou configurada nos padrões do modelo. Preencha nome, CNPJ e endereço (`street`, `number`, `complement`, `neighborhood`, `city`, `state`, `zip_code` ou equivalentes em português) em `address_json`. O sistema não escolhe outra prestadora para suprir dados ausentes.
- A proposta é o documento comercial incorporado ao contrato. Não é criado outro documento de ordem de serviço.
- Título até 200 caracteres. Opções de serviços limitadas a 500.
- Geração não envia para assinatura nem aplica sobre contrato existente.

## Erros comuns
"Proposta sem versão preservada": propostas enviadas antes desta funcionalidade não têm histórico reconstruído. Gere uma nova proposta e obtenha novo aceite do cliente antes de vinculá-la.
"Preencha os dados obrigatórios do modelo": complete os campos indicados; não substitua por valores fictícios.
"Nenhum modelo publicado. Publique um modelo em Contratos → Modelos." ou "Modelo não encontrado": confira o modelo.

## Relacionados
- [Editar e publicar modelo](/ajuda/contracts/editar-publicar-modelo)


## Preenchimento automático

Ao gerar um contrato a partir de uma proposta aceita, o sistema preenche: parcelas, dia de vencimento e vigência (padrão 90 dias, com fim calculado a partir do início); multa (padrão 2%) e foro (padrão Florianópolis-SC), salvo se o modelo definir outro valor; e o signatário da contratante (contato marcado como signatário legal, com CPF). Se houver mais de um signatário, nenhum é escolhido automaticamente. Endereço vazio da pessoa jurídica prestadora é completado pelos dados oficiais do CNPJ, sem sobrescrever endereço já cadastrado. Novas variáveis: `{{contract.validity_days}}`, `{{contract.installments_count}}`, `{{contract.installments_due_day}}`, `{{signer.full_name}}`, `{{signer.cpf}}`, `{{signer.email}}`.

## Parcelas, vencimento e lei aplicável

No passo **Dados** do Novo contrato, os campos **Parcelas** e **Dia de vencimento** já vêm preenchidos com os da proposta e são obrigatórios quando a proposta não tem condições de pagamento (entrada e saldo); ajuste-os se este contrato tiver condições diferentes. A **Lei aplicável** tem padrão "Legislação da República Federativa do Brasil", salvo se o modelo definir outra. Se faltar algum dado obrigatório, a mensagem mostra o nome do campo em português.

## Vigência a partir da proposta

Ao gerar o contrato de uma proposta aceita, o início é a data de hoje e o término soma os dias de vigência da proposta (padrão 90 dias). O passo **Dados** mostra essas datas para conferência.

## Condições de pagamento no contrato

Quando a proposta tem condições de pagamento (entrada e saldo mensal, periódico ou por marcos), o contrato recebe essas condições e mostra o cronograma no cartão **Condições de pagamento** da ficha. Nesse caso, **Parcelas** e **Dia de vencimento** no passo Dados são opcionais. A forma de pagamento da proposta também vai para o contrato.

Nos modelos, use `{{contract.payment_schedule}}` (Condições de pagamento) para escrever o resumo das condições, por exemplo "entrada de 30% do total (vence na assinatura do contrato) · 1 marco de entrega". Sem condições, a variável usa o formato antigo: "N parcela(s), com vencimento todo dia X".

## Dados do modelo no Novo contrato

No passo **Dados**, o quadro **Dados do modelo** lista cada variável que o modelo usa e mostra o valor que entrará no contrato ou **Falta**. O botão Avançar só continua quando nada falta.
- **Escopo do serviço** e **Valor mensal (R$)** aparecem quando o modelo os usa e valem só para este contrato. O valor mensal por extenso é escrito automaticamente.
- **Endereço** da empresa e **Nome/CPF do signatário** vêm do cadastro: preencha o endereço da empresa e marque um contato como signatário legal, com CPF. Use o link **Abrir a ficha da empresa**. Sem endereço cadastrado, o documento usa o endereço oficial do CNPJ, quando houver CNPJ.
