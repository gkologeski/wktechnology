---
module_key: crm
slug: criar-contato
title: Criar contato
summary: Criar contato.
article_type: howto
route_pattern: /contacts
min_permission:
audience: internal
sort_order: 101
version: 1
is_published: true
---
# Criar contato
**Para que serve:** Criar contato.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. O botão exige `techsales.contacts.create.own`. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Contatos (`/contacts`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Clique em "Criar contato".
2. Preencha "Nome *" e, se necessário, "Sobrenome", "Email", "Telefone", "WhatsApp (celular)" e "Cargo".
3. Em "Empresa", selecione uma empresa existente ou conclua a criação da empresa.
4. Clique em "Criar contato".
<!-- screenshot: Criar contato: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
A mensagem "Contato criado" permite usar "Ir para o contato".
## Regras e limites
Nome é obrigatório. Empresa é opcional, mas um nome de empresa digitado precisa ser selecionado na lista. Telefone e WhatsApp são validados antes da gravação.
## Erros comuns
"Informe ao menos o nome": preencha o campo. "Email inválido": corrija o endereço. "Já existe um contato com esses dados (duplicado).": consulte o contato existente. "Empresa selecionada não é mais válida. Selecione outra ou deixe em branco.": refaça a seleção. "Limite de contatos do plano atingido. Faça upgrade para criar mais.": procure o administrador.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
