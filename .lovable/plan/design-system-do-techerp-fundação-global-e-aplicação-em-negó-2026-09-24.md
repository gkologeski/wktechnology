# Design System do TechERP — fundação global e aplicação em Negócios

## Objetivo
Transformar a direção visual inspirada na organização e densidade do HubSpot em um padrão oficial e reutilizável do TechERP. Nesta etapa, a fundação será global e sua aplicação completa ficará restrita à área de Negócios.

## Mudanças propostas

### 1. Fundação global do Design System
- Criar tokens semânticos reutilizáveis para fundo geral, cabeçalho, navegação contextual, colunas laterais, área central, blocos e divisórias.
- Usar um fundo cinza-azulado suave no canvas, branco apenas nas áreas de conteúdo e divisórias mais perceptíveis.
- Manter a cor **Destaque (accent)** definida em **Configurações → White Label** como acento pontual de ação, sem transformar toda a interface em uma cópia da marca HubSpot.
- Definir equivalentes coerentes para o modo escuro.
- Documentar composição, densidade, espaçamento, hierarquia, estados, responsividade e regras de uso para listas e páginas de detalhe.
- Reutilizar e estender os componentes oficiais existentes, evitando criar uma segunda biblioteca visual paralela.

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

### 4. Componentes reutilizáveis
- Consolidar os padrões de cabeçalho de página, barra de filtros, abas, tabelas densas, painéis laterais, seções de propriedades, estados vazios, carregamento e erro.
- Fazer os componentes consumirem apenas tokens semânticos e a configuração White Label, sem cores fixas na tela.
- Preparar uma API de composição que permita migrar os demais módulos depois, sem alterar suas telas nesta etapa.

### 5. Documentação e adoção futura
- Atualizar a documentação oficial do Design System com exemplos de lista e detalhe baseados na implementação de Negócios.
- Registrar orientações para que novas telas já adotem o padrão e telas existentes sejam migradas gradualmente.
- Não redesenhar Leads, Contatos, Empresas, Prospecção ou outros módulos nesta etapa.

### 6. Verificação visual
- Comparar a nova versão com a referência do HubSpot, verificando principalmente contraste entre superfícies, densidade e hierarquia.
- Validar lista e detalhe em desktop e celular, nos modos claro e escuro.
- Confirmar que não há sobreposição, perda de conteúdo ou regressão nas ações principais.

## Limites técnicos
- A fundação e a documentação serão globais; a alteração visual de telas ficará restrita à área de Negócios.
- Sem mudanças em banco, permissões, autenticação, integrações ou regras de negócio.
- Nenhuma funcionalidade existente será removida.

## Validações
- Revisão dos arquivos alterados e do escopo.
- Typecheck, lint e testes afetados.
- Verificação visual e funcional da lista e do detalhe no navegador após a atualização.
- Conferência de que a cor Destaque do White Label continua controlando ações e estados de ênfase.
