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
version: 4
is_published: true
---
# Importar contratos em lote e revisar resultados
**Para que serve:** Importar contratos em lote e revisar resultados.
**Quem pode fazer:** Gerenciamento de imports; pareamento exige links.manage e aditivos exigem atualização de contratos.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Arquivos válidos e principais identificados para os aditivos.

## Passo a passo
1. Clique em "Importar em lote", escolha o tipo ("Documento em elaboração" ou "Contrato legado / já formalizado") e, para legado, informe o motivo. Depois adicione os arquivos.
2. Por arquivo, escolha "Detectar com IA", "Prestação (cliente final)" ou "Compra (prestador)".
3. Escolha "Principal" ou "Aditivo". Para aditivo, indique principal existente ou principal do lote, número e vigência quando aplicável.
4. Clique em "Processar".
5. Confira o resultado de cada item e seus vínculos. Use "Abrir" para revisar rascunhos criados.
![Tela: Importar contratos em lote e revisar resultados, sem dados pessoais reais](/help-media/contracts/importar-em-lote.webp)

## Resultado esperado
Arquivos processados sequencialmente, com principais antes dos aditivos; resultados podem ser parciais.

## Regras e limites
- PDF até 15 MB e DOCX até 10 MB por arquivo.
- Nome/tamanho iguais evitam inclusão repetida na fila, não duplicação contra a base.
- A fila não tem teto explícito, mas o pareamento final aceita até 50 IDs. Lotes maiores podem criar rascunhos e falhar no pareamento.
- O papel escolhido manualmente é enviado como escolha manual; o detectado pela IA continua registrado como extraído.
- Falha de vínculo de aditivo não apaga o rascunho nem garante repetição automática desse vínculo.
- "Processamento concluído." não significa sucesso de todos os arquivos e vínculos.

## Erros comuns
Aditivo sem principal impede iniciar. Revise itens com erro antes de tentar novamente; não reimporte cegamente um rascunho já criado.

## Relacionados
- [Revisar vinculação](/ajuda/contracts/revisar-vinculacao)
- [Importar individualmente](/ajuda/contracts/importar-contrato)

## Lote legado
- Cada contrato é criado como legado pendente; nada é regularizado nem tem vigência decidida automaticamente. Revise cada um na ficha.
- Não há pareamento automático compra ↔ prestação. Aditivos só se vinculam ao principal que você escolher (existente ou do mesmo lote).
- Os originais são guardados obrigatoriamente; falha no envio deixa o item com erro, sem contrato.
- Reprocessar um item com erro reaproveita a mesma tentativa e o mesmo arquivo, sem duplicar.
- O tipo de importação fica travado depois que o processamento começa.
