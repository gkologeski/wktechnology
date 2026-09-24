# Seleção visual de cores na prévia do White Label

## Objetivo
Permitir clicar em uma área da **Visualização em tempo real** para abrir e focar diretamente o controle responsável pela cor ou estilo daquele objeto, tanto no branding do workspace quanto no branding por módulo.

## Interação
1. Tornar selecionáveis os objetos relevantes da prévia: canvas, cabeçalhos, barra lateral, faixas de filtros, painéis, divisórias, textos, botões, campos, status, etapas, logos, tipografia, ícones, raio e densidade.
2. Ao passar o ponteiro ou navegar pelo teclado, indicar discretamente que o objeto é editável, sem alterar sua aparência normal.
3. Ao clicar ou pressionar Enter/Espaço:
   - abrir a aba **Tema** ou **Marca**, conforme o estilo selecionado;
   - sincronizar o editor com o tema claro/escuro atualmente exibido na prévia;
   - rolar até o controle correspondente;
   - aplicar foco visível e destaque temporário no controle;
   - manter um contorno de seleção no objeto da prévia.
4. Quando um objeto usar mais de um estilo, priorizar o estilo principal e oferecer os estilos relacionados junto ao controle selecionado, evitando cliques ambíguos.
5. Preservar edição, herança workspace → módulo, restauração de padrão, contraste e salvamento existentes.

## Acessibilidade e responsividade
- Objetos selecionáveis terão nome acessível, estado selecionado e operação completa por teclado.
- O destaque não dependerá apenas de cor e respeitará redução de movimento.
- Em telas estreitas, o editor será aberto e posicionado antes do controle focado; em desktop, a prévia continuará visível.

## Detalhes técnicos
- Criar um identificador compartilhado para alvos editáveis, cobrindo tokens de cor e controles não cromáticos.
- Elevar para os formulários o estado de aba, modo claro/escuro e alvo selecionado, hoje mantidos internamente.
- Adicionar referências estáveis aos controles no editor de tema e no painel de marca para rolagem e foco.
- Instrumentar a prévia com alvos sem duplicar os valores do catálogo central de tokens.
- Reutilizar a mesma interação em `BrandingBuilder` e `ModuleBrandingForm`; nenhuma alteração de banco, permissões, RLS ou regras de negócio.

## Validação
- Testar seleção por mouse e teclado no workspace e em um módulo.
- Validar correspondência de canvas, painel, divisória, texto, botão, status, etapa, logo, tipografia, ícone, raio e densidade.
- Validar temas claro/escuro, herança por módulo, foco, rolagem, contraste, salvamento e restauração.
- Conferir desktop e celular, além de typecheck, lint, testes afetados e build de desenvolvimento.
