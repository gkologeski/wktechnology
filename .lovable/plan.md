# Contato na qualificação, lembretes por e-mail e Centro de Arquivos em todos os uploads

## 1) Contato ao qualificar o lead

O diálogo "Criar negócio" já cria/reutiliza o contato, grava `primary_contact_id` e insere em `deal_contacts`; a conversão por `lead-convert` também associa. O que falta é fechar as lacunas:

- Verificar o caminho de qualificação usado no painel de prospecção (`qualification-panel`) e garantir que ele passe pelo mesmo fluxo de criação/vínculo de contato.
- Quando o lead não tem nome, usar e-mail/telefone como identificação do contato, em vez de criar contato vazio.
- Se a criação do contato falhar, abortar com mensagem em pt-BR (hoje o negócio pode ser criado com contato ausente em alguns caminhos).
- Vincular também a empresa resolvida ao contato quando o contato existente não tiver empresa.
- Deduplicar: reaproveitar contato por e-mail e, na falta dele, por telefone (mesma workspace).

## 2) Lembretes de tarefas/atividades por e-mail

O motor de lembretes já existe e roda a cada 5 minutos, gerando notificação no app. Extensão:

- Enviar também e-mail no horário do lembrete (na hora ou X minutos antes), respeitando a preferência "Tarefas > E-mail" de cada usuário.
- Novo template de e-mail "Lembrete de atividade" em pt-BR: assunto, quando vence, tipo (tarefa, ligação, reunião), registro relacionado e botão para abrir no sistema.
- Idempotência: continuar usando o marcador de lembrete enviado; e-mail com chave de idempotência por atividade para não duplicar em reprocessamentos.
- Se o e-mail falhar, a notificação no app continua valendo e a falha fica registrada no log do job.

## 3) Lembretes para ligações e reuniões (mesmo motor)

- O motor já aceita qualquer tipo de atividade; hoje apenas as telas de tarefa expõem o campo de lembrete.
- Adicionar o seletor "Lembrar-me" (na hora, 5, 15, 30 min, 1 h, 2 h, 1 dia antes) nos formulários de atividade de ligação e reunião (criação e edição na timeline de atividades), reutilizando as mesmas opções já existentes.
- Título da notificação/e-mail adaptado ao tipo: "Lembrete de reunião", "Lembrete de ligação", "Lembrete de tarefa".

## 4) Centro de Arquivos em todos os campos de upload

O seletor do Centro de Arquivos já existe e está aplicado em anexos de e-mail. Aplicar o botão "Escolher do Centro de Arquivos" ao lado do upload local em:

- Documentos de pessoas
- Importação de contrato e de modelo de contrato
- Timeline de atividades
- WhatsApp e chat interno
- Currículo (ATS)
- Chamados internos

Os uploads locais continuam funcionando exatamente como hoje; nada é removido. Nos fluxos que exigem um único arquivo, o seletor abre em modo de seleção única.

## Detalhes técnicos

- `src/components/leads/create-deal-from-lead-dialog.tsx`, `src/lib/lead-convert.ts`, `src/components/prospecting/qualification-panel.tsx`: dedupe de contato por e-mail/telefone, propagação de empresa, erro real em pt-BR.
- `src/lib/activity-reminders.server.ts`: após inserir as notificações, resolver e-mail do responsável e chamar `sendTransactionalEmailFromServer` com o novo template; preferência `task.email !== false`.
- Novo `src/lib/email-templates/activity-reminder.tsx` + registro em `src/lib/email-templates/registry.ts`.
- Campo de lembrete: reutilizar `REMINDER_OPTIONS` de `src/lib/activity-reminders.ts` nos diálogos de atividade (`src/components/activity-timeline.tsx` e diálogos de criação de ligação/reunião).
- Centro de Arquivos: reutilizar `FileCenterPickerDialog` (`src/components/files/file-center-picker.tsx`) nos componentes de upload listados, passando `multiple` conforme o destino.
- Sem alteração de RLS, schema ou regras de negócio; apenas o template de e-mail e ajustes de UI/serviço.
