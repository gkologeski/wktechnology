# Rótulos do formulário de atividades

## Objetivo
Na janela de atividade mostrada na imagem, substituir os textos:
- “Assunto (opcional)” por “O que você vai fazer?”
- “Atalhos de vencimento” por “Quando você fará?”

## Escopo
Alterar apenas o texto exibido no campo de assunto do compositor da timeline e no seletor compartilhado de vencimento das atividades. O segundo rótulo também aparecerá nos demais formulários de atividade que usam esse seletor. Manter o “Assunto (opcional)” do construtor de workflows, que é outro fluxo.

## Detalhes técnicos e validação
Editar os dois textos em `timeline-composer.tsx` e `activity-date-time-picker.tsx`, sem alterar valores, datas, comportamento ou salvamento. Conferir os rótulos na janela de tarefa e nos outros usos do seletor; revisar diff, qualidade e compilação da prévia.
