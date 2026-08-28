# Fontes de lead + procedência do enriquecimento

## Situação atual (verificada)

- Já existe cadastro de fontes: tabela `lead_sources` (13 registros no workspace + 2 órfãos sem `workspace_id`) e tela `/settings/lead-sources`, usada pelo `SourceCombobox` no cadastro de lead.
- Há fontes usadas em leads que **não estão** no catálogo: `prospecting` (124 leads), `form:contato-site-` (5), `Outros` (1), `Outsourcing` (1). O restante (`OFFLINE` com 5.582 leads, `DIRECT_TRAFFIC`, `EMAIL_MARKETING`, etc.) já existe, mas com rótulos crus do HubSpot.
- O enriquecimento já calcula `domainSource` (`website` | `email` | `company_search`) e `personSignal` (`linkedin` | `email` | `name_domain` | `none`), mas o painel só mostra "via LinkedIn" e o domínio — não mostra a origem do domínio nem a fonte por campo.
- `applied` já traz as colunas efetivamente gravadas por entidade (`leads`/`companies`/`contacts`), hoje só usado para o selo "gravado".
- `normalizeLinkedinUrl` já valida perfil pessoal, mas devolve **uma única mensagem genérica** para todos os casos de erro.
- `linkedin_url` só é editável no cadastro (`create-lead-dialog.tsx`) e na tela do lead; alterar depois não dispara nada.

## 1. Cadastro de fontes e carga das existentes

- Manter a tela `/settings/lead-sources` e melhorá-la: rótulo amigável (`label`) além do nome técnico, contagem de leads por fonte, filtro ativo/inativo, estados de loading/empty/error e edição inline do rótulo.
- Backfill (via SQL de dados, não migration): inserir no catálogo toda fonte distinta presente em `leads.source` que ainda não exista, no workspace correto, e corrigir os 2 registros sem `workspace_id`.
- Preencher rótulos PT-BR para os valores herdados do HubSpot (`OFFLINE` → "Offline", `DIRECT_TRAFFIC` → "Tráfego direto", `EMAIL_MARKETING` → "E-mail marketing", `ORGANIC_SEARCH` → "Busca orgânica", `PAID_SEARCH` → "Busca paga", `PAID_SOCIAL` → "Social paga", `OTHER_CAMPAIGNS` → "Outras campanhas"), mantendo o valor técnico intacto para não quebrar leads existentes.
- Exibir o rótulo (não o valor cru) no combobox de fonte, nos filtros e no grid de leads.

## 2. Painel de qualificação: campos preenchidos + fonte por campo

- Passar a expor, junto das sugestões, a procedência de cada campo (LinkedIn, e-mail corporativo, domínio/site da empresa, busca por nome).
- No painel, adicionar um bloco "Enriquecimento" listando, por entidade (Lead / Empresa / Contato), os campos preenchidos com o valor aplicado e um badge de fonte por campo.
- Diferenciar visualmente "gravado agora" (vem de `applied`) de "sugerido, campo já tinha valor".
- Cada campo do formulário que veio do enriquecimento recebe indicação de origem no rótulo/tooltip.

## 3. Validação e normalização do LinkedIn com mensagens específicas

Substituir a mensagem única por mensagens por caso:

- vazio → "Informe o link do LinkedIn."
- não é URL → "Link inválido. Cole o endereço completo do perfil."
- domínio diferente de linkedin.com → "Este link não é do LinkedIn."
- página de empresa (`/company/...`) → "Este é um link de empresa. Informe o perfil pessoal do contato."
- publicação, busca, vaga, grupo, `/pub/`, `/feed/` → mensagem específica indicando o tipo detectado.
- slug inválido (curto demais, só caracteres especiais) → "O endereço do perfil parece incompleto."

Aplicar em cadastro de lead, tela do lead e painel de qualificação, com `aria-invalid` e `role="alert"`. Ampliar `linkedin-url.test.ts` cobrindo cada caso.

## 4. Re-enriquecimento ao atualizar o `linkedin_url`

- Ao salvar um `linkedin_url` novo (diferente do atual, comparado por `sameLinkedinUrl`), disparar a cascata Apollo já existente com o LinkedIn como sinal primário.
- Aplicar em campos vazios do lead e propagar para a empresa vinculada e o contato convertido, respeitando as regras atuais (não sobrescrever o que o usuário digitou, `LEAD_KEYS`/`COMPANY_KEYS`/`CONTACT_KEYS`).
- Não bloquear o salvamento: falha da Apollo apenas registra aviso; toast informa o resultado ("N campos atualizados" / "nenhum dado novo").
- Registrar o evento na timeline do lead e manter o ciclo assíncrono de revelação de telefone (`apollo_phone_reveals`).

## 5. `domainSource` visível no painel

Traduzir e exibir ao lado do domínio, no selo Apollo e no bloco de enriquecimento:

- `website` → "domínio do site informado"
- `email` → "domínio do e-mail"
- `company_search` → "busca por nome da empresa"
- ausente → "domínio não identificado"

Quando o domínio vier do match de pessoa por LinkedIn, indicar "via LinkedIn".

## Detalhes técnicos

- Arquivos principais: `src/lib/prospecting/linkedin-url.ts` (+ testes), `src/lib/lead-sources.ts`, `src/routes/_authenticated/settings.lead-sources.tsx`, `src/components/leads/source-combobox.tsx`, `src/components/leads/create-lead-dialog.tsx`, `src/routes/_authenticated/leads.$id.tsx`, `src/components/prospecting/qualification-panel.tsx`, `src/lib/prospecting/qualification-enrichment.{server,functions}.ts`, `src/lib/integrations/apollo-enrich.server.ts`.
- Migration: adicionar `label` (texto, opcional) em `lead_sources` e índice único por workspace+nome, mantendo GRANT/RLS existentes. Carga das fontes existentes entra como operação de dados separada.
- Procedência por campo: estender o retorno do enriquecimento com um mapa `fieldSources` por entidade, derivado do sinal usado em cada etapa da cascata — sem chamadas extras à Apollo.
- UI apenas com tokens semânticos e componentes oficiais (`PageHeader`, `SectionHeader`, `StatusBadge`, `EmptyState`, skeletons).
- Validações: `bun run lint`, `tsgo`, `bun run test`.
