## Causa raiz

Ao remover o usuário, `removeTeamMember` faz `UPDATE assigned_user_id` em `contacts`, `companies`, `leads` e `deals`. Todas essas tabelas têm o trigger `enqueue_workflow_event`, cujo corpo contém a expressão:

```sql
if v_entity = 'deals' and (coalesce(new.stage_id,'') is distinct from coalesce(old.stage_id,'') ...)
```

O PL/pgSQL prepara a expressão inteira como SQL na primeira execução por tabela. Mesmo com o guarda `v_entity='deals'`, a referência `new.stage_id` precisa existir no `NEW` daquela tabela. Em `contacts` e `companies` (que não têm `stage_id`) a preparação falha com:

```
record "new" has no field "stage_id"
```

Por isso o erro só aparece quando a reatribuição toca contacts/companies (ou seja, quando o usuário removido tinha registros nessas tabelas). O mesmo padrão afeta `new.stage`, `new.stage_value` e `new.status` em ramos análogos.

## Correção

Reescrever `public.enqueue_workflow_event` para isolar cada tipo de entidade em ramos `IF/ELSIF` separados, de modo que a referência a `NEW.<coluna>` só apareça no ramo da entidade que possui aquela coluna. Nada muda no comportamento dos eventos (`created`, `updated`, `stage_changed`) — só a estrutura do código PL/pgSQL.

### Migração (SQL)

```text
CREATE OR REPLACE FUNCTION public.enqueue_workflow_event() ...
  IF tg_op = 'INSERT' THEN
     v_event := 'created'; ...
  ELSIF tg_op = 'UPDATE' THEN
     v_event := 'updated';  -- default
     IF v_entity = 'deals' THEN
        IF coalesce(new.stage_id::text,'') IS DISTINCT FROM coalesce(old.stage_id::text,'')
           OR new.stage IS DISTINCT FROM old.stage THEN
           v_event := 'stage_changed';
        END IF;
     ELSIF v_entity = 'leads' THEN
        IF new.status IS DISTINCT FROM old.status THEN v_event := 'stage_changed'; END IF;
     ELSIF v_entity = 'tickets' THEN ...
     ELSIF v_entity = 'ats_jobs' THEN ...
     ELSIF v_entity = 'ats_applications' THEN
        IF coalesce(new.stage_value,'') IS DISTINCT FROM coalesce(old.stage_value,'')
           OR new.status IS DISTINCT FROM old.status THEN v_event := 'stage_changed'; END IF;
     ELSIF v_entity = 'ats_interviews' THEN ...
     END IF;
  END IF;
  INSERT INTO public.workflow_events ...;
  RETURN NULL;
```

Cada tabela só compila o ramo que corresponde à sua `v_entity`, então referências como `new.stage_id`, `new.stage_value`, `new.status`, `new.stage` só são resolvidas quando existem.

## Validação

1. `bunx tsgo --noEmit` (não deve mudar — só migração SQL).
2. Repetir a remoção de `e2e@wktechnology.com.br` reatribuindo para `guilherme@wktechnology.com.br` e confirmar sucesso.
3. Sanity: fazer um `UPDATE` em `contacts`, `deals`, `leads` e conferir que `workflow_events` recebe `created/updated/stage_changed` como antes.

## Escopo

- Somente 1 migração SQL alterando a função `enqueue_workflow_event`.
- Nenhuma alteração em rotas, componentes, RLS, grants ou schema de tabelas.
- Sem mudança de contrato dos eventos gravados em `workflow_events`.
