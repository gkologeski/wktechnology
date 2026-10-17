# Rolagem do seletor de campos do Público (WhatsApp)

## Problema
Na janela de nova/editar campanha, a lista "Buscar campo…" do filtro de público abre, mas a roda do mouse/touchpad não rola. A janela de campanha bloqueia a rolagem de tudo que é aberto "por cima" dela, e a lista de campos é aberta fora da janela.

## Correção
- Abrir a lista de campos e a lista de valores ("Escolha ou digite") em modo compatível com a janela, para que a rolagem funcione dentro delas.
- Manter busca, agrupamento por entidade, altura máxima e seleção iguais.

## Validação
- Playwright em /campaigns/whatsapp: abrir Nova campanha › Criar público › seletor de campo, rolar com a roda e confirmar que a lista desceu (ex.: aparecem campos de Empresa/Negócio). Sem salvar nem enviar.
- Checagem de tipos, estilo e testes com resultados reais.

## Detalhes técnicos
- `src/components/whatsapp/audience-groups-editor.tsx` (FieldPicker) e `audience-value-combobox.tsx`: `<Popover modal>` (o Radix passa a gerenciar o bloqueio de scroll incluindo o conteúdo do popover), mantendo `CommandList max-h-80` com `overflow-y-auto`.
