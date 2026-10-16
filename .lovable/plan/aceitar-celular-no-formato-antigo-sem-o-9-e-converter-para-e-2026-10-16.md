# Aceitar celular no formato antigo (sem o 9) e converter para E.164

## O que muda
- Um número com DDD + 8 dígitos que começam com 6, 7, 8 ou 9 (ex.: "99 8888-8888", "(51) 9301-6927", "+55 51 9301-6927", "055519301-6927") passa a ser tratado como celular. O sistema acrescenta o 9 e grava em E.164: +55 DD 9XXXXXXXX.
- Espaços, traços, parênteses, pontos, "+55", "55", o zero da frente e o código da operadora continuam sendo ignorados.
- Continuam recusados: fixo (8 dígitos que começam com 2 a 5), números estrangeiros e números sem DDD válido.
- A regra vale nos mesmos pontos de antes: público e disparo das campanhas, Inbox, Lia e o campo WhatsApp (formulário e gatilho do banco).

## Base e ICP 001
- Varredura só na WK: preencher o campo WhatsApp dos Contatos e Leads que estão com o campo vazio e que têm um celular no formato antigo no Celular ou no Telefone. Os campos originais não mudam.
- ICP 001: a campanha está concluída e nada é reenviado. Por isso a lista não volta a incluir números.

## Detalhes técnicos
- `classifyPhone` em `src/lib/phone/whatsapp-e164.ts`: caso de 8 dígitos `^[6-9]` → `mobile` com `+55${ddd}9${local}`.
- Migration: `wa_classify_phone` com o mesmo ramo.
- Dados: `update ... set whatsapp_e164 = wa_pick_mobile(mobile_phone, phone) where workspace_id = WK and whatsapp_e164 is null`, rodado em lotes.
- Testes: os exemplos acima viram E.164 com o 9; fixo e estrangeiro continuam recusados. Atualizar `AGENTS.md`.

## Validação
- Rodar os testes de telefone, WhatsApp e Inbox, a verificação de tipos e o lint, e informar os resultados reais, junto com a contagem de cadastros preenchidos.
- Nada é enviado nem publicado sem o seu aceite.
