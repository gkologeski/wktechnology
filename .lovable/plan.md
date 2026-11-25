# Revisão da proposta mostrando o layout visual

Porte P — estimativa 20–30 min. Não publica.

## Causa (confirmada no código)
Na etapa 4 "Revisão" do assistente de proposta, a caixa de pré-visualização sempre exibe o texto simples (`body`), mesmo quando a proposta usa modelo visual. Por isso aparecem só os textos da capa, sem logo, cores e páginas.

## O que muda
- Quando a proposta tiver layout visual, a Revisão mostra as páginas renderizadas (mesma renderização da ficha, link público e PDF), com logos e dados reais do cliente/prestadora.
- Botão "Ver em tela cheia" abre a prévia visual já existente.
- Modelos de texto rico continuam como hoje.
- Estados de carregamento e erro com "Tentar novamente"; sem dados fictícios silenciosos.

## Detalhes técnicos
- `src/components/proposals/proposal-wizard.tsx` (step 3): se `designJson` existir, renderizar `renderVisualDesignPagesHtml(designJson, contexto)` em `iframe sandbox` (srcdoc) com escala ajustada à largura, reaproveitando o contexto usado por `VisualPreviewModal`; senão manter `sanitizeHtml(body)`.
- Sem mudança de banco, RLS ou permissões; atualizar hash em `permission-contracts.json` como apresentação e artigo de Ajuda da proposta (bump de versão).
- Validação: teste unitário do ramo visual/texto, `permissions:check`, `help:coverage`, lint e Playwright autenticado na proposta Brooks até a Revisão.
