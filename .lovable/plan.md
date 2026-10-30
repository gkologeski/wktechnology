# Distribuição de conversas na criação da campanha WhatsApp

Porte: M — estimativa 2 a 3 horas (inclui banco, servidor, tela, permissões e testes).

## O que o usuário verá
Na Nova Campanha, nova seção **"Distribuição das conversas"** (logo após "Após a resposta"), com três opções:
1. **Dividir entre membros da equipe** — escolhe vários membros ativos; conversas distribuídas em rodízio (igual para cada um).
2. **Membro específico** — todas as conversas vão para uma pessoa.
3. **Desatribuídas** — conversas entram na Inbox sem responsável (fila geral).

Padrão para campanhas novas: "Membro específico" = criador (comportamento atual). Campanhas existentes não mudam.
A regra aparece no resumo/detalhe da campanha e só pode ser alterada enquanto rascunho ou pausada.

## Regras
- Só membros **ativos** do workspace podem ser escolhidos; validado no servidor no salvar e no envio (inativo é pulado no rodízio; se nenhum restar, a conversa fica desatribuída e é registrado aviso).
- Conversa que já tem responsável **não** é reatribuída.
- A regra vale para a conversa e para o registro de envio na timeline do contato (responsável = membro escolhido; autor continua sendo quem enviou).
- Rodízio é determinístico e persistido (contador por campanha), sem duplicar nem pular em envios concorrentes.

## Detalhes técnicos
- Migration aditiva em `whatsapp_campaigns`: `assignment_mode` (`owner|member|round_robin|unassigned`, default `owner`), `assignment_member_ids uuid[]`, `assignment_cursor int default 0`; função `wa_campaign_next_assignee(campaign_id)` SECURITY DEFINER com `FOR UPDATE`, executável só por service_role.
- `whatsapp-campaigns.functions.ts`: aceitar/validar campos (zod + membership ativo do workspace).
- Worker de envio: usar a função ao criar/atualizar `whatsapp_conversations.assigned_to` e a atividade outbound, só quando vazio.
- UI: `FormSection` com `RadioGroup` + seletor de membros existente (`AssigneeFilter`/multi-select).
- Permissões: reutiliza permissão de criar/editar campanha; contrato atualizado em `permission-contracts.json` com os cinco cenários.
- Testes: rodízio (3 membros → 1,2,3,1), membro inativo pulado, desatribuído, não reatribui conversa existente, membro de outro workspace rejeitado.
- Validação: vitest, ESLint, Playwright na tela Nova Campanha. Sem disparo real nem publicação.
