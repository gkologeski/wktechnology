# Padronizar a identificação dos itens de linha

## Objetivo
Exibir os itens de linha em todas as telas no padrão:

- `Outsourcing de TI x1 (Desenvolvedor Java Sr) — R$ 24.000,00`
- `Fábrica de Software x244 — R$ 24.400,00`

O nome principal será sempre o **serviço do catálogo**. O **preset de contratação** aparecerá entre parênteses somente quando existir. Itens antigos ou avulsos sem serviço vinculado continuarão usando o título atual como fallback.

## Escopo de implementação

1. **Criar uma formatação única e reutilizável**
   - Centralizar a composição de serviço, quantidade e preset.
   - Normalizar a quantidade sem casas decimais desnecessárias.
   - Preservar cálculo, moeda, descontos, impostos e regras de cobrança existentes.
   - Aplicar fallbacks seguros: serviço → título atual → “Serviço”; preset ausente não gera parênteses vazios.

2. **Negócios e edição dos itens**
   - Enriquecer a leitura dos itens com o nome do serviço e do preset já relacionados.
   - Aplicar o novo padrão no resumo “Itens de linha” da página do negócio.
   - Manter o título livre editável no editor, mas deixar clara a identificação pelo serviço e preset vinculados.
   - Preservar autosave, desfazer, carregamento, vazio, erro e permissões atuais.

3. **Cotações e propostas**
   - Enriquecer os snapshots de itens com os nomes do serviço e preset na leitura.
   - Aplicar o padrão na cotação pública, na revisão do assistente e no PDF.
   - Disponibilizar aos modelos de cotação um valor de exibição padronizado, sem quebrar o token existente de nome.
   - Manter descrições, senioridade, unidade e valores complementares já exibidos.

4. **Contratos e serviços contratados**
   - Aplicar o padrão na prévia dos itens ao criar um contrato.
   - Preservar a referência do preset ao copiar itens do negócio para serviços do contrato, usando os metadados já existentes, sem migration.
   - Exibir serviço, quantidade, preset e valor na lista de serviços do contrato.
   - Para registros antigos, tentar resolver serviço/preset pelo item de origem; se não for possível, usar o nome atual sem bloquear a tela.

5. **Outras listas que exibem os mesmos itens**
   - Revisar os consumidores de `deal_line_items`, `quote_line_items` e serviços originados de itens para aplicar o mesmo formatador onde houver apresentação ao usuário.
   - Não alterar telas que usam esses dados apenas para cálculos, automações ou filtros.

## Detalhes técnicos
- Reutilizar os relacionamentos existentes com catálogo de serviços e presets; não criar tabela ou coluna nova.
- Fazer resolução em lote dos nomes para evitar uma consulta por item.
- Manter `name` como título armazenado e compatível com dados/modelos existentes; o novo rótulo será derivado para apresentação.
- Ao copiar novos itens para contratos, incluir `contracting_preset_id` nos metadados do serviço; registros existentes terão fallback pelo item de origem.
- Não alterar RLS, permissões, valores, sincronização, cobrança nem regras de negócio.

## Testes e validação
- Criar testes unitários para: com preset, sem preset, item sem serviço, quantidade decimal e campos vazios.
- Cobrir o enriquecimento e os fallbacks de negócio, cotação/PDF e contrato.
- Validar manualmente em desktop e mobile, incluindo textos longos, tema claro/escuro e ausência de sobreposição.
- Executar typecheck, lint dos arquivos alterados, testes relacionados e suíte completa; revisar o diff final antes da entrega.
