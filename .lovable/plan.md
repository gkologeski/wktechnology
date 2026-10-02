# Corrigir "Failed to fetch" na importação de modelo de contrato

## Causa provável
A conversão (`parseContractTemplatePdf/Html`) faz uma única chamada à IA, sem streaming, pedindo o contrato inteiro reescrito em HTML. Em contratos longos a resposta demora mais que o limite da conexão; o navegador perde a requisição e mostra "Failed to fetch". Os logs do servidor confirmam requisições abortadas. Primeiro passo: confirmar nos logs do AI Gateway (duração/status da chamada `importacao_modelo`).

## O que muda
1. **Chamada à IA em streaming** no servidor (`stream: true` via `aiChatFetch`), acumulando o texto até o fim — evita o corte por tempo de resposta buferizada.
2. **Rota de servidor com streaming até o navegador** (`src/routes/api/template-import.ts`, autenticada pelo token do usuário + mesma checagem de permissão `contract_templates.create`), enviando progresso ("Analisando com IA… X%") e o resultado final; o diálogo passa a consumir esse fluxo em vez da server function buferizada.
3. **Documentos grandes**: se o texto passar de um limite, dividir em blocos de cláusulas, converter em sequência e juntar o HTML (sugestões/avisos mesclados).
4. **Mensagens em PT-BR**: "Failed to fetch" vira "A conexão caiu durante a análise. Tente novamente." ; 429/402/403 mantêm as mensagens atuais; botão "Tentar novamente" no quadro de erro.

## Fora do escopo
Nenhuma mudança em banco, RLS, modelo de IA do workspace ou na importação de contratos firmados.

## Validação
- Testes unitários do parser de stream e da divisão em blocos.
- Playwright: importar o mesmo arquivo `CPS_M01_HEADHUNTER_EXCLUSIVIDADE_SUCESSO…` e confirmar que chega à tela de revisão com variáveis sugeridas.
