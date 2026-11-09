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
version: 3
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
