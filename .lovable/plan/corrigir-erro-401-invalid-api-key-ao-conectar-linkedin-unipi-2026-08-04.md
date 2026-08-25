# Corrigir erro 401 "Invalid API Key" ao conectar LinkedIn (Unipile)

## Diagnóstico

O código está chamando a API v2 da Unipile corretamente:

- Base URL: `https://api.unipile.com/v2` (confirmado na documentação v2)
- Autenticação: header `X-API-KEY` (confirmado na documentação v2)
- Endpoint usado: `POST /v2/auth/link`

A resposta da Unipile é `401 api/invalid_credentials — "Invalid API Key"`, gerada
no gateway da própria Unipile (`req_id: req-gw`), antes de qualquer validação de
parâmetros. Ou seja: a requisição está bem formada, mas a chave enviada não é
aceita pela API v2.

A chave `UNIPILE_API_KEY` existe no projeto, porém, como a integração foi
migrada de v1 para v2, a causa mais provável é que o valor salvo ainda seja o
Access Token da v1 (chave atrelada ao DSN `apiX.unipile.com`, usada em
`/api/v1`), que a v2 rejeita. Outras causas possíveis com o mesmo sintoma:
chave expirada (as chaves v2 têm data de expiração) ou chave pertencente a
outra Application que não a da conta alvo.

Não é possível confirmar qual dos casos é o correto sem testar uma chave nova —
o valor do secret não é legível.

## O que fazer

### 1. Substituir a chave (ação sua, no painel da Unipile)

No dashboard da Unipile, aba **API Keys**, criar uma nova chave da **v2**
(Application scoped, com data de expiração), e salvá-la no projeto substituindo
`UNIPILE_API_KEY`. Vou abrir o formulário seguro para você colar o valor.

### 2. Validação automática da chave (implementação)

Adicionar uma verificação leve, server-side, que chama `GET /v2/accounts` e
classifica o resultado:

- 200 → chave válida
- 401 → chave inválida/expirada/da v1
- outro → erro do provedor

Expor isso como server function e usar em dois lugares:

- Botão **Testar credenciais** na tela `/settings/integrations/linkedin`,
  mostrando estado claro (válida / inválida / não configurada).
- Antes de gerar o hosted auth link, para que a mensagem de erro seja
  compreensível em vez do JSON cru do provedor.

### 3. Melhorar a mensagem de erro

Hoje a tela mostra o corpo bruto da resposta. Trocar por mensagens em pt-BR
mapeadas por tipo de erro:

- `api/invalid_credentials` → "Chave da API Unipile inválida ou expirada.
  Gere uma nova chave (v2) e atualize nas configurações."
- `missing_credentials` → "Integração Unipile não configurada."
- demais → mensagem genérica + detalhe técnico recolhível.

Manter o `last_error` gravado em `unipile_accounts` para diagnóstico, sem
registrar a chave em log.

## Detalhes técnicos

- `src/lib/unipile/client.server.ts`: nova função `verifyApiKey()` usando
  `getEnv()` e `GET ${baseUrl}/accounts?limit=1`; sem throttle (não é chamada de
  provedor social). Reaproveitar `UnipileError` com o código já existente.
- `src/lib/unipile/accounts.functions.ts`: nova server function
  `checkUnipileCredentials` com `requireSupabaseAuth`, import dinâmico do
  `*.server`, retornando `{ ok, status, reason }` — nunca a chave.
- Tela `/settings/integrations/linkedin`: botão secundário "Testar credenciais"
  - bloco de estado usando os componentes oficiais do design system, com
    loading/erro. Sem alteração de RLS, schema ou lógica de negócio.
- Nenhuma migration.

## Riscos e pendências

- Se a chave nova (v2) também retornar 401, o bloqueio é do lado da Unipile
  (Application/conta), e o próximo passo é o suporte deles — a implementação
  acima serve exatamente para deixar isso evidente em 1 clique.
