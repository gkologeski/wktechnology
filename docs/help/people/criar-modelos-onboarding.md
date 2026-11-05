---
module_key: people
slug: criar-modelos-onboarding
title: Criar modelos de onboarding e offboarding
summary: Montar checklists reutilizáveis de admissão e desligamento.
article_type: howto
route_pattern: /people/onboarding-templates
min_permission: techpeople.onboarding_templates.view.own
audience: internal
sort_order: 42
version: 1
is_published: true
---
# Criar modelos de onboarding e offboarding
**Para que serve:** Definir as tarefas padrão aplicadas ao iniciar um plano.
**Quem pode fazer:** Ver: `techpeople.onboarding_templates.view`. Criar: `techpeople.onboarding_templates.create`. Editar e excluir são liberados por registro.
**Onde fica:** Menu > TechPeople > Pessoas > Modelos de onboarding (`/people/onboarding-templates`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Clique em "Novo modelo".
2. Preencha "Nome" e escolha o "Tipo": "Admissão" ou "Desligamento".
3. Se quiser, preencha "Cargo (opcional)", "Vínculo (opcional)" e "Descrição".
4. Deixe "Modelo ativo" ligado.
5. Em "Tarefas", clique em "Adicionar tarefa". Preencha "Título da tarefa", "Categoria" e "Dias" (prazo após o início do plano).
6. Clique em "Salvar".
<!-- screenshot: novo modelo -->

## Resultado esperado
"Modelo criado". Para editar, use o ícone "Editar modelo" ("Modelo atualizado").

## Regras e limites
- Nome de 2 a 200 caracteres; toda tarefa precisa de título.
- O modelo novo já vem com "Enviar documentação" (RH, 3 dias) e "Criar acessos (e-mail, ferramentas)" (TI, 1 dia).
- O ícone de alça sobe a tarefa uma posição.
- Use "Filtrar:" para ver "Todos", "Admissão" ou "Desligamento". Inativos aparecem com "Inativo".

## Erros comuns
- "Registro indisponível ou sem permissão para editar.": você não pode alterar esse modelo.
- Nome com 1 caractere: o botão salva, mas o servidor recusa.

## Relacionados
- [Acompanhar onboarding](/ajuda/people/acompanhar-onboarding)
