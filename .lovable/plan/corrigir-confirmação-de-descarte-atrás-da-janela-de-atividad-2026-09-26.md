# Corrigir confirmação de descarte atrás da janela de atividade

## Diagnóstico confirmado

A janela flutuante de atividade/e-mail usa camada visual `z-[120]` e o alternador de janelas usa `z-[130]`. A confirmação padrão (`AlertDialog`) ainda usa `z-50` tanto no fundo quanto no conteúdo; por isso ela aparece atrás da janela e seus botões ficam inacessíveis, como mostrado na captura.

## Alteração

1. Elevar a camada do `AlertDialog` compartilhado para ficar acima das janelas flutuantes e do alternador, mantendo o fundo de bloqueio imediatamente abaixo da caixa de confirmação.
2. Aplicar a correção no componente base, cobrindo o descarte de rascunho de e-mail e WhatsApp e demais confirmações abertas sobre janelas flutuantes, sem alterar suas ações ou textos.
3. Preservar o comportamento atual de rascunho: **Cancelar** volta à janela; **Descartar** limpa o conteúdo e fecha conforme cada fluxo já define.

## Validação

- Abrir uma janela flutuante de e-mail com rascunho e confirmar que a caixa de descarte fica totalmente à frente e clicável.
- Repetir em WhatsApp.
- Conferir em desktop e celular, inclusive com mais de uma janela aberta.
- Validar foco pelo teclado, botão Cancelar, botão Descartar, fechamento por Escape e ausência de erros na página.
- Executar verificação de tipos, lint dos arquivos afetados e conferir o build da prévia.

## Escopo técnico

Somente a ordem visual do componente compartilhado de confirmação será alterada. Não haverá mudança em banco, permissões, regras de negócio ou persistência dos rascunhos.
