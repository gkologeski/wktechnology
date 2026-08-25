# Levantamento das variáveis (tokens) sem relação com o campo/contexto

Verifiquei, no código, cada tela que oferece "pills" de variáveis e comparei com o que o backend realmente substitui na hora de executar. Há três problemas distintos: (a) listas fixas que não têm relação com a entidade do fluxo, (b) variáveis oferecidas na tela que nenhum motor substitui, e (c) variáveis oferecidas em campos que não aceitam texto (campos de referência/ID).

## Levantamento (situação atual confirmada)

| Onde                                                                                                               | Variáveis oferecidas na tela                                                                                                            | O que o backend realmente resolve                                                                                  | Situação                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflows — todos os campos de texto (`token-input.tsx`, condições, `set_field`, switch, `extra-fields-editor`)    | Lista fixa `WORKFLOW_TOKENS`: Nome, Sobrenome, Nome completo, E-mail, Empresa, Título                                                   | `engine.server.ts` resolve `{{coluna}}` da própria entidade do gatilho, além de `{{vars.X}}` e `{{steps.N.campo}}` | Sem relação com o gatilho. Em Negócios não existe `first_name`; em Empresas não existe `company` (é `name`). Resolve para vazio. E `{{vars.*}}`/`{{steps.*}}`, que funcionam, não aparecem em nenhuma pill |
| Workflows — campos de referência (ex.: "Empresa contratante (CNPJ)", "Negócio", "Contrato principal")              | Mesmas pills de texto                                                                                                                   | Campo espera um UUID                                                                                               | Variáveis oferecidas são inválidas para o campo; só fariam sentido tokens de ID (`{{company_id}}`, `{{id}}`, `{{steps.N.id}}`)                                                                             |
| E-mails de etapa do ATS (`(ats)/stage-emails.tsx`)                                                                 | `{{candidate.first_name}}`, `{{candidate.full_name}}`, `{{candidate.email}}`, `{{job.title}}`, `{{job.department}}`, `{{company.name}}` | `ats/email-engine.server.ts` só substitui `{{candidate_name}}`, `{{job_title}}`, `{{stage}}`                       | Nenhuma das variáveis exibidas é substituída; sai literal no e-mail do candidato                                                                                                                           |
| Sequências de sourcing ATS (`sourcing/sequences_.$id.tsx`)                                                         | Mesmas variáveis de candidato/vaga + `LINKEDIN_TOKENS` (`{{headline}}`)                                                                 | Worker de sequências envia o corpo sem substituição de variáveis                                                   | Sai literal                                                                                                                                                                                                |
| Envio de e-mail nas entidades (`email/send-email-dialog.tsx`) e Modelos de e-mail (`settings.email-templates.tsx`) | `EMAIL_TOKENS`: contato + `{{agent.name}}`, `{{agent.email}}`                                                                           | `email-send.functions.ts` / `email-send.server.ts` não fazem substituição alguma                                   | Sai literal. Além disso `src/lib/email-tokens.ts` (`renderTokens`) existe mas não é usado em nenhum lugar, e sua regex `[a-z_]+` nem aceitaria `agent.name`                                                |
| Campanhas de e-mail (`campaigns.email.tsx`)                                                                        | `EMAIL_TOKENS` (inclui `{{agent.*}}`, `{{first_name}}`, `{{company}}`)                                                                  | `email-broadcast/engine.server.ts` substitui apenas `{{name}}` e as chaves gravadas em `recipient.variables`       | Parcial: `{{name}}` funciona mas não é oferecido; o resto normalmente resolve para vazio                                                                                                                   |
| Sequências de vendas (`sequences/sequence-builder.tsx`)                                                            | `SEQUENCE_TOKENS` (contato + remetente)                                                                                                 | `sequences/engine.server.ts` repassa assunto/corpo sem substituir                                                  | Sai literal                                                                                                                                                                                                |
| WhatsApp (`whatsapp/send-whatsapp-dialog.tsx`)                                                                     | `WHATSAPP_TOKENS` nomeados (`{{first_name}}`…)                                                                                          | Templates do WhatsApp usam variáveis posicionais `{{1}}`, `{{2}}` (a própria tela mostra "Variável {{1}}")         | Conflito: pills nomeadas não têm relação com o formato aceito                                                                                                                                              |
| Macros de atendimento (`settings.macros.tsx`)                                                                      | `MACRO_TOKENS` (`{{contact_first_name}}`, `{{ticket_subject}}`, `{{agent_name}}`)                                                       | Nenhum código aplica macro substituindo variáveis                                                                  | Sai literal                                                                                                                                                                                                |
| Templates de hunting LinkedIn (`(ats)/hunting/templates.tsx`)                                                      | `HUNTING_TOKENS` (`{{primeiro_nome}}` etc.)                                                                                             | `ats/hunting.functions.ts` e `hunting-public.server.ts` montam essas chaves                                        | OK — único caso coerente hoje                                                                                                                                                                              |

