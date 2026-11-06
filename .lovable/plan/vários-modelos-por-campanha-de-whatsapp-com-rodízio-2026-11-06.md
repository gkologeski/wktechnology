# Vários modelos por campanha de WhatsApp com rodízio

Estimativa: porte M, cerca de 3h–4h (inclui migração, servidor, tela, testes, Ajuda e permissões).

## O que muda para o usuário
- No cadastro da campanha, o campo "Modelo" passa a aceitar vários modelos aprovados (mesmo número/conta remetente).
- Para cada modelo escolhido, o usuário preenche as variáveis dele (cada modelo pode ter quantidade diferente).
- Modo de rodízio:
  - **Sequencial** (padrão): 1º contato recebe o modelo A, 2º o B, 3º o C, volta ao A.
  - **Aleatório com peso**: cada modelo recebe um percentual (ex.: 50/30/20).
- A ficha da campanha mostra, por modelo: enviados, entregues, lidos, respondidos e falhas, para comparar desempenho.
- Campanhas existentes continuam iguais (viram campanha de um único modelo).

## Regras
- Só modelos com status APPROVED, revalidados no servidor no momento de salvar e de cada envio; se um modelo deixar de estar aprovado, ele sai do rodízio e o envio usa os demais (se nenhum restar, a campanha pausa com aviso).
- O modelo de cada destinatário é sorteado/definido ao salvar o público e gravado no destinatário, então reenvio ou retomada usa sempre o mesmo modelo (nada de a mesma pessoa receber dois modelos).
- Variáveis completas exigidas para todos os modelos antes de iniciar.
- Ritmo, espaçamento aleatório, supressões, reenvio recente, distribuição e bloqueio de clientes continuam como hoje.
- Máximo de 5 modelos por campanha.
- Sem nova permissão: usa as mesmas chaves de criar/editar campanha de WhatsApp.

## Detalhes técnicos
- Migração aditiva: tabela `whatsapp_campaign_templates` (campaign_id, workspace_id, template_name, template_language, variables_template, weight, position) com GRANT → RLS → políticas iguais às de `whatsapp_campaigns`; colunas `rotation_mode` em `whatsapp_campaigns` e `template_name/template_language` em `whatsapp_campaign_recipients`; backfill do modelo atual para cada campanha. Colunas antigas da campanha ficam como fallback (comentadas como legadas).
- Regra pura nova `src/lib/whatsapp/campaign-template-rotation.ts` (sequencial/peso, determinística por índice) + testes.
- `campaign-audience.ts`: resolve variáveis por modelo do destinatário (mesma lista branca).
- `whatsapp-campaign-tick.ts`: usa modelo do destinatário; revalida aprovação; grava `template_name` na mensagem.
- Tela de campanha: multisseleção com `use-whatsapp-composer`/`composer-policy`, editor de variáveis por modelo, pesos, métricas por modelo.
- Atualizar `src/lib/whatsapp/AGENTS.md`, artigo de Ajuda de campanhas (versão +1), contratos de permissão; rodar `permissions:check`, testes do WhatsApp, ESLint e `help:coverage`.
