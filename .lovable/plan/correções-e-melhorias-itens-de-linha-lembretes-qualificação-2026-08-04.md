# Correções e melhorias: itens de linha, lembretes, qualificação, arquivos e assinatura de e-mail

## 1) Erro de RLS ao incluir itens de linha em /deals

Causa confirmada: o editor de itens grava `owner_id` com o dono do negócio (`deal.owner_id`) e **não envia** `workspace_id`. Se o negócio pertence a outro usuário, nenhuma das políticas de inserção permite a gravação (uma exige `owner_id = usuário atual`, a outra exige `workspace_id` do usuário com permissão de atualizar negócios).

Correção (sem alterar RLS nem schema):

- `deal_line_items` passa a ser gravado com `owner_id` = usuário autenticado e `workspace_id` = workspace do negócio, em criação a partir de produto, criação em branco e duplicação.
- Mesma verificação nos demais pontos que gravam itens (assistente de cotação), garantindo `workspace_id` presente.
- Mensagem de erro amigável em pt-BR quando o usuário realmente não tem permissão de atualizar o negócio.

## 2) Lembretes de tarefas e atividades futuras

Tarefas/atividades já possuem `due_date`, e o sistema já tem tabela de notificações, preferências por categoria (categoria "Tarefas") e vários jobs de cron. Proposta:

- Novo campo de lembrete na atividade/tarefa: "Lembrar-me" com opções (na hora, 5, 15, 30 min, 1 h, 1 dia antes) e um marcador de lembrete já enviado.
- Novo tick de cron (a cada 5 minutos) que busca tarefas/atividades não concluídas cujo horário de lembrete chegou e dispara notificação para o responsável, respeitando as preferências existentes (no app, e-mail, som).
- No app: notificação no sino + toast quando a aba está aberta.
- Painel "Agora e a seguir" na tela de tarefas com o que vence hoje/atrasado, para reforço visual.
- Opcional (segunda etapa, se aprovado): notificação do navegador (Web Push) para lembrar mesmo com a aba em segundo plano.

## 3) Contato não criado ao qualificar o lead

O diálogo "Criar negócio" já cria/reutiliza contato e grava `primary_contact_id`, porém **não** registra a associação em `deal_contacts` — por isso o contato não aparece na aba de contatos do negócio nem nas associações.

Correção:

- Ao criar o negócio, além de `primary_contact_id`, gravar a associação do contato no negócio.
- Vincular também a empresa resolvida ao lead quando o lead ainda não tiver empresa.
- Se a criação do contato falhar, exibir o motivo real em pt-BR em vez de seguir sem contato.

## 4) Centro de arquivos disponível em todo upload

Criar um seletor reutilizável "Escolher do centro de arquivos" (navegação por pastas, busca, pré-visualização e seleção múltipla), ao lado do upload local existente.

Aplicar nas telas que já enviam arquivos: e-mail (anexos), WhatsApp, timeline de atividades, documentos de pessoas, importação de contratos e chamados. Uploads locais continuam funcionando como hoje; nada é removido.

## 5) Assinatura de e-mail com editor WYSIWYG/HTML

- Nova seção "Assinatura" em Configurações > E-mail, por conta conectada, com editor rich text (mesmo editor já usado no sistema) e alternância para edição de HTML puro, com pré-visualização.
- A assinatura é anexada automaticamente ao compor e-mails, com opção de desativar no envio.
- Requer migração de banco para armazenar a assinatura por conta de e-mail (com regras de acesso restritas ao dono da conta).

## Detalhes técnicos

- `src/components/deals/deal-line-items.tsx`, `src/components/deals/quote-wizard.tsx`: payload com `owner_id` do usuário atual e `workspace_id` do negócio.
- `src/components/leads/create-deal-from-lead-dialog.tsx`: inserir em `deal_contacts` e propagar empresa.
- Lembretes: colunas `remind_before_minutes` e `reminder_sent_at` em `activities`; `src/lib/activity-reminders.server.ts` + rota `src/routes/api/public/hooks/activity-reminders-tick.ts` protegida por `CRON_SECRET`; agendamento a cada 5 min; reutiliza `notifications` e as preferências existentes.
- Arquivos: `src/components/files/file-center-picker.tsx` usando as server functions já existentes de `src/lib/files.functions.ts`; adaptadores para copiar/vincular o arquivo escolhido ao destino (anexo de e-mail, documento de pessoa, etc.).
- Assinatura: coluna `signature_html` em `email_accounts` + server functions de leitura/gravação; aplicada em `src/components/email/send-email-dialog.tsx` e no envio server-side.
- Tudo em pt-BR, usando design system, com estados de carregamento/vazio/erro e validações de permissão no servidor.
