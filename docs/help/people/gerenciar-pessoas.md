---
module_key: people
slug: gerenciar-pessoas
title: Cadastrar e gerenciar pessoas
summary: Cadastrar prestadores e o time interno, filtrar, usar o kanban e ações em massa.
article_type: howto
route_pattern: /people
min_permission: techpeople.people.view.own
audience: internal
sort_order: 10
version: 1
is_published: true
---
# Cadastrar e gerenciar pessoas
**Para que serve:** Manter o cadastro de prestadores, contratados e time interno.
**Quem pode fazer:** Ver: `techpeople.people.view`. Cadastrar: `techpeople.people.create`. Editar e excluir em massa são liberados por registro. Custos só para quem tem `techpeople.people_sensitive.update`.
**Onde fica:** Menu > TechPeople > Pessoas > Pessoas (`/people`).
**Antes de começar:** Nenhum.

## Passo a passo
1. Clique em "Nova pessoa".
2. Em "Identificação", preencha "Nome completo *". E-mail, telefone e localização são opcionais.
3. Em "Trabalho", escolha "Cargo / posição", "Senioridade", "Vínculo" e "Status".
4. Se tiver, preencha "Dados legais", "Financeiro" e "Notas & tags".
5. Clique em "Cadastrar".
<!-- screenshot: nova pessoa -->

## Resultado esperado
"Pessoa cadastrada". A pessoa aparece na lista.

## Buscar, filtrar e kanban
- Busque por nome, e-mail ou cargo (mínimo 2 letras).
- Filtre por "Status", "Vínculo", "Cargo", "Contratação entre" e "Responsável".
- No kanban, cada coluna é um status. Arraste o cartão para mudar ("Etapa atualizada").
- Marque linhas para "Exportar selecionados", "Editar em massa", "Responsável" ou "Excluir".

## Regras e limites
- Status: "Ativo", "Bench", "Afastado", "Em desligamento", "Desligado".
- Vínculo: "PJ", "CLT", "Terceiro", "Estagiário", "Outro". Padrão: PJ e Ativo.
- Nome de 2 a 160 caracteres; até 20 tags separadas por vírgula.
- A lista mostra até 500 pessoas e esconde arquivadas.
- Excluir em massa apaga o cadastro; não é arquivar.

## Erros comuns
- "Cadastrar" desabilitado: o nome tem menos de 2 letras.
- Campos de custo não aparecem: você não tem acesso a dados financeiros.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Importar do Google Forms](/ajuda/people/importar-google-forms)
