# Campo WhatsApp (E.164) e blindagem das campanhas

## Situação atual (conferida no banco da WK)
- Contatos e Leads têm só "Telefone" e "Celular"; não existe campo WhatsApp.
- Contatos: 51.144 cadastros, 20.469 com celular e 50.426 com telefone. Leads: 5.923 cadastros, nenhum com celular e 5.848 com telefone. Muitos celulares estão gravados no campo "Telefone".

## Fase 1 — Campanhas só com celular
- A montagem do público (fila, público com filtros e lista manual) só aceita número móvel brasileiro válido: DDD + 9 + 8 dígitos, que fica como +55DD9XXXXXXXX. Números estrangeiros em E.164 continuam aceitos.
- Ordem de escolha: WhatsApp → Celular → Telefone, mas somente se o número for móvel. Fixo nunca entra.
- O resumo de exclusões ganha o motivo "telefone fixo (sem WhatsApp)", com a contagem.
- A mesma regra vale no disparo, como segunda proteção: um destinatário já salvo com número fixo é marcado como pulado, sem envio.
- Campanha ICP 001: os destinatários pendentes com número fixo passam a "pulado". Nada é enviado e a campanha continua pausada.

## Fase 2 — Campo WhatsApp dedicado
- Novo campo "WhatsApp" em Contatos e Leads, sempre gravado no padrão E.164 (+55…).
- Formatação automática ao salvar no formulário, na importação, na API e no enriquecimento. Número inválido ou fixo é recusado no campo, com uma mensagem explicando o motivo.
- O campo aparece na ficha, no formulário, nas colunas das listas, nos filtros de público e no catálogo de campos.
- O WhatsApp passa a ser o número preferido em campanhas, na timeline, na Inbox (associação automática por telefone) e na Lia.
- Os campos Telefone e Celular não mudam.

## Varredura da base (somente WK)
- Analisar Celular e Telefone de todos os Contatos e Leads, inclusive vários números no mesmo campo (separados por "/", ";" ou ","). O primeiro número móvel válido vira o WhatsApp, em E.164.
- Prioridade: Celular, depois Telefone. Registros com WhatsApp já preenchido não são alterados.
- Os campos originais não são alterados; só o novo campo é preenchido.
- Relatório final: quantos registros foram preenchidos, quantos só têm fixo, quantos são inválidos e quantos estão sem número.

## Fora do escopo
- Guardar vários WhatsApps por pessoa.
- Validar com a Meta se o número tem WhatsApp de fato.
- Mexer em outros workspaces ou publicar sem aceite.

## Detalhes técnicos
- Migration aditiva: `whatsapp_e164 text` + `whatsapp_digits` gerado + índice em `contacts` e `leads`, com CHECK `^\+[1-9]\d{7,14}$` NOT VALID. A RLS e os GRANTs da tabela continuam valendo.
- Novo módulo `src/lib/phone/whatsapp-e164.ts`: `parsePhoneCandidates`, `toBrMobileE164`, `isBrMobile` e `pickWhatsAppNumber`. Ele é usado por `campaign-audience.server.ts`, `whatsapp-campaign-tick.ts`, `whatsapp-send.server.ts`, `identity-resolution.server.ts`, pelos formulários, pela API v1 e pelo enriquecimento.
- Novo motivo de exclusão `landline` na prévia do público.
- Backfill em lotes de 1.000, via run_sql, restrito a `workspace_id` WK e a `whatsapp_e164 is null`.

## Validação
- Testes: móvel com e sem 55, 9º dígito, fixo recusado, vários números no mesmo campo, valores lixo e prioridade WhatsApp → Celular → Telefone.
- Typecheck, lint, testes e build, com os resultados reais informados.
- Playwright: prévia de um público que mostra fixos excluídos, campo na ficha do contato e conferência por amostra no banco. Nenhum envio.
