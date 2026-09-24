# Ajuste visual de Negócios — menos branco, mais próximo do HubSpot

## Objetivo
Aumentar a separação visual entre fundo, colunas e blocos da área de Negócios. O conteúdo continuará claro, mas deixará de parecer uma única superfície branca.

## Mudanças propostas

### 1. Paleta específica para o CRM
- Criar tokens semânticos próprios para o fundo geral, cabeçalho, colunas laterais, área central, blocos e divisórias.
- Usar um fundo cinza-azulado suave no canvas, branco apenas nas áreas de conteúdo e divisórias mais perceptíveis.
- Manter a cor **Destaque (accent)** definida em **Configurações → White Label** como acento pontual de ação, sem transformar toda a interface em uma cópia da marca HubSpot.
- Definir equivalentes coerentes para o modo escuro.

### 2. Detalhe do negócio
- Dar ao cabeçalho uma superfície própria, com contraste em relação ao restante da página.
- Diferenciar claramente as três áreas: propriedades à esquerda, atividades no centro e associações à direita.
- Reduzir o efeito de “cartões brancos sobre fundo branco” com fundos alternados, bordas e títulos de seção mais definidos.
- Preservar integralmente propriedades, timeline, IA, entrega, itens de linha, cotações, contratos e associações.

### 3. Lista de negócios
- Aplicar o mesmo canvas cinza-azulado à lista.
- Separar cabeçalho, barra de filtros, abas e conteúdo principal com superfícies e divisórias claras.
- Ajustar tabela, quadro, lista e previsão para que linhas e colunas tenham contraste suficiente sem sombras fortes.
- Preservar filtros, busca, seleção, ações em massa, fila, pipeline, substatus e todas as visualizações atuais.

### 4. Verificação visual
- Comparar a nova versão com a referência do HubSpot, verificando principalmente contraste entre superfícies, densidade e hierarquia.
- Validar lista e detalhe em desktop e celular, nos modos claro e escuro.
- Confirmar que não há sobreposição, perda de conteúdo ou regressão nas ações principais.

## Limites técnicos
- Alteração restrita à apresentação da área de Negócios e aos tokens visuais necessários.
- Sem mudanças em banco, permissões, autenticação, integrações ou regras de negócio.
- Nenhuma funcionalidade existente será removida.

## Validações
- Revisão dos arquivos alterados e do escopo.
- Typecheck, lint e testes afetados.
- Verificação visual e funcional no navegador após a atualização.