## Plano de correção proposto

Fase 1 — Workflows (maior impacto e onde o problema foi reportado)

- Gerar as pills a partir do catálogo real de campos da entidade do gatilho (`getEntityFieldCatalog`), em vez da lista fixa `WORKFLOW_TOKENS`: cada pill = rótulo PT-BR + `{{coluna}}` existente.
- Acrescentar grupos "Passos anteriores" (`{{steps.N.campo}}`) e "Variáveis do fluxo" (`{{vars.X}}`), que já funcionam no motor.
- Em campos de referência (empresa, negócio, contrato, usuário, contato), oferecer somente tokens que resultam em ID, e nunca tokens de texto.
- Manter `WORKFLOW_TOKENS` apenas como fallback quando o catálogo não estiver carregado.

Fase 2 — Alinhar telas x motores de mensagem

- E-mails de etapa e sequências do ATS: passar a suportar no motor as variáveis já anunciadas na tela (`candidate.*`, `job.*`, `company.name`), mantendo as antigas (`candidate_name`, `job_title`, `stage`) como sinônimos para não quebrar templates existentes.
- Envio de e-mail nas entidades, modelos de e-mail, campanhas e sequências de vendas: aplicar a substituição no envio (contato + remetente), reaproveitando um renderizador único que aceite chaves com ponto.
- Macros: aplicar substituição no momento em que a macro é inserida na resposta do ticket.
- Campanhas: incluir `{{name}}` nas pills, já que é o que o motor resolve.

Fase 3 — WhatsApp

- Trocar as pills nomeadas por variáveis posicionais coerentes com o template selecionado (`{{1}}`, `{{2}}`…), com rótulo indicando a que campo cada posição se refere.

Fase 4 — Higiene

- Centralizar a substituição em um único módulo, remover/reaproveitar `src/lib/email-tokens.ts` (hoje órfão) e cobrir com testes unitários por superfície (workflow, e-mail, ATS, macro).

## Detalhes técnicos

- Motor de workflow: `renderTokens` em `src/lib/workflows/engine.server.ts` (linha 71) resolve `{{path}}` com `getField(after, path)`, `vars.` e `steps.`. As pills vêm de `WORKFLOW_TOKENS` em `src/lib/message-tokens-catalog.ts` via `src/components/workflows/token-input.tsx`.
- Catálogo de campos por entidade já existe (`getEntityFieldCatalog` em `src/lib/entity-fields.functions.ts`), incluindo rótulos PT-BR e `REF_COLUMNS` (`src/lib/entity-fields-refs.ts`) para identificar campos de ID.
- ATS: `renderTemplate` em `src/lib/ats/email-engine.server.ts` (~linha 219) recebe `{ candidate_name, job_title, stage }`.
- Campanhas: `renderTemplate` em `src/lib/email-broadcast/engine.server.ts` (linha 35) com `vars = { ...recipient.variables, name }`.
- Nenhuma alteração de schema, RLS, permissões ou regra de negócio é necessária.

## Validação

- `bunx tsgo --noEmit`, `bunx eslint` nos arquivos alterados, `bunx vitest run`.
- Manual: em `/settings/workflows`, gatilho em Negócios → pills devem listar campos reais de negócio; campo "Empresa contratante" → apenas tokens de ID; e-mail de etapa do ATS com `{{candidate.full_name}}` → nome resolvido no envio.

## Escopo

Confirme se você quer (1) apenas o levantamento acima, (2) somente a Fase 1 (workflows), ou (3) todas as fases.
