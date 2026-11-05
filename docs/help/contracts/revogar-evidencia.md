---
module_key: contracts
slug: revogar-evidencia
title: Consultar comprovante e revogar evidência de assinatura
summary: Consultar comprovante e revogar evidência de assinatura no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 38
version: 1
is_published: true
---
# Consultar comprovante e revogar evidência de assinatura
**Para que serve:** Consultar comprovante e revogar evidência de assinatura.
**Quem pode fazer:** Leitura de signature_evidence; para revogar, gerenciamento e capacidade do servidor.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Identificar a evidência correta e justificar a revogação.

## Passo a passo
1. Abra o card de assinatura na ficha.
2. Consulte a evidência e abra o comprovante quando disponível.
3. Quando necessário, clique em "Revogar evidência".
4. Informe "Motivo" com pelo menos 10 caracteres.
5. Clique em "Revogar" e confira o resultado.
<!-- screenshot: Consultar comprovante e revogar evidência de assinatura, sem dados pessoais reais -->

## Resultado esperado
Evidência revogada com motivo registrado; a revogação não deve ser confundida com exclusão do contrato.

## Regras e limites
- Comprovante respeita o acesso ao contrato/evidência.
- Revogar é ação distinta de editar status ou cancelar documento de assinatura.

## Erros comuns
"Comprovante indisponível no seu acesso." ou "Não foi possível abrir o PDF.": confira sua autorização e a disponibilidade do arquivo.

## Relacionados
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)
