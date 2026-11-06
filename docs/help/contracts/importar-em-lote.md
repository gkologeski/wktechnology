---
module_key: contracts
slug: importar-em-lote
title: Importar contratos em lote e revisar resultados
summary: Importar contratos em lote e revisar resultados no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts
min_permission:
audience: internal
sort_order: 24
version: 1
is_published: true
---
# Importar contratos em lote e revisar resultados
**Para que serve:** Importar contratos em lote e revisar resultados.
**Quem pode fazer:** Gerenciamento de imports; pareamento exige links.manage e aditivos exigem atualização de contratos.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Arquivos válidos e principais identificados para os aditivos.

## Passo a passo
1. Clique em "Importar em lote" e adicione os arquivos.
2. Por arquivo, escolha "Detectar com IA", "Prestação (cliente final)" ou "Compra (prestador)".
3. Escolha "Principal" ou "Aditivo". Para aditivo, indique principal existente ou principal do lote, número e vigência quando aplicável.
4. Clique em "Processar".
5. Confira o resultado de cada item e seus vínculos. Use "Abrir" para revisar rascunhos criados.
<!-- screenshot: Importar contratos em lote e revisar resultados, sem dados pessoais reais -->

## Resultado esperado
Arquivos processados sequencialmente, com principais antes dos aditivos; resultados podem ser parciais.

## Regras e limites
- PDF até 15 MB e DOCX até 10 MB por arquivo.
- Nome/tamanho iguais evitam inclusão repetida na fila, não duplicação contra a base.
- A fila não tem teto explícito, mas o pareamento final aceita até 50 IDs. Lotes maiores podem criar rascunhos e falhar no pareamento.
- Papel manual prevalece sobre a IA. Sem papel extraído, o automático assume Prestação.
- Falha de vínculo de aditivo não apaga o rascunho nem garante repetição automática desse vínculo.
- "Processamento concluído." não significa sucesso de todos os arquivos e vínculos.

## Erros comuns
Aditivo sem principal impede iniciar. Revise itens com erro antes de tentar novamente; não reimporte cegamente um rascunho já criado.

## Relacionados
- [Revisar vinculação](/ajuda/contracts/revisar-vinculacao)
- [Importar individualmente](/ajuda/contracts/importar-contrato)
