# Campanhas WhatsApp: só celular do Brasil (+55 DDD 9XXXXXXXX)

## O que aconteceu (conferido no banco)
- A ICP 001 já terminou (status "concluída"). Foram 63 envios, mas só 13 eram celulares brasileiros válidos. Os outros 50 foram para fixos, números estrangeiros ou números no formato antigo, como +55 78 6374-2930 (8 dígitos sem o 9).
- Causa: a regra atual aceita números estrangeiros e trata como celular o formato antigo de 8 dígitos começando com 6 a 9. Isso vale para a campanha e também para o campo WhatsApp preenchido na varredura.

## O que será feito
1. **Regra única e estrita:** número válido para WhatsApp é só `+55` + DDD válido + `9` + 8 dígitos (13 dígitos no total). Todo o resto fica inválido: fixo, formato antigo de 8 dígitos e estrangeiro.
2. **Aplicar a regra em todos os pontos:** montagem do público (fila, filtros, lista manual), disparo (segunda proteção: marca como pulado), envio pela Inbox/timeline/Lia, campo WhatsApp de Contatos/Leads (gatilho do banco e formulário).
3. **Limpar a lista da ICP 001:** destinatários que não são celular do Brasil saem da lista (marcados como "inválido", com o motivo). O histórico de envio continua guardado. Ficam só os 13 celulares válidos.
4. **Limpar o campo WhatsApp (só WK):** apagar o valor do campo WhatsApp quando não for celular do Brasil. Telefone e Celular originais não mudam.
5. **Resumo do público:** o motivo de exclusão passa a mostrar "fixo, estrangeiro ou fora do padrão".

## Fora do escopo
- Enviar mensagens ou retomar campanha.
- Mexer em outros workspaces.
- Apagar conversas já existentes na Inbox.

## Detalhes técnicos
- `src/lib/phone/whatsapp-e164.ts`: `classifyPhone` passa a aceitar só `^55[1-9][1-9]9\d{8}$` como móvel; estrangeiro vira inválido. Adaptar testes.
- Migration: recriar `wa_classify_phone`/`wa_pick_mobile` com a regra estrita; CHECK do campo continua `NOT VALID`.
- Dados (run_sql, workspace WK): recipients da ICP 001 fora da regra → `status='skipped'`, erro "Não é celular do Brasil"; `contacts`/`leads.whatsapp_e164` fora da regra → null (lotes).
- Regra atualizada em `src/lib/whatsapp/AGENTS.md`.

## Validação
- Testes de telefone e WhatsApp, typecheck e lint com resultados reais.
- Conferência no banco: ICP 001 sem destinatários fora da regra; contagem de campos WhatsApp limpos.
- Nada enviado; publicação só com seu aceite.
