# Substatus do lead e dados básicos na qualificação

Porte P/M. Estimativa: 1h30 a 2h no total. A única dependência é a sua aprovação deste plano.

## 1. Erro "O substatus pertence a outro pipeline" (cerca de 40 min)

**Causa (confirmada no banco):** o lead Alan Fuentes não tem funil nem etapa gravados, apenas o status antigo "contacted". A tela mostra "2. Em Contato" porque deduz a etapa pelo status. Ao salvar, ela envia só o substatus, e a regra do banco recusa porque o lead está sem funil. Outros 90 leads do workspace WK estão na mesma situação.

- **Ficha do lead:** ao escolher um substatus, o sistema também grava o funil padrão e a etapa que já aparece na tela, se o lead ainda não tiver esses dados.
- **Seletor rápido na lista de leads:** recebe a mesma correção, se usar o mesmo caminho.
- **Os 91 leads antigos:** o funil e a etapa serão preenchidos a partir do status atual. A etapa que aparece na tela, o substatus e o responsável não mudam.
- **Teste:** um teste automático cobre a regra "lead sem funil recebe funil e etapa ao definir substatus". Depois, no navegador, defino "Contato Estabelecido" no Alan Fuentes.

## 2. Nome, e-mail, telefone e WhatsApp na tela "Qualificar lead" (cerca de 1h)

**Causa (confirmada):** o questionário "Qualificação" só mostra os campos escolhidos em "Configurar campos". Hoje são: Empresa (domínio, nome, receita, setor, porte) e Contato (cargo, LinkedIn, telefone, celular). Nome, e-mail e WhatsApp não fazem parte da lista.

- Um bloco fixo **"Dados básicos"** passa a aparecer no topo, em todos os questionários: nome, sobrenome, e-mail, telefone e WhatsApp, já preenchidos com os dados do lead.
- Os campos podem ser editados, seguindo os padrões do sistema para e-mail e telefone. Ao salvar a qualificação, os dados vão para o lead e para o contato criado ou vinculado. Nenhum dado existente é apagado.
- Os campos configurados continuam iguais. Se telefone ou celular já estiverem no bloco do contato, não aparecem duas vezes.
- Correção de texto: "Dados do Empresa" passa a ser "Dados da Empresa".
- O artigo da Ajuda sobre qualificação será atualizado.
- **Verificação:** abro a qualificação de um lead no navegador e confiro os dados preenchidos e salvos.

## Detalhes técnicos
- Item 1: em `leads.$id.tsx` `setSubstatus`, incluir `pipeline_id` e `stage_id = currentStageValue` quando estiverem nulos. O gatilho `sync_stage_substatus` mantém o substatus quando os dois mudam no mesmo update. Revisar também `substatus-quick-picker.tsx` e `leads.tsx`. Backfill por migration (mapa status→etapa do funil padrão de leads). RLS e permissões não mudam.
- Item 2: em `qualification-entity-fields.tsx`/`qualification-panel.tsx`, bloco fixo antes dos blocos de `field_layout`, usando `EmailInput`/`PhoneInput`. Gravação pelo mesmo caminho de salvamento atual, sob as permissões existentes de edição de lead/contato. Remover duplicatas de `phone`/`mobile_phone`. O título vem do `field_layout`: corrigir o texto gerado e os dados salvos.
