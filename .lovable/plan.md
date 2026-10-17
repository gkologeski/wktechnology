# Resumos da IA recolhíveis e vencimento da proposta no padrão de data

## 1. Resumos da IA nos Negócios em blocos que abrem e fecham
O painel "Resumos da IA" aparece na ficha do Negócio e no painel lateral do Negócio.
- Cada resumo vira um bloco fechado. Na linha do título ficam o tipo, o sentimento, a quantidade de mensagens, a data e o botão de excluir.
- Fechado, o bloco mostra só uma prévia de até 2 linhas do texto. Ao clicar, ele abre e mostra o texto completo, os pontos-chave e os próximos passos.
- O resumo mais recente começa aberto e os demais começam fechados.
- O botão de abrir tem nome acessível e foco visível. Gerar e excluir resumos continua funcionando como hoje.
- Como o painel é compartilhado, Contatos, Leads e Chamados ganham o mesmo comportamento.

## 2. Vencimento da proposta
- O assistente de proposta já usa o seletor padrão: Personalizado, Ontem, Hoje e Amanhã, com calendário em pt-BR.
- O campo fora do padrão é a data na "Editar em massa" da lista de Propostas. Hoje ele usa o campo de data e hora do navegador.
- Mudança: os campos só de data, como a Validade/Vencimento (`expires_at`), passam a usar o seletor padrão, com a opção "Limpar".
- O valor continua sendo gravado do mesmo jeito.
- Os campos com data e hora seguem como estão.

## Detalhes técnicos
- `src/components/ai/ai-summary-panel.tsx`: `Collapsible` (shadcn) por linha, com estado local `openIds` e o primeiro aberto por padrão. Prévia com `line-clamp-2`.
- `src/components/grid/bulk-edit-fields-dialog.tsx`: quando `field.type === "date"` e o campo é só de data (`expires_at`, ou um campo marcado como `dateOnly`), usar `DatePicker` de `@/components/date-picker`. A conversão fica `startOfDay` → ISO.
- Não muda banco, regras de acesso ou regras de negócio.
- Validação: typecheck, lint, testes e Playwright, abrindo um Negócio para expandir e recolher resumos e usando a edição em massa de Propostas para escolher a data, sem salvar.
