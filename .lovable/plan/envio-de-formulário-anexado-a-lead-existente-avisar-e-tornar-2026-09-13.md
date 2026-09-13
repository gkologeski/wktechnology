# Envio de formulário anexado a lead existente: avisar e tornar visível

## O que aconteceu (verificado)

O envio de agora (02:09, "Teste Xispito", telefone 48991104003, e-mail
gkologeski@hotmail.com) **não criou** um lead novo: por ter o mesmo telefone/e-mail,
ele foi anexado ao lead que já existia — **Guilherme Kologeski**, criado em 20/08.

Esse lead já está com a etapa **qualificado**. A lista de Leads abre por padrão na
visão "Abertos", que esconde qualificados e desqualificados — por isso ele não
apareceu em nenhum lugar visível.

O envio ficou registrado: a submissão está gravada e há uma nota na linha do tempo
do lead ("Formulário enviado: contato-site", 02:09). Nada foi perdido, apenas ficou
invisível na lista.

## O que muda

Mantém-se a regra de não duplicar lead. O que passa a existir:

1. **Aviso para o responsável.** Quando um envio público é anexado a um lead que já
   existe, o responsável pelo lead recebe uma notificação ("Novo envio de formulário
   no lead X") com link direto para o lead.
2. **O lead volta a aparecer como novidade.** A lista de Leads ganha uma visão
   "Novos envios" que mostra os leads com envio de formulário nos últimos 30 dias,
   independentemente da etapa (inclui qualificados). A data do último envio aparece
   como coluna e é ordenável.
3. **Contador de ocultos.** Na visão "Abertos" (que continua escondendo qualificados
   e desqualificados, como você pediu), aparece um aviso discreto do tipo
   "12 leads ocultos nesta visão" com um clique para ver todos — assim ninguém mais
   procura um lead que existe mas está filtrado.
4. **Nome divergente não é descartado em silêncio.** Se o envio traz um nome
   diferente do lead existente, a nota da linha do tempo passa a destacar isso
   ("Nome informado no envio: Teste Xispito"), sem sobrescrever o cadastro.

O visitante continua vendo a mensagem de sucesso normal, sem erro técnico.

## Detalhes técnicos

- Migration aditiva: `leads.last_form_submission_at timestamptz null` + índice
  parcial para ordenação. Sem alterar RLS, permissões ou regra de duplicidade.
- `src/routes/api/public/forms/$slug.submit.ts`: no caminho de reuso, atualizar
  `last_form_submission_at`, inserir notificação em `notifications` para
  `leads.assigned_to` (fallback `owner_id`) e enriquecer o corpo da nota com o nome
  informado quando divergente. Falha de notificação apenas registra log, nunca
  quebra o envio.
- `src/routes/_authenticated/leads.tsx`: nova visão `recent-submissions`
  (`gte("last_form_submission_at", now-30d)`, sem o filtro de etapa), coluna "Último
  envio" no catálogo de colunas e contagem de registros ocultos na visão "Abertos"
  (mesma query com `head: true`).
- Backfill no mesmo passo: preencher `last_form_submission_at` a partir do máximo de
  `form_submissions.created_at` por `lead_id`.
- Estados de loading/empty/error, tokens semânticos e labels acessíveis conforme o
  design system; datas em pt-BR com o formato compacto já usado nos grids.
- Validações previstas: `bun run typecheck`, `bun run lint`, `bun run test`.

## Como validar

1. Reenviar o formulário público com o telefone 48991104003: mensagem de sucesso,
   sem erro.
2. Em Leads, abrir a visão "Novos envios": o lead Guilherme Kologeski aparece com a
   data do envio de hoje.
3. Conferir a notificação do responsável e a nota na linha do tempo do lead.
4. Na visão "Abertos", conferir o aviso de leads ocultos e o atalho para ver todos.
