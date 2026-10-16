# Edição de campanha de WhatsApp carregando todos os campos

## Problema (confirmado no código)
Ao abrir "Editar", a tela só recupera nome, ritmo, intervalo, modelo, texto, mídia e agente SDR. Ficam de fora:
- o quadro **Público** inteiro (origem: fila, público filtrado ou lista manual; grupos e filtros; operador entre grupos);
- o **mapeamento das variáveis** do modelo ({{1}}, {{2}}…, incluindo Texto livre e "valor se vazio");
- "pular quem tem variável vazia";
- o **período de reenvio** (dias) e as liberações manuais.

Causa: a campanha nunca guardou essa configuração; ela só é usada para gerar os destinatários na criação. Além disso, na edição o quadro Público é escondido.

## O que muda
1. Ao criar ou salvar uma campanha, a configuração do público, das variáveis e do reenvio passa a ser guardada junto com ela.
2. Ao editar, todos os campos voltam preenchidos: modelo, texto, mídia, agente, ritmo, intervalo, público (com grupos/filtros e operadores), variáveis e período de reenvio.
3. Na edição (rascunho ou pausada) o quadro Público aparece:
   - **Rascunho:** pode alterar o público e as variáveis; ao salvar, a lista de destinatários pendentes é refeita com as mesmas regras da criação (celular do Brasil, duplicados, descadastro, reenvio recente, limite de 5.000).
   - **Pausada:** público e variáveis ficam visíveis só para leitura, para não misturar destinatários já enviados com uma lista nova. Os demais campos continuam editáveis.
4. Campanhas antigas (criadas antes desta mudança) não têm a configuração guardada: abrem com os demais campos preenchidos e um aviso "Público desta campanha não foi registrado" mostrando quantos destinatários ela tem. O período de reenvio é lido da campanha.

## Regras preservadas
Workspace ativo e RLS; nada é enviado; campanhas em envio/concluídas continuam sem edição; destinatários já enviados nunca são alterados.

## Validação
- Testes: configuração salva e relida igual (grupos E/OU, variáveis, texto livre, reenvio); rascunho refaz só pendentes; pausada recusa troca de público no servidor; campanha antiga sem configuração abre sem erro.
- Typecheck, lint, testes e build com resultados reais.
- Playwright em /campaigns/whatsapp: criar rascunho com 2 grupos e variáveis, reabrir em Editar e conferir todos os campos, alterar um filtro, salvar, conferir a contagem, excluir o rascunho. Nenhum envio, nada publicado.

## Detalhes técnicos
- Migration aditiva: `whatsapp_campaigns.audience_config jsonb null` (sem GRANT/RLS novos; tabela já coberta). Conteúdo: `{ audience, variable_map, skip_missing, recent_overrides, mode }`; lista manual guarda os telefones brutos.
- `createWhatsAppCampaign` grava `audience_config`; `getWhatsAppCampaignForEdit` passa a retornar também `audience_config`, `recent_contact_days`, `rate_per_minute`, intervalos e `total`.
- `updateWhatsAppCampaign` aceita `audience`/`variable_map`/`skip_missing`/`recent_*` opcionais: só em `draft`; reaproveita o resolvedor da criação, apaga recipients `pending` via `deleteRowGuarded`, insere em lotes de 500 e atualiza `total`.
- UI (`campaigns.whatsapp.tsx`): `openEdit` hidrata `AudienceState` (com `normalizeAudienceFilters` para formato antigo) e `recipientsRaw`; `CampaignAudiencePanel` ganha prop `readOnly` para pausadas; remove o aviso fixo de "não pode ser alterada".
