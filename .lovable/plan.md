# Telefone celular no enriquecimento Apollo (prospecção)

## Diagnóstico (verificado no código)

Não, hoje o Apollo **não** traz celular. Duas causas somadas:

1. `src/lib/integrations/apollo-enrich.server.ts` chama `/people/match` com
   `reveal_phone_number: false`. Sem esse flag, a Apollo devolve o perfil sem
   números pessoais/diretos — normalmente só o telefone corporativo.
2. Na busca de prospects (`src/lib/prospecting.functions.ts`, linha ~456), quando
   a pessoa não tem telefone o lead é gravado com
   `org.primary_phone.number || org.phone` — ou seja, o **fixo da empresa**. É
   exatamente o número que aparece na execução do Flavio Taniguchi.

Complemento: a tabela `leads` não tem coluna de celular (só `contacts` tem
`mobile_phone`), então mesmo que o celular viesse, ele não teria onde ser
guardado no lead. O mapeamento já separa trabalho x celular
(`work`/`mobile`), mas recebe a lista vazia de números.

## O que será feito

1. **Pedir o telefone à Apollo**: ligar `reveal_phone_number` no
   `people/match`, mantendo tolerância a falha (créditos/permissão da chave
   viram aviso, como já é hoje).
2. **Priorizar celular**: quando houver número do tipo `mobile`, ele é o valor
   preferido para o campo de telefone do lead/contato; o corporativo fica como
   segundo.
3. **Nunca sobrescrever pessoa com telefone da empresa**: o fixo da organização
   passa a ser gravado apenas no registro de **Empresa**, não no telefone do
   lead. Se não houver telefone da pessoa, o campo do lead fica vazio (e o fixo
   continua visível pela empresa vinculada).
4. **Novo campo `mobile_phone` em `leads`**: migration aditiva (com GRANT/RLS
   herdados da tabela existente), exposto no formulário/detalhe do lead e no
   catálogo de campos, para o celular não competir com o telefone fixo.
5. **Indicar a origem**: no painel de qualificação, o selo do Apollo passa a
   diferenciar "celular" de "telefone corporativo" quando ambos existirem.

## Detalhes técnicos

- `apollo-enrich.server.ts`: `reveal_phone_number: true`; `person.phone` passa a
  ser `mobile ?? work`; `person.mobile_phone` mantém o celular.
  Observação importante: a Apollo pode entregar números revelados de forma
  assíncrona por `webhook_url`. Nesse caso o retorno imediato traz o perfil sem
  o número e a entrega chega depois — para isso será adicionada uma rota
  `src/routes/api/public/hooks/apollo-phone.ts` que valida um segredo
  (`APOLLO_WEBHOOK_SECRET`) e atualiza lead/contato pelo `id` enviado no
  `context`. Se a chave da conta já retornar o número no corpo da resposta, o
  webhook simplesmente não é acionado.
- `src/lib/prospecting.functions.ts`: remover o fallback de
  `org.primary_phone`/`org.phone` para o telefone do prospect; manter esses
  valores no bloco de empresa.
- `src/lib/prospecting/qualification-enrichment.server.ts`: incluir
  `mobile_phone` em `LEAD_KEYS` após a migration.
- Migration: `alter table public.leads add column if not exists mobile_phone text;`
  (aditiva, sem alterar RLS nem políticas existentes).
- Sem mudança em autenticação, permissões ou regras de qualificação.

## Pendências / dependências externas

- Revelar telefone consome créditos da conta Apollo e depende da permissão da
  API key. Se a chave atual não tiver esse escopo, o resultado será um aviso
  ("Apollo não retornou telefone") e nada será gravado — não haverá simulação.

## Como validar

1. Reexecutar a prospecção do Flavio Taniguchi: o telefone do lead deixa de ser
   o fixo `utp.br`; se a Apollo devolver celular, ele aparece em "Celular".
2. Lead sem telefone pessoal: campo de telefone vazio e fixo visível na empresa.
3. Conferir o painel de qualificação: selo Apollo distinguindo celular x
   corporativo.
