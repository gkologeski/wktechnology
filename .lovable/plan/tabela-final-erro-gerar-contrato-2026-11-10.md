# TABELA-FINAL + ERRO-GERAR-CONTRATO

Porte M · estimativa 1h–1h30 no total

## Parte 1 — TABELA-FINAL (30–45 min)
A tabela de itens formatada (Item | Cobrança + Total), hoje no topo da proposta, passa para o final e ocupa o lugar da seção "Investimento" do texto, que hoje aparece sem formatação.

1. **Documento da proposta (tela, link público e PDF):** tabela e Total saem do topo e vão para depois do texto, com título "Investimento". O cabeçalho (Para/Detalhes) fica no topo.
2. **Modelo "Proposta — Consultoria":** removo do texto a seção "Investimento" antiga (com cópia de segurança antes).
3. **Propostas já existentes:** se o texto já tiver a tabela de itens, a tabela final não aparece, para não duplicar.
4. **Ajuda:** artigo de modelos de proposta atualizado.

## Parte 2 — ERRO-GERAR-CONTRATO (30–45 min)
**Causa confirmada:** a proposta "Negócio - Alan Fuentes" está sem Parcelas e Dia de vencimento, e "Lei aplicável" não tem valor padrão (só o Foro tem). O modelo exige os três, então a criação é barrada.

1. **Lei aplicável com padrão:** "Legislação da República Federativa do Brasil", podendo ser trocada no modelo ou no contrato.
2. **Mensagem clara:** trocar os nomes técnicos por nomes em português ("Parcelas", "Dia de vencimento", "Lei aplicável") e dizer onde preencher.
3. **Preencher sem sair do assistente:** no passo "Dados" do Novo contrato, mostrar os campos obrigatórios do modelo que estiverem vazios, para preencher ali mesmo.
4. Para esta proposta, basta informar parcelas e vencimento no passo Dados (ou na proposta).

## Fora do escopo
Permissões e regras de acesso não mudam; quem cria contrato continua o mesmo.

## Detalhes técnicos
- `proposal-document.tsx` e `api/public/proposals/$token.pdf.ts`: mover tabela para depois de `body`, ocultar se `body` já contiver a tabela de itens.
- `contract-terms-defaults.ts`: `DEFAULT_GOVERNING_LAW`; aplicar em `template-merge.server.ts`/`sales-flow.server.ts` quando vazio.
- Validação de obrigatórios: mapear tokens para rótulos de `workflow-field-meta.ts`; assistente expõe os campos faltantes no passo Dados.
- Testes: padrão de lei aplicável, rótulos da mensagem, regra de não duplicar tabela. Rodar testes de contratos/propostas, `permissions:check`, `help:coverage`; Playwright gerando contrato da proposta da ÓGEA.
