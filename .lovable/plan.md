# CONTROLES-LIGACAO — Lista de campanhas de ligação com os mesmos controles do WhatsApp

Porte: M. Estimativa: 2–3 horas (inclui testes, permissões e Ajuda). Nada será publicado sem seu pedido.

## O que muda na tela "Campanhas de Ligação"
Hoje cada campanha mostra só Iniciar/Pausar (ícone sem texto) e Excluir sem regras. Passará a ter, como no WhatsApp:

- **Editar** (botão com texto): abre a ficha em 5 passos; bloqueado com aviso "Só é possível editar campanhas em rascunho ou pausadas" quando em andamento/concluída.
- **Duplicar**: cria cópia como Rascunho ("<nome> (cópia)") com público, roteiros/pesos, agenda e pós-ligação; não copia tentativas nem histórico.
- **Excluir**: só fora de "Em andamento" (aviso "Pause a campanha antes de excluir"); confirmação com nome e quantidade de pessoas, explicando que ligações já feitas continuam nas fichas.
- **Iniciar / Pausar** com texto; Iniciar some em concluídas/canceladas.
- **Cancelar** (X): encerra a campanha (rascunho, em andamento ou pausada), com confirmação; tentativas pendentes deixam de ser discadas.
- **Números na linha**: realizadas · sem sucesso · pendentes · total na lista · "iniciou em dd/mm hh:mm".
- **Ritmo** (quando em andamento): próxima ligação prevista e término estimado, com base na agenda e no intervalo.
- Situação "Cancelada" passa a existir nos rótulos em português.

Fica igual: ficha em 5 passos, barra fixa da ficha, checklist do Iniciar, botão "Roteiros de ligação".

## Fora do escopo
Configuração de "Distribuição das conversas" e "limite por minuto" do WhatsApp não se aplicam a ligações (já existem tentativas/intervalo/janela na Agenda). Se quiser algo equivalente, trato em outro plano.

## Permissões
Nenhuma chave nova: Editar/Duplicar/Cancelar = techsales.marketing.campaigns update/create; Excluir = delete; checados na tela e no servidor (deny prevalece, membro ativo, mesmo workspace). Testes dos 5 cenários no contrato.

## Detalhes técnicos
- `prospecting-campaigns.functions.ts`: nova `duplicateCampaign`; `listCampaigns` devolve contagens agregadas de `prospecting_call_attempts` (completed/failed+no_answer+busy/pending) e `started_at`; `deleteCampaign` recusa status running; `setCampaignStatus` aceita `canceled` (marca tentativas `queued` como `canceled`). Verificar se o status já existe no banco; se não, migration aditiva no CHECK.
- `status-label.ts`: `canEditCallCampaign`, `canDeleteCallCampaign`, rótulo Cancelada + testes puros.
- `campaigns.calls.index.tsx`: botões/aria-labels como no WhatsApp, `confirmDialog`, toasts, estados disabled.
- Ajuda `configurar-campanha-de-prospeccao.md` v7; contrato `prospecting-voice-campaigns` atualizado.
- Validação: verify:changed, testes, e conferência no navegador (duplicar e editar na campanha de teste "adadas"; sem iniciar ligações reais).
