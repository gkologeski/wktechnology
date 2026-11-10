# TABELA-FINAL — Tabela de itens no final da proposta

Porte P · estimativa 30–45 min

## Objetivo
A tabela de itens formatada (Item | Cobrança + Total), hoje no topo da proposta, passa para o final e ocupa o lugar da seção "Investimento" do texto, que hoje aparece sem formatação.

## O que muda
1. **Documento da proposta (tela, link público e PDF):** a tabela de itens e o Total saem do topo e vão para depois do texto, com o título "Investimento". O cabeçalho (Para/Detalhes) continua no topo.
2. **Modelo "Proposta — Consultoria":** removo do texto a seção "Investimento" (título, `{{{items_table}}}` e linha de Total), para não repetir. Antes, salvo uma cópia de segurança do modelo. Condições comerciais e validade continuam.
3. **Propostas existentes:** o texto que já tem "Investimento" fica igual até o modelo ser aplicado de novo. Para evitar duas tabelas, a tabela final só aparece se o texto não tiver a tabela de itens.
4. **Ajuda:** atualizo o artigo de modelos de proposta (versão nova) explicando que a tabela fica sempre no final.

## Fora do escopo
Permissões, regras de acesso e cálculos de valores não mudam.

## Detalhes técnicos
- `src/components/proposals/proposal-document.tsx`: mover bloco da tabela/Total para depois de `p.body`, com título "Investimento"; esconder se `body` contiver tabela de itens (marcador "Cobrança" em `<th>`).
- `src/routes/api/public/proposals/$token.pdf.ts`: mesma ordem e mesma regra.
- Atualizar o corpo do modelo no banco (backup como "Proposta — Consultoria (backup antes de TABELA-FINAL)").
- Teste pequeno para a regra "não duplicar tabela"; rodar testes de propostas, `permissions:check`, `help:coverage`; conferir no Playwright a proposta da ÓGEA.
