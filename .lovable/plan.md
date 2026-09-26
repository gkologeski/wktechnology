# Confirmação de descarte de rascunhos de atividade

## Resultado esperado

Ao clicar em **Descartar rascunho** nas janelas de criação ou edição de atividades, abrir a confirmação do próprio TechERP, como no primeiro anexo: título **“Descartar rascunho?”**, explicação de que conteúdo e anexos serão removidos, botões **Cancelar** e **Descartar** em destaque destrutivo. A caixa nativa do navegador mostrada no segundo anexo não deve mais aparecer.

## Escopo

- Trocar a confirmação nativa nos formulários flutuantes de registro e edição de atividade (notas, tarefas, ligações, reuniões e demais tipos que usam esses formulários).
- Cancelar, fechar ou pressionar Esc na confirmação mantém o rascunho e seus anexos. Confirmar limpa o rascunho local e restaura os campos iniciais da janela, inclusive anexos adicionados nesta sessão; fechar a janela sem descartar continua preservando o rascunho.
- Manter o diálogo de e-mail, que já usa a confirmação visual do anexo, sem alterar seu envio ou descarte.
- Não modificar dados já salvos, regras de negócio, permissões ou banco.

## Detalhes técnicos

- Reutilizar `confirmDialog` e seu `AlertDialog` global já montado na raiz, com título, descrição, rótulos e variante destrutiva explícitos. A camada atual desse diálogo fica acima das janelas flutuantes.
- Aplicar a troca em `activity-log-window.tsx` e `activity-edit-window.tsx`; não criar uma segunda implementação de modal. Ao descartar edição, repor também responsável e lista de anexos originais, além de limpar novos arquivos.
- Verificar que o salvamento automático local não regrava o rascunho descartado por uma atualização pendente.

## Validação

- Testar em janela de atividade nova e em edição: Cancelar/Esc preserva texto; Descartar remove texto e anexos locais; fechar sem descartar restaura o rascunho ao reabrir.
- Conferir aparência e foco do diálogo acima da janela no desktop e no celular, incluindo tema claro/escuro, sem caixa do navegador.
- Revisar alterações e executar verificações direcionadas de tipos, lint e testes pertinentes; conferir o estado da prévia.
