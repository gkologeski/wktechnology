# Pills de variáveis clicáveis em campos de mensagem

Hoje o sistema já suporta tokens `{{first_name}}`, `{{company}}`, etc. via `src/lib/email-tokens.ts` e `renderTokens`. Porém, o usuário precisa digitá-los manualmente. Em vários lugares há apenas um texto de "Dica" listando tokens disponíveis. Vamos padronizar com **pills clicáveis** que inserem o token no cursor.

## 1. Componente reutilizável

Criar `src/components/ui/token-pills.tsx`:

- Props: `tokens: { token: string; label: string; group?: string }[]`, `onInsert: (token: string) => void`, `label?: string` (default "Variáveis"), `className?`.
- Render: linha compacta com `MetaPill` (já existe em `src/components/techhire/ui/meta-pill.tsx`) clicável como `<button>` — hover destacado, `title` = token literal, texto = label amigável (ex.: "Nome").
- Agrupamento opcional (Contato / Empresa / Vendedor / Vaga) via separador sutil.
- Acessibilidade: `aria-label="Inserir {label}"`, foco visível.

Criar helper `src/lib/token-insert.ts`:

- `insertAtCursor(el: HTMLTextAreaElement | HTMLInputElement, text: string, setValue: (v: string) => void)`: insere no `selectionStart`, mantém foco, reposiciona cursor após o token inserido. Fallback: append.
- `useTokenInserter()`: hook que retorna `{ ref, insert }` para plugar em qualquer `<Textarea ref={ref} />` / `<Input>`.

## 2. Catálogo central de tokens

Criar `src/lib/message-tokens-catalog.ts` com presets por contexto:

- `EMAIL_TOKENS` — first_name, last_name, full_name, email, company, agent.name, agent.email.
- `WHATSAPP_TOKENS` — first_name, full_name, company.
- `LINKEDIN_TOKENS` — first_name, full_name, company, headline (se disponível no candidato).
- `ATS_CANDIDATE_TOKENS` — candidate.first_name, candidate.full_name, job.title, job.department, company.name.
- `SEQUENCE_TOKENS` — union de contato + agente.

Cada entrada: `{ token: "{{first_name}}", label: "Nome", group: "Contato" }`. Isso alinha os catálogos que hoje estão duplicados em `settings.email-templates.tsx`, `campaigns.email.tsx`, `settings.macros.tsx`, `workflow-builder.tsx`, `sequences_.$id.tsx`, `sequence-builder.tsx`.

## 3. Locais que recebem as pills

Escopo do rollout (varredura já feita nos dois módulos):

TechSales / CRM:
- `src/components/email/send-email-dialog.tsx` — corpo e assunto.
- `src/routes/_authenticated/campaigns.email.tsx` — subject e body do template (substitui o `<code>` estático atual).
- `src/routes/_authenticated/settings.email-templates.tsx` — subject e body.
- `src/routes/_authenticated/settings.macros.tsx` — body do macro.
- `src/components/whatsapp/send-whatsapp-dialog.tsx` — textarea "Mensagem" (livre; não aplica em HSM oficial).
- `src/components/whatsapp/whatsapp-templates-editor.tsx` — corpo do template.
- `src/components/sequences/sequence-builder.tsx` — corpo do passo.
- `src/components/workflows/workflow-builder.tsx` — campos `subject`/`body` de ações (remove a "Dica" atual).
- `src/components/bulk-create-activity-dialog.tsx` — assunto/descrição, se usarem tokens.

TechHire / ATS:
- `src/components/ats/send-linkedin-dialog.tsx` — textareas "Mensagem" e "Mensagem do convite".
- `src/routes/_authenticated/(ats)/sourcing/sequences_.$id.tsx` — body/subject dos steps (email, linkedin_invite, linkedin_message).
- `src/components/ats/create-offer-dialog.tsx` — se houver corpo de e-mail de oferta.
- `src/components/ats/schedule-interview-dialog.tsx` — mensagem ao candidato, se aplicável.

Não incluídos (têm token picker próprio já adequado):
- `src/components/quote-templates/template-editor.tsx` (usa `QUOTE_TEMPLATE_TOKENS`).
- Editor visual de proposals.

## 4. Padrão de integração

Em cada campo:

```tsx
<div className="space-y-2">
  <Label>Mensagem</Label>
  <Textarea ref={ref} value={body} onChange={...} />
  <TokenPills tokens={WHATSAPP_TOKENS} onInsert={insert} />
</div>
```

- Renderiza logo **abaixo** do textarea, tipografia sm, wrap responsivo.
- Não altera a lógica de envio nem `renderTokens` no backend.
- Mantém `placeholder` existente.

## 5. Revisão pós-implementação

- Typecheck + build.
- Verificar dark mode e foco visível nas pills.
- Confirmar que inserção posiciona cursor corretamente em `<Textarea>` e `<Input>`.
- Nenhuma alteração em RLS, schema, server functions ou lógica de negócio.

## Detalhes técnicos

- Reutiliza `MetaPill` para consistência visual TechHire; no CRM aplicamos o mesmo componente para uniformidade (é neutro).
- Como o `RichHtmlEditor` (contenteditable) não expõe `selectionStart`, para editores ricos usaremos `document.execCommand('insertText', false, token)` como fallback e, se falhar, `append`. Escopo inicial cobre apenas os `Textarea`/`Input` listados — editores ricos ficam como follow-up se necessário.
- Sem novas dependências.
