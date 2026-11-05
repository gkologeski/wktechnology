---
module_key: crm
slug: criar-lead
title: Criar lead
summary: Criar lead.
article_type: howto
route_pattern: /leads
min_permission:
audience: internal
sort_order: 100
version: 1
is_published: true
---
# Criar lead
**Para que serve:** Criar lead.
**Quem pode fazer:** Membro ativo com TechSales licenciado. O menu não exige chave específica. O botão exige `techsales.leads.create.own`. Uma negativa de acesso prevalece sobre concessões.
**Onde fica:** Menu > TechSales > Leads (`/leads`).
**Antes de começar:** Abra o workspace correto e localize os registros.
## Passo a passo
1. Clique em "Criar lead".
2. Em "Buscar contato", pesquise por e-mail, nome ou telefone. Selecione um contato ou clique em "Criar do zero".
3. Preencha "Nome *". Complete "Sobrenome", "Email", "Telefone", "Cargo" e "Fonte" quando disponíveis.
4. Se informar "Empresa", selecione o resultado ou crie a empresa antes de continuar.
5. Opcionalmente, informe "LinkedIn" e clique em "Buscar". Revise os dados preenchidos.
6. Clique em "Criar lead".
<!-- screenshot: Criar lead: capturar a tela após o último passo, sem dados pessoais reais. -->
## Resultado esperado
O lead é criado com status inicial new e relações de empresa e contato processadas pelo sistema.
## Regras e limites
Nome é obrigatório. Email e telefone passam por verificação de duplicidade. LinkedIn pode iniciar enriquecimento; revise o retorno antes de salvar. "Site da empresa" aparece quando a empresa selecionada ainda não tem domínio.
## Erros comuns
"Informe ao menos o nome": preencha o nome. "Email inválido": corrija o endereço. "Lead duplicado": abra o registro existente.
## Relacionados
[Permissões](/ajuda/crm/permissoes) · [Campos e status](/ajuda/crm/campos-e-status)
