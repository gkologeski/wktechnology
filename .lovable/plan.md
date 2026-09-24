# Plano — Layout HubSpot para Negócios

## Objetivo

Adotar na área de Negócios a mesma lógica visual da referência enviada: interface clara e densa, navegação lateral compacta, cabeçalhos discretos e página de registro em três colunas. Esta será a primeira etapa do padrão visual reutilizável para o restante do TechERP.

## Escopo desta etapa

### 1. Lista de Negócios
- Reorganizar título, ações, seletor de pipeline, modos de visualização, busca e filtros na hierarquia usada pelo HubSpot.
- Refinar tabela, quadro, lista e previsão com densidade, bordas, cabeçalhos, linhas, estados selecionados e ações coerentes.
- Manter seleção de colunas, edição/exclusão em massa, fila, filtros, substatus, drag-and-drop e permissões existentes.
- Adaptar a navegação e o conteúdo para desktop, tablet e celular sem remover nenhuma visualização.

### 2. Detalhe do Negócio
- Substituir o cabeçalho atual pelo padrão compacto de registro da referência, com identidade, valor, etapa, pipeline e ações principais.
- Estruturar o conteúdo em três áreas:
  - esquerda: propriedades e dados essenciais;
  - centro: atividades, comunicação, resumo e entrega;
  - direita: associações, itens de linha, cotações e contratos.
- Manter edição de propriedades, mudança de etapa/substatus, timeline, IA, itens de linha, cotações, contratos, associações e exclusão.
- Em telas menores, transformar as colunas laterais em painéis acessíveis sem sobreposição ou perda de conteúdo.

### 3. Fundação visual reutilizável
- Consolidar tokens e padrões HubSpot-like já existentes, usando somente cores semânticas e suporte a modo claro/escuro.
- Reutilizar ou estender componentes oficiais antes de criar novos padrões.
- Evitar copiar marca, logotipo ou elementos proprietários do HubSpot; reproduzir a organização, densidade e comportamento visual.
- Preparar os padrões de lista e detalhe para expansão futura aos demais módulos, sem redesenhar outras telas nesta etapa.

## Estados e acessibilidade
- Implementar estados de carregamento fiéis ao layout, vazio com ação útil e erro com tentativa novamente.
- Garantir foco visível, nomes acessíveis em botões de ícone, navegação por teclado, contraste e alvos adequados no celular.
- Preservar textos em português do Brasil e os controles condicionados por permissão.

## Verificação de fidelidade
- Capturar o resultado da lista e do detalhe após a implementação.
- Comparar lado a lado com a referência enviada, verificando estrutura, proporções, densidade, alinhamento, hierarquia e comportamento.
- Validar em 1280 px, 1024 px, 768 px e 390 px, nos modos claro e escuro.
- Testar interações essenciais: filtros, troca de visão, abertura de negócio, edição, etapas, painéis, ações em massa e navegação por teclado.
- Corrigir as diferenças encontradas antes da entrega final.

## Limites técnicos
- Mudança restrita à apresentação e composição da área de Negócios.
- Sem alteração de banco, regras de acesso, autenticação, integrações ou regras de negócio.
- Nenhuma funcionalidade existente será removida.

## Validações finais
- Revisão dos arquivos alterados e do escopo.
- Typecheck, lint, testes afetados e verificação de formatação do diff.
- Teste visual e funcional no navegador com evidências em desktop e celular.
