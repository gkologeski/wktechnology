# Mostrar o telefone completo na fila de revisão

**Porte P — estimativa de 15 a 30 minutos.**

## O que muda
- Na tela Telefones, a coluna "Valor gravado" passa a mostrar o número inteiro, como está gravado no cadastro (sem asteriscos).
- O texto da coluna "Detalhe" também mostra as sugestões completas (ex.: "candidato +55 51 99301-6927").
- Continua visível só para administradores do workspace, como hoje. Nenhum telefone é alterado.

## Detalhes técnicos
- `phone-settings.functions.ts`: enviar `original_value` sem `maskPhone` (campo `masked` vira `value`); o acesso continua restrito ao admin ativo do workspace no servidor.
- `phone-review.ts`: trocar `maskPhone` por exibição completa nas mensagens de detalhe; ajustar testes que esperam máscara.
- `settings.phones.tsx`: exibir o novo campo.
- Validação: testes de telefone, typecheck, lint e conferência logada da tela com Playwright.
