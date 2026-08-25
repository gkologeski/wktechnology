# Corrigir erro ao salvar candidato (Nicolas F.)

## O que está acontecendo

Ao salvar o candidato, a validação do servidor recusa dois campos que já existem no registro:

1. **LinkedIn**: o valor gravado é `www.linkedin.com/in/nicolas-fernandes-kologeski`, sem `https://`. A validação exige URL completa.
2. **Origem**: o valor gravado é `cv_pdf`, que não está na lista aceita (`manual`, `career_page`, `linkedin_easy_apply`, `referral`, `import`). No banco existem outras origens reais em uso: `linkedin_unipile_search`, `linkedin_apply`, `linkedin_extension`, `cv_pdf`.

Ou seja, o registro nem precisa ser alterado nesses campos: o simples ato de salvar já falha porque o formulário reenvia os valores atuais.

## Ajustes propostos

### 1. Aceitar as origens realmente usadas

Ampliar a lista de origens válidas para incluir as que já existem nos dados (`cv_pdf`, `linkedin_apply`, `linkedin_extension`, `linkedin_unipile_search`), mantendo `manual` como padrão. Valores desconhecidos vindos de registros legados são preservados em vez de bloquear o salvamento.

### 2. Normalizar o LinkedIn em vez de recusar

Antes de validar, completar automaticamente o endereço quando vier sem protocolo (`www.linkedin.com/...` passa a `https://www.linkedin.com/...`). Continua sendo recusado apenas texto que não é endereço válido de forma alguma, e vazio segue permitido.

### 3. Mensagem de erro legível

Hoje o usuário vê o JSON bruto da validação. Passar a exibir uma mensagem em português indicando o campo com problema (ex.: "LinkedIn inválido"), em vez do objeto técnico.

## Detalhes técnicos

- `src/lib/ats/ats.functions.ts`: em `CandidateSaveSchema`, trocar `source` de `z.enum([...])` por um union com fallback tolerante (enum conhecida ∪ string curta preservada), e aplicar um `transform`/`preprocess` no `linkedin_url` para prefixar `https://` quando faltar esquema. O mesmo tratamento de `source` também se aplica ao validador de `addApplication`, para manter coerência.
- `src/routes/_authenticated/(ats)/candidates.$id.tsx`: no `catch` do save, formatar o erro de validação Zod em texto amigável no toast.
- Sem alteração de schema do banco, RLS, permissões ou regra de negócio.

## Como validar

1. Abrir o candidato Nicolas F., alterar qualquer campo e salvar: deve salvar sem erro e o LinkedIn passa a exibir com `https://`.
2. Salvar um candidato de origem `linkedin_extension`/`linkedin_unipile_search`: deve salvar sem erro e a origem exibida permanece a mesma.
3. Informar um LinkedIn claramente inválido (ex.: `abc`): deve exibir mensagem em português apontando o campo.
