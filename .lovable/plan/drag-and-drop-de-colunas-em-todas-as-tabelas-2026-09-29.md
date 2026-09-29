# Drag-and-drop de colunas em todas as tabelas

## Resultado esperado

- Toda tabela do sistema permitirá arrastar uma coluna pelo cabeçalho e soltá-la em outra posição.
- O seletor **Colunas** também permitirá reordenar por arrastar e soltar, mantendo os botões de subir/descer como alternativa acessível.
- A ordem será salva por usuário e por tabela; ao recarregar ou voltar à tela, a disposição permanecerá.
- **Restaurar padrão** recuperará a ordem original definida por cada tela.
- Colunas estruturais, como seleção por checkbox, expansão e ações da linha, permanecerão fixas e não poderão receber colunas no meio delas.

## Implementação

### 1. Fundação compartilhada

- Criar um cabeçalho de tabela reordenável e um contêiner compartilhado de drag-and-drop com `@dnd-kit`, já utilizado no projeto.
- Exigir uma chave estável para cada coluna e uma chave estável para cada tabela.
- Separar clique de ordenação e gesto de arrastar por uma distância mínima de ativação, preservando filtros, menus, seleção, links e ordenação crescente/decrescente.
- Exibir alça, estado visual da coluna em movimento, destino de soltura e cursor apropriado, usando os tokens do design system.
- Suportar mouse, toque e teclado, com nomes acessíveis e foco visível.

### 2. Ordem e persistência

- Estender a preferência existente de grids para salvar a lista ordenada de colunas sem perder a ordenação dos registros (`asc`/`desc`) nem a visibilidade atual.
- Aplicar atualização otimista ao soltar e restaurar a ordem anterior se o salvamento falhar.
- Reconciliar preferências antigas com colunas adicionadas ou removidas: manter a ordem conhecida e acrescentar novas colunas na posição padrão.
- Para tabelas que ainda não possuem preferência própria, atribuir uma `gridKey` única e integrá-las ao mesmo mecanismo por usuário.
- Não alterar dados de negócio, consultas, permissões ou isolamento por workspace.

### 3. Seletor “Colunas”

- Trocar a lista atual baseada apenas em setas por itens arrastáveis.
- Preservar busca, grupos, mostrar/ocultar, contagem, cancelar, aplicar e restaurar padrão.
- Durante uma busca, permitir reorganizar os resultados sem perder a posição das colunas que ficaram fora do filtro.
- Manter os botões subir/descer para teclado e tecnologias assistivas.

### 4. Cobertura de todas as tabelas

Aplicar por famílias, aproveitando primeiro os pontos compartilhados e depois tratando exceções:

1. Entidades centrais e operacionais: Leads, Contatos, Empresas, Negócios, Contratos, Serviços, Tarefas, Tickets e listas baseadas em `EntityList`.
2. TechHire: candidatos, vagas, candidaturas, ofertas, sourcing, hunting e tabelas auxiliares.
3. People, Financeiro, Projetos, Contratos e demais módulos operacionais.
4. Configurações, integrações, relatórios, históricos, auditorias, governança e tabelas administrativas.
5. Tabelas nativas ou especializadas que não usam o componente compartilhado, migrando somente sua camada visual para a fundação de colunas sem mudar conteúdo ou comportamento.

Tabelas de documento/preview, matrizes sem colunas independentes e layouts que apenas simulam uma tabela serão avaliados individualmente; quando a movimentação não for semanticamente possível, permanecerão fixos e serão documentados na revisão final.

## Regras de interação

- O arrasto começa somente após movimento intencional; clique simples continua ordenando quando a coluna for ordenável.
- A linha inteira acompanha a nova posição: cabeçalho, células, skeletons, totais e exportação visual permanecem alinhados.
- A rolagem horizontal continuará funcionando durante o arrasto, inclusive com auto-scroll nas extremidades.
- Cabeçalhos agrupados, colunas fixas e colunas com largura especial só podem ser movidos dentro da região compatível.
- No celular, o gesto pela alça não deve bloquear a rolagem normal da página ou da tabela.

## Validação

- Testes unitários da reconciliação de ordem, movimentação, preferências antigas, busca no seletor e restauração do padrão.
- Testes dos componentes compartilhados para mouse, teclado, coluna ordenável, colunas fixas e falha de salvamento.
- Verificação automática com `bun run typecheck`, `bun run lint`, `bun run test` e build do projeto.
- Inventário final comparando todas as ocorrências reais de tabela com as tabelas migradas ou justificadamente fixas.
- Validação no navegador em desktop e celular, light/dark mode, cobrindo ao menos uma tabela de cada família: arrastar no cabeçalho, arrastar no seletor, recarregar, restaurar padrão, ordenar registros, rolar horizontalmente e usar seleção/ações.

## Escopo preservado

- Nenhuma mudança em regras de negócio, banco de dados, RLS, autenticação, automações ou conteúdo das telas.
- Nenhuma funcionalidade existente será removida; setas de reordenação e controles atuais permanecem como fallback quando aplicável.
