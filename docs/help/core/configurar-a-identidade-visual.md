---
module_key: core
slug: configurar-a-identidade-visual
title: Configurar a identidade visual
summary: Escolher o layout Clássico ou Essencial e personalizar a marca do workspace.
article_type: howto
route_pattern: /settings/branding
min_permission: system.branding.view.workspace
audience: internal
sort_order: 116
version: 3
is_published: true
---

# Configurar a identidade visual

**Para que serve:** Configurar a identidade visual, no contexto da tela `/settings/branding`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.branding`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/branding`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo

1. Abra **Configurações → Workspace → White-label → Workspace (ERP)**.
2. No Construtor de marca, abra **Layout**.
3. Escolha **Clássico · atual** para manter a interface tradicional ou **Essencial · inspirado no Attio** para usar canvas aberto, controles discretos e menos caixas.
4. Em **Aparência do workspace**, escolha **Claro** ou **Escuro** para usar a paleta correspondente já configurada. Sem escolha anterior, o sistema mantém o modo claro.
5. Confira a prévia nas telas Ficha, Negócios, Dashboard e Inbox; alterne Claro/Escuro para comparar. Os dados da prévia são ilustrativos.
6. Clique em **Salvar alterações**. A alteração vale para o workspace atual e é recebida pelas sessões conectadas. Se necessário, recarregue a tela.
7. Para retornar, selecione **Clássico · atual** e salve. **Descartar** cancela somente as alterações ainda não salvas.

## Regras e limites

A troca de layout preserva logotipo, nome, cores, fontes, densidade e configurações salvas. As abas Marca, Modelos e Tema continuam disponíveis. Aplicar um modelo de cores preserva a escolha de layout, mas altera os atributos de estilo indicados na prévia do modelo.

Ao trocar de workspace, os rascunhos não salvos do White Label são descartados. Se o contexto mudar durante o salvamento, reabra o White Label antes de tentar novamente.

O layout estrutural é único por workspace. As personalizações de cores dos módulos continuam valendo, sem substituir o layout do workspace. Workspaces sem escolha explícita continuam no Clássico.

## Resultado esperado

No Essencial, a ficha mantém as propriedades à esquerda, a timeline no centro e as associações/jornada à direita. Listas, navegação e Inbox usam controles mais leves. Em telas menores os painéis continuam responsivos. A alteração de aparência não altera campos, vínculos, histórico ou ações disponíveis.

## Permissões

Consultar exige a permissão efetiva de visualização do White Label; salvar exige **system.branding.update.workspace**, além de membro ativo. Quem apenas consulta pode comparar a prévia, mas não salvar. A troca de tema não concede permissões nem altera aprovações ou documentos.

## Erros comuns

- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados

- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/branding com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/configurar-a-identidade-visual.webp)
