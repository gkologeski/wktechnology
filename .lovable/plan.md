## Objetivo

Criar em `/prospecting → Questionários` os três modelos prontos (MEDDIC, CHAMP e GPCT) para o workspace atual, reutilizando os templates já definidos em `src/lib/prospecting/questionnaires.functions.ts` (`FRAMEWORK_TEMPLATES`).

## Contexto verificado

- A UI da aba Questionários já expõe um seletor "Criar a partir de..." que chama a server function `seedFramework` — uma opção é apenas clicar 3 vezes ali. O pedido, porém, é que os modelos já apareçam prontos.
- Os templates BANT/MEDDIC/CHAMP/GPCT existem no código com perguntas, pesos, opções e `pass_threshold` (linhas ~224–352 de `questionnaires.functions.ts`).
- As tabelas `prospecting_questionnaires` e `prospecting_questions` exigem `owner_id` (RLS impõe `owner_id = auth.uid()` no INSERT).

## Plano

1. Identificar o `owner_id` do usuário atual (dono do workspace ativo em `/prospecting`) via `supabase--read_query` em `profiles` / `workspace_members`, para confirmar quem receberá os questionários.
2. Rodar um `supabase--insert` único que, em uma transação:
   - Insere 3 linhas em `prospecting_questionnaires` (MEDDIC, CHAMP, GPCT) com `framework`, `name`, `description`, `pass_threshold`, `enabled = true` e `owner_id` = usuário identificado, usando `ON CONFLICT DO NOTHING` por `(owner_id, framework, name)` quando houver constraint — caso não haja, um `WHERE NOT EXISTS` evita duplicar caso o usuário já tenha semeado.
   - Insere as respectivas perguntas em `prospecting_questions` com `position`, `label`, `type`, `options` (JSON), `weight` e `required` idênticos aos definidos em `FRAMEWORK_TEMPLATES`.
3. Validar via `supabase--read_query` que os 3 questionários aparecem com o número correto de perguntas (MEDDIC=6, CHAMP=4, GPCT=4).

## Fora do escopo

- Nenhuma alteração de UI, RLS, schema ou lógica de negócio.
- BANT (o usuário não pediu; preservamos qualquer BANT já criado).

## Como validar

Abrir `/prospecting?tab=questionarios` e conferir os 3 novos cards (MEDDIC, CHAMP, GPCT). Abrir cada um pelo lápis e verificar as perguntas listadas.

## Pergunta antes de executar

Confirma que o alvo é o seu usuário/workspace atual (o mesmo em que você está logado agora no preview)? Se quiser semear para todos os workspaces ou para um workspace específico, me diga qual.
