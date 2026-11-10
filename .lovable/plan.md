# ANEXO-NOTA — Salvar nota com anexo dá "Connection timed out"

Porte P, estimativa 30–60 min (diagnóstico confirmado + correção + teste na tela).

## O que acontece
Ao clicar em "Salvar Nota" com anexo, o app pede ao banco um caminho para o arquivo e confere a permissão de envio. Antes de liberar, essa conferência procura em **todas as atividades** (e nos e-mails) se o arquivo já está anexado em alguma. Essa busca percorre a tabela inteira e passa do tempo limite, então o anexo falha e a nota não é salva.

Diagnóstico ainda a confirmar: a regra foi lida no banco, mas a lentidão será medida no passo 1 antes de mudar algo.

## Passos
1. Medir a busca de anexos (plano de execução) na tabela de atividades e de e-mails para confirmar a varredura completa.
2. Nova migração aditiva: índice de busca na lista de anexos de atividades e de mensagens de e-mail. Nenhuma regra de permissão muda; o resultado da conferência continua idêntico, só fica rápido.
3. Mensagem de erro na janela da nota: se o anexo falhar, mostrar "Não foi possível enviar o anexo X. Tente novamente." e manter o rascunho (hoje já mantém).
4. Testar na tela: salvar a nota "Orçamento do Projeto" com o .docx no negócio CT/NEXID e conferir o anexo na linha do tempo.

## Detalhes técnicos
- Causa provável: `shared_storage_object_access` executa `activities.attachments @> jsonb_build_array(jsonb_build_object('path',p))` sem índice (mesmo para e-mails).
- Migração: `CREATE INDEX IF NOT EXISTS ... USING gin (attachments jsonb_path_ops)` em `activities` e `email_messages`. Sem alteração de RLS, GRANT ou funções.
- Sem mudança de tela relevante; Ajuda e permissões não mudam (registrar classificação no contrato de permissões se algum arquivo for tocado).
- Validações: permissions:check, testes de timeline, build, Playwright.
