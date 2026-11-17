# MODELOS-POR-NUMERO — Modelos de todos os números do rodízio

Porte **M** · estimativa **2 a 3 horas** (tela, regra de escolha, disparo, testes, Ajuda).

## Problema
A lista de modelos carrega só os modelos do número principal. Cada número pode ter modelos aprovados diferentes na Meta, e hoje o sistema exige que todo modelo escolhido exista em todos os números do rodízio.

## O que muda para você
- Os campos "Template" e "Rodízio de modelos" passam a mostrar os modelos aprovados de **todos** os números escolhidos, agrupados por número (ex.: "prospeccao_001 · pt_BR · +55 48 6136-9564").
- Cada modelo escolhido fica ligado ao número que o aprovou. Na hora do envio, o contato recebe aquele modelo **pelo número dono dele**, e continua preso a esse número nas respostas.
- Se o mesmo modelo existir em vários números, ele aparece uma vez em cada número; você escolhe quais combinações entram.
- Ao salvar, deixa de exigir que todo modelo exista em todos os números; passa a conferir só que cada par (modelo, número) está aprovado e o número está ativo.
- Ao remover um número do rodízio, os modelos dele saem da seleção com aviso.
- Campanhas antigas (modelo sem número ligado) continuam funcionando como hoje.

## Detalhes técnicos
- Tela `campaigns.whatsapp.tsx`: buscar o catálogo em paralelo para principal + extras (`useQueries`), unir com rótulo do número; entradas de `template_rotation` ganham `phone_number_id` opcional; principal ganha número dono.
- `campaign-template-rotation.ts`: escolha pura devolve o par; `campaign-sender-rotation.ts`: quando o modelo tem dono, o número é o dono (rodízio de números passa a decorrer do rodízio de modelos); sem dono, regra atual.
- `assertSendersApproved` (`campaign-rotation-guard.server.ts`): validar por par.
- Tick de disparo: fixar `template_name` e `sender_phone_number_id` juntos no primeiro envio; se o número dono falhar, contato aguarda (não troca de número).
- Sem migração: o par fica no JSON já existente `template_rotation` (+ campo no principal dentro do mesmo JSON/colunas atuais). Permissões inalteradas.
- Testes: par fixado, validação por par, compatibilidade com campanhas antigas, número dono indisponível.
- Ajuda: `docs/help/crm/criar-campanha-whatsapp.md` v6→v7, aplicada só esse artigo; atualizar `src/lib/whatsapp/AGENTS.md`.
- Validação no navegador com 3 números; sem disparo real. Não publicar.
