# Impedir leads duplicados por workspace

## Objetivo

Garantir que não seja possível criar leads duplicados no mesmo workspace. Um lead é considerado duplicado quando o e-mail **ou** o telefone já existe em outro lead ativo do mesmo workspace.

## Regras confirmadas

- Critério de duplicidade: **e-mail OU telefone** igual a um lead existente no workspace.
- Escopo: **por workspace** (`workspace_id`).
- Comportamento: **bloquear com erro claro** ao tentar salvar.

## O que será feito

1. Adicionar índices únicos parciais na tabela `leads` para impedir duplicidade por `workspace_id` + e-mail e por `workspace_id` + telefone, ignorando valores vazios/nulos.
2. Criar uma função de validação no banco (trigger `BEFORE INSERT OR UPDATE`) que normalize o telefone, ignore e-mails/telefones vazios e lance um erro amigável em português quando houver duplicata.
3. Adicionar validação preemptiva no frontend/server function de criação/edição de leads para detectar duplicata antes de enviar ao banco e mostrar mensagem clara.
4. Tratar telefones com formatação diferente (remover caracteres não numéricos na comparação).
5. Garantir que a regra se aplique também em importações em lote (HubSpot, Apollo, CSV) com mensagem de erro por registro duplicado.

## Detalhes técnicos

- Tabela: `public.leads`.
- Colunas envolvidas: `workspace_id`, `email`, `phone`.
- Índices sugeridos:
  - `CREATE UNIQUE INDEX idx_leads_unique_email_per_workspace ON leads (workspace_id, lower(email)) WHERE email IS NOT NULL AND email <> '';`
  - `CREATE UNIQUE INDEX idx_leads_unique_phone_per_workspace ON leads (workspace_id, regexp_replace(phone, '[^0-9]', '', 'g')) WHERE phone IS NOT NULL AND phone <> '';`
- Trigger opcional para mensagem de erro amigável em PT-BR.
- Server functions afetadas: criação/edição de leads, importação HubSpot, importação Apollo, importação CSV.
- Sem alteração de RLS ou regra de negócio além da unicidade.

## Como validar

1. Tentar criar um lead com e-mail já existente no workspace → deve bloquear com mensagem clara.
2. Tentar criar um lead com telefone já existente (mesmo com formatação diferente) → deve bloquear.
3. Confirmar que e-mails/telefones vazios não geram bloqueio.
4. Confirmar que leads com mesmo e-mail em workspaces diferentes não são bloqueados.
5. Rodar `bun run typecheck`, `bun run lint` e `bun run build:dev`.

## Riscos

- Índice parcial em telefone pode ser caro se a coluna for muito usada em filtros; verificar uso antes de criar.
- Normalização de telefone no banco pode divergir da normalização no frontend; manter consistente.
- Importações em lote podem falhar completamente se houver um duplicado no meio do lote; decidir se falha tudo ou pula o duplicado.
