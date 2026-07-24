## Problema

Ao salvar uma regra de scoring o banco rejeita com `scoring_rules_entity_check`.

O CHECK atual só aceita:
```
entity = ANY (ARRAY['leads','contacts'])   -- plural, e sem "company"
```

Mas o backend (`src/lib/scoring.functions.ts`) e a UI validam/enviam valores no singular:
```
EntityEnum = z.enum(['lead','contact','company'])
```

Ou seja: qualquer INSERT/UPDATE feito pelo app é rejeitado pelo CHECK. Além disso `company` nunca foi permitido no banco, apesar de existir na UI.

## Correção

Migration única para relaxar o CHECK e alinhar aos valores do domínio:

1. `ALTER TABLE public.scoring_rules DROP CONSTRAINT scoring_rules_entity_check;`
2. Recriar como:
   ```sql
   ALTER TABLE public.scoring_rules
     ADD CONSTRAINT scoring_rules_entity_check
     CHECK (entity IN ('lead','contact','company'));
   ```

Nenhuma alteração de código de aplicação, RLS, GRANT ou schema é necessária — o app já usa os valores no singular. Não há linhas legadas com valores plurais para migrar (o CHECK anterior teria bloqueado, e o app sempre gravou no singular via server function, então o CHECK simplesmente nunca aceitou nada — regras existentes, se houver, foram criadas antes do CHECK atual).

## Verificação após aprovação

- `SELECT DISTINCT entity FROM public.scoring_rules;` para confirmar que nenhuma linha existente conflita com o novo CHECK (caso conflite, converter `leads`→`lead`, `contacts`→`contact` no mesmo migration antes do ADD).
- Criar uma regra pela UI (Lead / source / = / site) e confirmar que salva.
