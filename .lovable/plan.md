## Objetivo

No botão "+ Novo candidato" em `/candidates`, oferecer **três opções** no passo inicial (chooser):

1. **Preencher manualmente** — fluxo atual.
2. **Importar do LinkedIn** — via Unipile (`fetchProfile`), pré-preenche o formulário editável.
3. **Extrair de um CV (PDF)** — reaproveita o fluxo atual de Parse de CV que hoje vive num botão separado da toolbar.

Nada é persistido sem confirmação do usuário: LinkedIn e CV apenas pré-preenchem o formulário editável do modo Manual.

## Escopo

- Frontend: `src/routes/_authenticated/(ats)/candidates.index.tsx`.
- Nova server function `previewLinkedinProfile` (não persiste).
- Reaproveita `loadAccountCtx` + `fetchProfile` de `unipile-hunting.functions.ts`.
- Reaproveita o dialog/lógica atual de Parse de CV (o `parseOpen` / `handleParseCv` existentes) — apenas move o gatilho para dentro do chooser e remove o botão externo da toolbar.
- Sem migrations, sem mudanças de RLS.

Fora do escopo: bulk import, hunting, sequências, alterações no comportamento de extração da IA sobre o CV.

## Fluxo UX

Ao clicar em "+ Novo candidato", o dialog abre em modo **chooser** com três cards clicáveis (ícones `UserPlus`, `Linkedin`, `FileText`):

- **Manual** → formulário atual.
- **LinkedIn** → input de URL + "Buscar perfil".
  - Loading, erros tratados (Unipile não conectado → toast + CTA `/settings/integrations/linkedin`; perfil privado; rate limit).
  - Sucesso → transita para `manual` com `setForm(...)` pré-preenchido; badge "Importado do LinkedIn".
- **CV (PDF)** → mesmo conteúdo do dialog atual de Parse (upload, indicador "IA extrai…").
  - Sucesso → hoje o Parse já cria o candidato diretamente; **manteremos esse comportamento** (não regride o fluxo), apenas movendo o gatilho para dentro do chooser. Toast e navegação continuam iguais.

Ao fechar o dialog, resetar para `chooser`.

## Backend

`src/lib/ats/candidates-linkedin-preview.functions.ts` (novo):

- `previewLinkedinProfile` com `requireSupabaseAuth`, input `{ url: string }`.
- Normaliza URL, extrai `public_identifier` (`/in/([^/?#]+)`).
- `loadAccountCtx(userId)`; falha → `{ ok: false, code: "unipile_not_connected" }`.
- `fetchProfile(ctx, publicIdentifier)`; mapeia os mesmos campos já extraídos em `unipile-hunting.functions.ts` (headline, location, photo_url, contact_info email/phone, primeira experiência → current_company/current_position, skills, education, languages, experiences).
- Retorna DTO plano `{ ok: true, data: { full_name, headline, current_position, current_company, location, email, phone, linkedin_url, skills[], photo_url, notes_seed, raw_meta } }`.
- Erros do Unipile viram `{ ok: false, code, message }`.

Sem novas server functions para CV — mantém o `handleParseCv` atual.

## Frontend

`candidates.index.tsx`:

- Estado `createMode: "chooser" | "manual" | "linkedin" | "cv"` no dialog principal.
- Passo `chooser`: 3 cards no design system, com título, descrição curta e ícone.
- Passo `linkedin`: input de URL + botão "Buscar perfil" (disabled/loading), link "Voltar".
- Passo `cv`: reaproveita o conteúdo atual do dialog de Parse (input file, mensagens, botão "Extrair e salvar") — movido para dentro do chooser; remover o botão externo "Extrair CV" (`parseOpen` isolado) da toolbar.
- Passo `manual`: formulário atual + badge sutil "Importado do LinkedIn" quando aplicável.
- Reset de `createMode` e limpeza do file/URL ao fechar o dialog.

Validações e estados: URL regex `^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^\/?#]+\/?`; loading e erro inline em LinkedIn e CV; toasts padronizados via `sonner`.

## Riscos e pendências

- Perfis LinkedIn de 2º/3º grau podem não expor email/telefone (esperado).
- Requer Unipile conectado; sem isso, usuário é orientado a Integrations → LinkedIn.
- Parse de CV continua criando o candidato direto (comportamento atual); se quiser alinhar 100% com "preview antes de salvar", é um passo futuro fora deste escopo.

## Validação manual

1. Chooser exibe as três opções e navega corretamente entre elas / volta.
2. Manual continua funcionando exatamente como hoje.
3. LinkedIn: sem Unipile → toast + CTA; URL válida com Unipile → formulário preenchido e editável; URL inválida → botão desabilitado.
4. CV: upload de PDF cria candidato como hoje; botão externo removido; nenhum caminho antigo perdido.
5. Fechar e reabrir o dialog reseta o chooser.
