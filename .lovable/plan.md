# TechSales mostrando 0 Leads

## Diagnóstico (confirmado)

A tela `/leads` não está vazia por falta de dados nem por permissão: a consulta ao banco falha com erro 400 antes de retornar qualquer linha.

Erro observado nas requisições da própria sessão:

```text
GET /rest/v1/leads?select=id,first_name,...,contact_id,...  → 400
{"code":"42703","message":"column leads.contact_id does not exist"}
```

Verificado no banco: a tabela `public.leads` **não** possui as colunas `contact_id` nem `value` (tem `converted_contact_id`, `company_id`, `score`, etc.). Ambas estão listadas na projeção fixa do grid (`BASE_LEAD_KEYS` em `src/routes/_authenticated/leads.tsx`, linhas 148 e 153), incluída na refatoração recente de projeção dinâmica.

Como a consulta falha, o grid cai no estado vazio genérico ("0 leads") em vez de mostrar erro — o que esconde a causa real.

## Correção

1. **Alinhar a projeção ao schema real**: remover `contact_id` e `value` de `BASE_LEAD_KEYS`. Nenhuma célula do grid consome essas colunas (uso verificado: as ocorrências de `value` no arquivo são de opções de filtro/props, não do campo do lead). Se o vínculo com contato precisar aparecer, usar `converted_contact_id`, que existe.
2. **Blindar a projeção contra colunas inexistentes**: validar as chaves declaradas contra o catálogo de campos da entidade (`getEntityFieldCatalog`) antes de montar o `select`, do mesmo modo que as colunas do grupo "Outros campos" já são validadas — evitando que uma chave errada quebre o grid inteiro de novo.
3. **Estado de erro visível**: quando a consulta de listagem falhar, exibir o `ErrorState` padrão do design system (mensagem em PT-BR + "tentar novamente") em vez do estado vazio, mantendo loading e empty atuais.
4. **Auditar as demais telas migradas** (Contatos, Empresas, Negócios, Tarefas) para conferir se alguma outra chave da projeção fixa não existe no schema, corrigindo do mesmo jeito.

## Fora do escopo

- Não altera RLS, permissões, schema do banco nem regra de negócio.
- Não mexe em filtros, ordenação ou preferências de coluna além do necessário para a correção.

## Detalhes técnicos

- `src/routes/_authenticated/leads.tsx`: ajuste em `BASE_LEAD_KEYS`; ramo de erro na renderização da lista.
- `src/hooks/use-grid-projection.ts` / `src/lib/grid/dynamic-select.ts`: filtro das chaves base pelo catálogo da entidade (interseção), preservando `id` sempre.
- Validações: `bun run typecheck`, lint nos arquivos alterados e verificação no preview de `/leads` (contagem > 0, filtros e editor de colunas funcionando).

## Como validar

Abrir `/leads` e confirmar a listagem com os leads existentes e a contagem correta; aplicar um filtro e trocar colunas no editor para garantir que a projeção dinâmica continua funcionando.
