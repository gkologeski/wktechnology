# Enriquecimento automático do lead no cadastro (LinkedIn)

## Verificação do caso Laerte Junior

Consultei o registro no banco. O lead foi criado em 28/08/2026 11:49 UTC com:

- `linkedin_url`: https://www.linkedin.com/in/laertejrmkt (normalizado corretamente)
- `email`, `phone`, `mobile_phone`, `company_name`, `company_id`: todos vazios
- `status`: `new`

Não existe nenhum registro em `apollo_phone_reveals` nem em `enrichment_jobs` para este lead (os últimos registros são de outros leads/contatos, de 28/08 01:27 e 14/06).

Conclusão: **não houve enriquecimento**. Isso não é uma falha — hoje a cascata Apollo só é disparada quando o modal de qualificação é aberto (`qualification-enrichment` é chamado a partir do painel de qualificação). Ao apenas cadastrar o lead, nada é chamado.

## O que propor

Disparar o enriquecimento já no cadastro quando houver um LinkedIn (ou domínio de empresa) válido, sem esperar a qualificação.

1. Após criar/atualizar um lead com `linkedin_url` válido, chamar a cascata de enriquecimento existente em modo "sugestão + aplicação de campos vazios" (nunca sobrescrever o que o usuário digitou).
2. Reaproveitar integralmente o motor atual (mesma ordem de sinais: LinkedIn > e-mail > nome+domínio) e o ciclo assíncrono de revelação de telefone já implementado.
3. Registrar o resultado na timeline do lead e manter o badge de procedência do dado.
4. Estado visível na tela do lead: "enriquecendo", "enriquecido", "sem correspondência", "telefone em revelação".
5. Rodar o enriquecimento também para o Laerte Junior após a implementação, para validar ponta a ponta.

## Detalhes técnicos

- Ponto de disparo: server function de criação de lead, chamando o enriquecimento de forma não bloqueante (o cadastro não deve falhar se a Apollo falhar).
- Reuso: `src/lib/prospecting/qualification-enrichment.server.ts`, `src/lib/integrations/apollo-enrich.server.ts`, `src/lib/prospecting/linkedin-url.ts`.
- Sem mudança de schema; `apollo_phone_reveals` já cobre a revelação assíncrona.
- Aplicação apenas em campos nulos/vazios do lead e da empresa vinculada, com log de auditoria.
- Validações: `tsgo` e `vitest`.
