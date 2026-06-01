## Objetivo

Criar um botão flutuante "stay-on-top" (sempre visível em qualquer página do app autenticado) que permite ao usuário abrir um chamado interno descrevendo um problema ou solicitando uma nova funcionalidade, com gravação opcional de tela + áudio.

Isso é separado da tabela `tickets` existente (que é de suporte a clientes do CRM). Será uma nova tabela `bug_reports` para feedback interno do produto.

## UX

**Botão flutuante**
- Posição fixa: canto inferior direito, `z-50`, ícone de "bug" / "balão de fala".
- Visível em todas as rotas dentro de `_authenticated` (montado no layout `_authenticated.tsx`).
- Arrastável é fora de escopo nesta primeira versão — apenas fixo no canto.

**Dialog do chamado** (ao clicar no botão)

Campos:
1. **Tipo** (Select obrigatório):
   - "Nova funcionalidade"
   - "Funcionalidade existente com problema"
2. **Categoria do problema** (Select obrigatório) — combo principal, ex.: Negócios, Contatos, Empresas, Calendário, E-mail, WhatsApp, Workflows, Configurações, Outro.
3. **Subtipo** (Select obrigatório) — dependente da categoria, ex.: para "Negócios" → Listagem, Detalhe, Pipeline/Quadro, Criação, etc. Lista mantida em `src/lib/bug-report-taxonomy.ts` (fácil de editar).
4. **Descrição** (Textarea, max 4000 chars, obrigatório).
5. **Gravação de tela** (opcional):
   - Botão "Iniciar gravação" → usa `navigator.mediaDevices.getDisplayMedia({ video: true })`.
   - Toggle "Incluir minha voz" → quando ligado, também chama `getUserMedia({ audio: true })` e mistura no `MediaRecorder`.
   - Limite duro de 2 minutos (auto-stop) para evitar arquivos enormes.
   - Botão "Parar". Exibe preview `<video controls>` do blob gravado, com opção de descartar e regravar.
6. **Enviar** → faz upload do vídeo (se houver) para Storage, depois insere a linha em `bug_reports`.

Validação com Zod (`type`, `category`, `subtype` obrigatórios; `description` 10–4000 chars).

## Backend (migration)

**Tabela `public.bug_reports`**
- `id uuid pk`
- `owner_id uuid not null` (auth.uid())
- `kind text not null check in ('new_feature','existing_broken')`
- `category text not null`
- `subtype text not null`
- `description text not null`
- `recording_path text` (caminho no bucket)
- `recording_has_audio boolean default false`
- `page_url text` (capturada no client com `window.location.href`)
- `user_agent text`
- `status text default 'open'` (open/triaged/resolved — base para futuro painel)
- `created_at`, `updated_at`

**GRANTs + RLS**
- `GRANT SELECT, INSERT, UPDATE ON public.bug_reports TO authenticated;`
- `GRANT ALL TO service_role;`
- RLS: usuário pode `INSERT`/`SELECT`/`UPDATE` apenas onde `owner_id = auth.uid()`. (Painel de admin/triagem fica para depois.)

**Storage bucket `bug-reports`** (privado)
- Policies em `storage.objects`: usuário autenticado pode inserir/ler arquivos no prefixo `${auth.uid()}/...`.
- Upload do client com path `${user.id}/${reportId}.webm`.

## Frontend — arquivos novos

- `src/lib/bug-report-taxonomy.ts` — array `{ category, label, subtypes: [{value,label}] }`.
- `src/components/bug-report/bug-report-button.tsx` — botão flutuante (FAB).
- `src/components/bug-report/bug-report-dialog.tsx` — Dialog (shadcn) com formulário e estado de gravação.
- `src/components/bug-report/use-screen-recorder.ts` — hook encapsulando `getDisplayMedia` + `MediaRecorder` + mix de áudio, retornando `{ status, start, stop, blob, reset, error }`.

## Frontend — arquivos editados

- `src/routes/_authenticated.tsx` — montar `<BugReportButton />` no final do layout, fora do `<Outlet />`, para aparecer em todas as páginas autenticadas.
- `src/integrations/supabase/types.ts` — regenerado automaticamente após a migration.

## Detalhes técnicos

- Gravação usa MIME `video/webm;codecs=vp9,opus` com fallback para `video/webm`.
- Quando "incluir voz" está ligado, usar `AudioContext` para mesclar o áudio do desktop (se vier do `getDisplayMedia`) com o microfone num único `MediaStreamTrack`.
- O preview e o upload usam o `Blob` resultante do `MediaRecorder`; sem servidor intermediário.
- Captura `window.location.href` e `navigator.userAgent` no momento do envio para ajudar triagem.

## Fora de escopo (esta entrega)

- Tela de admin para listar/triar bug_reports (pode ser próximo passo).
- Anexar múltiplos arquivos / capturas estáticas — só vídeo + texto.
- Arrastar o botão flutuante / mudar posição via UI.
- Notificação por e-mail aos administradores quando um report é criado.
