# AJUSTES-LIGACAO — Cancelada, Ritmo e Modelo do pós-ligação

Porte **M**, estimativa **3–4 horas** (inclui migração, testes, Ajuda e conferência no navegador sem disparar ligações reais).

## 1. Situação "Cancelada"
- Hoje o banco só aceita Rascunho, Em andamento, Pausada e Concluída; o botão Encerrar grava "Concluída".
- Nova situação **Cancelada**: o botão Encerrar (X) passa a gravar Cancelada; tentativas na fila continuam sendo canceladas.
- Cancelada: não pode editar nem iniciar/retomar; pode **Duplicar** e **Excluir**; selo próprio na lista e na ficha; aparece no filtro de situação.
- Campanhas já encerradas antes continuam como Concluída (sem reclassificar histórico, pois não dá para distinguir).
- O discador e o agendador já só ligam campanhas "Em andamento"; será conferido que Cancelada fica fora.

## 2. Ritmo (próxima ligação e término estimado)
- Na linha da lista e no topo da ficha, quando "Em andamento": **Próxima ligação prevista: dd/mm hh:mm** e **Término estimado: dd/mm**.
- Cálculo puro a partir de: tentativas pendentes, intervalo entre tentativas, janela de horário, dias da semana e próxima tentativa agendada mais cedo.
- Fora da janela: mostra o próximo início da janela. Sem pendentes: "Sem ligações na fila". Pausada: "Pausada — sem previsão".
- Texto indica que é estimativa.

## 3. Modelo aprovado no Pós-ligação
- O campo hoje é texto livre. Passa a ser uma lista que **carrega sozinha** os modelos **aprovados** do remetente escolhido (e do número padrão).
- Ao trocar o remetente, a lista recarrega; se o modelo salvo não existir no novo remetente, fica vazio com aviso "Escolha um modelo deste remetente".
- Estados: carregando, nenhum modelo aprovado (com orientação), erro com "Tentar de novo".
- O idioma do modelo é salvo junto, vindo do próprio modelo.
- O servidor continua validando no envio (somente modelo aprovado), como hoje.

## Permissões
Nenhuma chave nova. Cancelar = techsales.marketing.campaigns update; listar modelos = mesma permissão de ver a campanha; checagem na tela e no servidor, membro ativo, mesmo workspace, deny prevalece. Contrato atualizado com os 5 cenários.

## Ajuda
Artigo "Configurar campanha de prospecção" v8: situação Cancelada, Ritmo e escolha do modelo; catálogo sincronizado.

## Detalhes técnicos
- Migração aditiva: `ALTER TYPE prospecting_campaign_status ADD VALUE 'canceled'`.
- `setCampaignStatus` aceita `canceled` (Encerrar passa a usá-lo); `status-label.ts`: rótulo Cancelada, `canEdit/canDelete/canCancel` ajustados; novo `estimateCallPace()` puro + testes.
- `listCampaigns`: devolve próxima `scheduled_at` pendente para o ritmo.
- Nova server fn `listCallFollowupTemplates({ senderId })` usando `loadApprovedTemplates` de `src/lib/whatsapp/templates.server.ts` com cliente do usuário (RLS) e `requireSalesPermission`.
- `campaign-call-followup.tsx`: troca Input por Select dependente do remetente.
- Validação: permissions:check, verify:changed, testes, help:coverage, conferência no navegador (duplicar, trocar remetente e ver modelos; sem iniciar ligações).
