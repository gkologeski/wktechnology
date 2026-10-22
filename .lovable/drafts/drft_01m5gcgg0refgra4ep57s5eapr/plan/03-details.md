## Validação
- Testes: vários termos em "contém" (qualquer um), "não contém" (nenhum), filtro antigo de um termo, limite de termos, termos vazios/duplicados ignorados.
- Typecheck, lint, testes e build com resultados reais.
- Playwright em /campaigns/whatsapp: Empresa › Setor contém "comput" + "soft", conferir contagem maior ou igual à de cada termo sozinho; sem salvar nem enviar.

## Detalhes técnicos
- `campaign-audience.ts`: `AudienceFilter` ganha `values?: string[]` opcional (até 20 termos, 100 caracteres cada); helper `filterTerms(f)` = `values` ou `[value]`. Zod aceita os dois; `value` continua preenchido com o primeiro termo para compatibilidade.
- `campaign-audience.server.ts` `applyOp`: `ilike` com vários termos vira `q.or("col.ilike.*t1*,col.ilike.*t2*")`; `not_ilike` encadeia `.or(col.is.null, col.not.ilike.*t*)` por termo (E). Termos sanitizados com o `clean` atual. Campos JSON personalizados usam o mesmo caminho.
- UI: novo `AudienceTermsInput` (pills + input; Enter/vírgula adiciona, Backspace remove) usado em `audience-groups-editor.tsx` para ilike/not_ilike; nos campos com sugestão, `AudienceValueCombobox` ganha modo múltiplo (selecionar adiciona pill, popover continua aberto). Rótulos acessíveis nos botões de remover.
- Sem migration, sem mudança de envio.
