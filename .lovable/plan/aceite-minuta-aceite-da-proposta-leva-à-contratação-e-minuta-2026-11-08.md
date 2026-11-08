# ACEITE-MINUTA — Aceite da proposta leva à Contratação e minuta com aprovação jurídica

Porte: **G** (dividido em 3 entregas M). Estimativa: **6–9 h** no total, sem publicação incluída (publicação separada, após sua validação).

## Situação atual (conferida)
- Pipeline "Novos Negócios" já tem a etapa **Contratação** (`contract`) com os substatus: Contrato em elaboração, Contrato enviado, Em análise jurídica, Ajustes contratuais, Aguardando assinatura. Não existe "Enviar minuta de contrato".
- O aceite do cliente (link público) muda só a proposta; o negócio não se move.
- Aprovações de contrato existem (etapas jurídico/financeiro/compras), mas só depois do contrato criado. Não há aprovação de minuta nem configuração de aprovador jurídico por fluxo.

## Fluxo novo

```text
Cliente aceita proposta (link)
  -> Workflow "Proposta aceita" (gatilho novo)
       -> Negócio vai para Contratação / substatus "Enviar minuta de contrato"
       -> Minuta criada a partir do modelo padrão do serviço da proposta
       -> Pedido de aprovação ao aprovador jurídico (notificação)
Jurídico abre a notificação -> tela de revisão da minuta
  -> Aprovar envio  |  Trocar modelo  |  Editar texto  -> Aprovar
Envio automático pelo e-mail do responsável do negócio, com link
  -> substatus "Minuta enviada"
Cliente abre o link: Aceitar  |  Pedir ajustes (comentário)
  -> Pedir ajustes: substatus "Ajustes contratuais", volta ao jurídico
  -> Aceitar: substatus "Contrato em elaboração"; contrato liberado
     para confecção, envio e assinaturas (fluxo atual de contratos)
```

## Entrega 1 — Aceite move o negócio (M, 1,5–2 h)
- Novo evento de Workflow **"Proposta aceita pelo cliente"**, disparado pelo aceite público.
- Nova ação de Workflow **"Mover negócio para etapa/substatus"** (reaproveita a regra atual de mudança de etapa).
- Workflow padrão (rascunho para você ativar) "Proposta aceita → Contratação".
- Substatus novo **"Enviar minuta de contrato"** na posição 1 de Contratação e **"Minuta enviada"** na 2; demais preservados.

## Entrega 2 — Minuta e aprovação jurídica (M, 3–4 h)
- **Configurações → Fluxos de aprovação → Minuta de contrato**: escolher um ou mais aprovadores jurídicos por workspace (sem conceder a todos).
- Minuta gerada do modelo padrão vinculado ao serviço (`contract_template_services`); sem modelo vinculado, o pedido avisa "sem modelo padrão" e o jurídico escolhe.
- Notificação ao aprovador abre a tela **Revisar minuta**: ver texto, trocar modelo, editar, aprovar ou recusar (com motivo). Histórico de quem aprovou/editou.
- Nova permissão "Aprovar minuta de contrato" no catálogo, visível em `/settings/permissions`; servidor e banco negam por padrão.

## Entrega 3 — Envio e aceite pelo cliente (M, 2–3 h)
- Após aprovação, e-mail sai automaticamente pela **conta conectada do responsável do negócio**. Se ele não tiver conta conectada, nada é enviado e ele recebe tarefa/aviso para conectar.
- Link público da minuta com **Aceitar** e **Pedir ajustes** (prazo de validade, sem dados além da minuta).
- Aceite libera o botão **Gerar contrato** a partir da minuta aceita (hoje é livre; passa a exigir minuta aceita quando o fluxo estiver ativo no workspace).
- Artigos de Ajuda atualizados (proposta, negócio, contratos) com versão nova.

## Detalhes técnicos
- Migrations novas: tabela `contract_drafts` (workspace, deal, proposal, template, corpo, status draft/pending_legal/approved/sent/accepted/changes_requested, token público hash, validade) com GRANT → RLS → policies; tabela de aprovadores `contract_draft_approvers`; `INSERT` de dois substatus apenas no workspace WK via ferramenta de dados (não migration).
- `sales_public_decision` passa a emitir `domain_events` `proposal.accepted`; engine de workflows ganha gatilho e ação `deal_set_stage`.
- Envio usa `sendGmailEmail`-equivalente server-side com a conta do responsável (sem trocar remetente), dentro de job do worker; falha mantém status `approved` e registra erro.
- Rota pública `/contract-draft/$token` (padrão de `/proposal/$token`), decisão via RPC `security definer` validando token/validade.
- Gate opt-in por workspace (`contract_draft_flow_enabled`, padrão desligado; ligado só na WK).
- Contratos de permissão + cinco cenários (permitido, sem chave, deny, outro workspace, inativo); `permissions:check`, testes, cobertura Ajuda.

## Fora do escopo
- Assinatura eletrônica e etapas posteriores (seguem como estão).
- Publicação (pedido separado).
