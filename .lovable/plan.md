# Sequência de enriquecimento Apollo (Lead → Empresa → Contato)

## O que a documentação da Apollo define

- `POST /api/v1/people/match` — enriquece **uma pessoa já identificada**. Aceita `id` (Apollo person id), `email`, `hashed_email`, `linkedin_url`, `name`/`first_name`+`last_name`, `organization_name`, `domain`. Custo 1 crédito (demográfico/e-mail), +8 se devolver celular, 0 se nada for encontrado. Nome sem domínio/e-mail costuma retornar 200 sem match.
- `GET /api/v1/organizations/enrich` — enriquece empresa **por domínio** (ou site/LinkedIn da empresa). 1 crédito. Não retorna pessoas. Nome de empresa não é aceito.
- `POST /api/v1/mixed_companies/search` — busca empresa por nome. **1 crédito por página**.
- `POST /api/v1/mixed_people/search` — busca de pessoas net-new. 0 créditos, mas **não devolve e-mail nem telefone**; serve apenas para descobrir candidatos/`person_id` antes de um match.
- `reveal_personal_emails` (default false) e `reveal_phone_number` (default false, **exige `webhook_url`**; o número chega depois, de forma assíncrona). O mesmo vale para `run_waterfall_email` / `run_waterfall_phone`.
- Rate limits são por time e por endpoint, em três janelas (minuto/hora/dia), com headers `x-*-requests-left` e `retry-after`.

## Sequência correta a partir do cadastro do lead

1. **Resolver o domínio da empresa sem gastar crédito**: `companies.domain`/`website` do lead → domínio do e-mail corporativo (descartando gmail/hotmail e afins).
2. **Se ainda não houver domínio**: `mixed_companies/search` pelo nome da empresa (1 crédito/página) — último recurso.
3. **Enriquecer a Empresa**: `organizations/enrich?domain=...` (1 crédito). Preenche setor, tamanho, receita, telefone, endereço, LinkedIn da empresa e devolve um domínio canônico melhor para o passo seguinte.
4. **Enriquecer a Pessoa (Lead/Contato)**: `people/match` com o sinal mais forte disponível, nesta ordem:
   `id` da Apollo (quando já enriquecemos antes) → `linkedin_url` → e-mail corporativo → `first_name`+`last_name`+`domain` → `first_name`+`last_name`+`organization_name`.
   Sem nenhum desses, **não chamar** o match (evita crédito em consulta sem chance).
5. **Telefone/celular**: enviar `reveal_phone_number: true` + `webhook_url` (com segredo) apenas quando o webhook estiver configurado; gravar uma revelação pendente e completar o número quando a Apollo entregar.
6. **Aplicar os dados**: Lead (nome, e-mail, telefone, celular, empresa, LinkedIn) → Empresa (domínio, site, setor, tamanho, telefone, endereço, LinkedIn) → Contato (cargo, LinkedIn, Twitter, endereço), gravando **somente campos vazios**.
7. **Cache**: guardar o resultado (30 dias) com os sinais usados; invalidar quando LinkedIn, e-mail, domínio ou nome da empresa mudarem.

## Como o código está hoje

`runApolloCascade` (`src/lib/integrations/apollo-enrich.server.ts`) já segue os passos 1→5 na ordem correta: domínio → empresa → pessoa, com prioridade LinkedIn > e-mail > nome+domínio, `reveal_personal_emails` sempre e `reveal_phone_number` condicionado ao webhook. Divergências encontradas:

- O `personId` da Apollo é retornado e guardado, mas **nunca reutilizado** como sinal `id` em novas consultas (seria o sinal mais preciso e barato).
- O cache de qualificação (`qualification-enrichment.functions.ts`) só invalida quando o **LinkedIn** muda; alterar site/domínio/nome da empresa continua servindo sugestões antigas.
- `src/lib/integrations/apollo.functions.ts` (`enrichWithApollo`, enriquecimento em lote) é um caminho paralelo antigo: só usa `email` ou nome+empresa, **ignora LinkedIn e domínio**, não enriquece empresa e não revela e-mail pessoal/telefone.
- `apolloFindDomainByName` envia os filtros duplicados em querystring e body (redundância inofensiva, mas confusa).
- Waterfall (`run_waterfall_email`/`run_waterfall_phone`) não é usado — decisão de escopo/custo, não um defeito.

## Ajustes propostos (opcionais, se você aprovar)

1. Reutilizar `id` da Apollo como sinal de maior prioridade no `people/match` quando já existir de um enriquecimento anterior.
2. Incluir domínio/site/nome da empresa na assinatura do cache de qualificação, para invalidar quando esses dados mudarem.
3. Alinhar o enriquecimento em lote (`enrichWithApollo`) à mesma cascata: usar LinkedIn e domínio como sinais, enriquecer a empresa e aplicar as mesmas regras de revelação/telefone.
4. Limpar a duplicação de filtros em `apolloFindDomainByName`.

Sem mudanças de RLS, schema ou regra de negócio. Validação: `bun run lint`, `bun run typecheck`, `bun run test`.

## Fora do escopo

Waterfall enrichment (vendors externos), busca net-new de pessoas na qualificação e alteração do questionário/score.
