# Aceitar o rascunho e padronizar Chamados / Hunting

Duas entregas em sequência:

1. **Aceitar o rascunho** para que a migração aditiva (Criador × Responsável) seja aplicada ao banco do projeto.
2. **Padronizar Chamados (TechService) e Hunting (TechHire)** para exibir e filtrar Responsável com a mesma cascata já usada em Leads, Contatos, Empresas, Negócios e Tarefas.

## Antes de aceitar: um ajuste na migração

Verificação no banco: a tabela `tickets` **não** tem `assigned_to`; ela já tem `owner_id` (criador) e `assignee_id` (responsável), com 42 de 345 chamados atribuídos. A migração em rascunho hoje cria uma coluna `assigned_to` nova em `tickets`, o que criaria um segundo campo de responsável concorrente.

Correção: em vez de criar coluna nova, a migração passa a tratar `assignee_id` como a coluna de responsável de `tickets` — backfill de `assignee_id` a partir de `owner_id` quando vazio, gatilho de default na criação e escopo "meus registros" considerando `assignee_id`. Nenhuma coluna é removida ou renomeada; segue aditiva.

`ats_candidates` já tem `owner_id`, `created_by` e `assigned_to`, então Hunting não precisa de mudança de schema — só de interface.
