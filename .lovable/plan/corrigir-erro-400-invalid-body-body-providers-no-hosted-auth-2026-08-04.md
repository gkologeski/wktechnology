# Corrigir erro 400 "Invalid body: body/providers" no hosted auth da Unipile

## Diagnóstico

A chave da API agora é aceita (o erro deixou de ser 401 e passou a ser 400 de validação
de corpo). O que a Unipile v2 recusa é o campo `providers` enviado em
`src/lib/unipile/client.server.ts` (`createHostedAuthLink`, linha 421):

```
providers: ["LINKEDIN"]
```

A mensagem de erro diz que `providers` deve ser uma _string_ ou um valor de um enum
específico, e que o item `providers/0` também não está entre os valores permitidos.
Ou seja: o formato herdado da v1 (array com o nome em MAIÚSCULAS) não é válido na v2.

O valor exato aceito não pode ser confirmado a partir do código — precisa ser
descoberto contra a API real (a v2 aceita a forma string, tipicamente em minúsculas,
e também um curinga para "todos os provedores").

## O que fazer

1. **Descobrir o valor aceito** com uma sonda server-side controlada: tentar, em ordem,
   `"linkedin"` (string), `["linkedin"]` e `"*"`, registrando qual retorna 200. Isso é
   feito uma única vez, no ambiente, sem expor a chave em log.
2. **Fixar o formato correto** em `createHostedAuthLink`, com uma constante única
   (`HOSTED_AUTH_PROVIDER`) para não espalhar o literal pelo código.
3. **Melhorar a mensagem de erro** de validação: hoje o corpo cru do provedor chega
   até a tela. Mapear `api/invalid_parameters` para uma mensagem pt-BR
   ("A Unipile recusou os parâmetros da conexão. Detalhe técnico disponível abaixo.")
   mantendo o detalhe recolhível, no mesmo padrão já usado para credenciais.
4. **Revalidar o restante do corpo** enviado (`type`, `expires_on`, `redirect_uri`)
   contra a resposta da API na mesma sonda, para garantir que não há um segundo campo
   inválido escondido atrás do primeiro erro.

## Detalhes técnicos

- Arquivo principal: `src/lib/unipile/client.server.ts` — apenas o corpo da requisição
  e o mapeamento de erro em `createHostedAuthLink`.
- `src/lib/unipile/accounts.functions.ts` — acrescentar `invalid_parameters` ao mapa
  `CREDENTIAL_MESSAGE` (ou um mapa irmão de erros de requisição) para que
  `startLinkedinConnect` devolva texto em pt-BR.
- Tela `/settings/integrations/linkedin`: nenhuma mudança estrutural; apenas passa a
  exibir a mensagem tratada com detalhe técnico recolhível.
- Sem migration, sem mudança de schema, RLS, autenticação ou regra de negócio.

## Riscos e pendências

- A validação final só é possível chamando a API real; se a sonda mostrar que a v2
  exige um campo adicional (por exemplo identificação da aplicação), isso entra como
  ajuste no mesmo arquivo antes de finalizar.
- Contas LinkedIn já conectadas não são afetadas.
