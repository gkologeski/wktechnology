# FORSIGN-INTEGRA — Assinatura de contratos via ForSign

Porte: M/G. Estimativa: 6–9 h de implementação + validação com conta real (depende da sua chave de API).

## Objetivo
Enviar contratos do TechERP para assinatura no ForSign sem sair do sistema, acompanhar o andamento e receber automaticamente o PDF assinado como evidência, mantendo o fluxo manual "Registrar assinatura externa" como alternativa.

## O que o usuário verá
1. **Configurações > Integrações > ForSign**: estado (não configurado, conectado, falha), testar conexão, ativar/desativar por workspace e endereço do webhook para copiar no painel ForSign.
2. **No contrato e no painel "Contrato e assinaturas" do negócio**: botão "Enviar pelo ForSign". Mostra signatários (cliente e WK, com CPF do signatário legal), ordem e canal (e-mail/WhatsApp) antes de confirmar.
3. **Acompanhamento**: status por signatário (enviado, visualizou, assinou, recusou, expirou), botões "Atualizar status", "Reenviar lembrete" e "Cancelar envio" (com confirmação).
4. **Ao concluir**: PDF assinado + relatório de assinaturas salvos no arquivo privado de evidências, hash registrado e contrato segue para o passo de ativação (sem ativar sozinho; ativação continua manual ou por workflow).
5. Evento de workflow "Contrato assinado no ForSign" para automações.

## Regras
- Um envio ativo por versão do contrato; se o contrato mudar depois do envio, o envio é marcado como versão não vigente (como já ocorre hoje).
- Não substitui nem revoga o documento nativo já enviado ao Gustavo sem sua ordem.
- O PDF enviado é gerado a partir do corpo formatado do contrato (mesmo layout da revisão).

## Permissões
Novas chaves no catálogo e em /settings/permissions:
- `techcontracts.forsign.configure.workspace` (configurar integração — owner/admin)
- `techcontracts.forsign.send.workspace` (enviar, reenviar, cancelar)
Leitura do status segue a permissão de assinatura existente. Testes: permitido, sem chave, deny, outro workspace, inativo.

## Ajuda
Novo artigo "Assinar contratos pelo ForSign" (contracts) e atualização dos artigos de assinatura e jornada (bump de versão).

## Detalhes técnicos
- API ForSign: `https://api.forsign.digital/api/v1`, header `X-Api-Key`; upload do arquivo, `POST /operation` com `externalId` = id do contrato, `metadata` com workspace/contrato; download do documento finalizado.
- Chave guardada cifrada por workspace no servidor (mesmo padrão das demais integrações), nunca no navegador.
- Adapter `src/lib/integrations/forsign/` (cliente HTTP + mapeamento de status) e server functions finas com `requireSupabaseAuth` + gate de permissão.
- Webhook `src/routes/api/public/forsign/webhook.ts`: valida segredo/assinatura do ForSign (a confirmar na documentação de webhooks; se não houver assinatura, segredo na URL + reconsulta do status pela API antes de gravar), idempotente por evento.
- Fallback de sincronização: cron a cada 2 min consulta envios pendentes (caso o webhook falhe).
- Migração: tabela `contract_forsign_operations` (workspace_id, contract_id, version hash, operation_id, status, signatários, eventos) com GRANT + RLS por workspace; config da integração na tabela de integrações existente.
- Geração de PDF no servidor compatível com Workers (avaliar a geração já usada para propostas).
- Testes: mapeamento de status, idempotência do webhook, permissões; Playwright no fluxo de envio com provedor simulado (envio real só com sua chave).

## Dependências suas
- Chave de API (token de integração) do ForSign, gerada no painel da conta.
- Confirmar se o plano ForSign inclui webhooks e créditos de API.

## Status ao final
Separarei: preparado, testado (simulado), testado com ForSign real, aplicado no banco, publicado.
