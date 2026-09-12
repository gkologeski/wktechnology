# Formulário público não deve mostrar erro de lead duplicado

## Resposta curta

Não, não é assim que deveria funcionar. A regra de "não duplicar lead" existe para o uso
interno do sistema. Num formulário público (site, landing page, WhatsApp), quem preenche é
um visitante: ele não deve ver uma mensagem interna sobre workspace, e o envio dele não
pode ser perdido.

## O que acontece hoje (verificado)

O envio do formulário público grava o lead direto. Quando o telefone (ou e-mail) já existe,
a regra de duplicidade do banco recusa a gravação e a mensagem técnica dela
("Já existe um lead com o telefone ... neste workspace.") é exibida na tela do visitante.
Resultado: o visitante vê um erro em vermelho e o contato dele não é registrado em nenhum
lugar.

## Como passa a funcionar

1. Antes de gravar, o envio procura um lead existente no mesmo workspace pelo telefone ou
   e-mail informado.
2. Se já existir, **nenhum lead novo é criado**: o envio é anexado ao lead existente —
   registro do envio, nota na linha do tempo com todos os campos preenchidos e vínculo com
   empresa/contato. Campos que estavam vazios no lead (empresa, sobrenome, e-mail ou
   telefone que faltavam) são completados; nada que já existe é sobrescrito.
3. O visitante vê a **mensagem de sucesso normal** do formulário (ou o redirecionamento
   configurado), como em qualquer envio.
4. Se ainda assim a gravação falhar por qualquer motivo, o visitante vê uma mensagem
   genérica e amigável ("Não foi possível enviar agora, tente novamente"), nunca o texto
   interno do banco. O erro real fica no log para a equipe.
5. Internamente nada muda: no cadastro manual de lead o bloqueio de duplicidade continua
   igual, com a mensagem clara e o botão para abrir o lead existente.

Assim a equipe enxerga que aquela pessoa voltou a se interessar (novo envio na timeline do
lead que já existia), em vez de perder o contato.

## Detalhes técnicos

- `src/routes/api/public/forms/$slug.submit.ts`: antes do insert em `leads`, usar
  `checkLeadDuplicate` (`src/lib/leads/lead-duplicate-check.ts`) com o `workspace_id` do
  formulário; quando `duplicate`, reutilizar `existingId` como `leadId` e seguir o fluxo
  (form_submissions + activity + `ensureLeadRelationsSafe`), sem insert.
- Completar campos vazios do lead existente com `update` restrito a colunas nulas/vazias.
- Envolver o insert restante em tratamento de erro que registra `console.error` e responde
  com mensagem genérica em PT-BR, sem repassar `error.message` do banco.
- Mesmo tratamento no fluxo de contato (`target !== "lead"`): reaproveitar contato por
  e-mail/telefone em vez de falhar.
- `src/routes/api/public/forms/embed-js.ts`: manter a exibição de `error`, que passa a
  receber apenas mensagens amigáveis.
- Sem alteração de schema, RLS, permissões, trigger de duplicidade ou do fluxo interno.

## Como validar

1. Reenviar o formulário público com o telefone `48991104003`: aparece a mensagem de
   sucesso, sem erro vermelho.
2. Abrir o lead já existente: novo envio registrado na linha do tempo com os campos.
3. Enviar com telefone/e-mail novos: lead criado normalmente.
4. Criar lead duplicado pela tela interna: continua bloqueado com a mensagem atual.
5. `bun run typecheck`, `bun run lint`, `bun run test`.
