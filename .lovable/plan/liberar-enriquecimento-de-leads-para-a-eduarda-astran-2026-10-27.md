# Liberar enriquecimento de leads para a Eduarda Astran

Porte P — estimativa 20–30 min.

## Diagnóstico (confirmado por leitura)
- O botão "Buscar" (LinkedIn) em "Criar lead" chama rotinas que exigem a permissão **Enriquecimento** (`techsales.prospecting_enrichment`): **ver** para buscar a prévia e **gerenciar** para aplicar os dados após criar o lead.
- Eduarda Astran é membro **ativo** da WK com o cargo **"Representante de Vendas (externa)"**.
- Esse cargo **não tem nenhuma permissão de Enriquecimento** (nem padrão, nem pacote, nem ajuste da WK). Por isso aparece "Sem permissão para esta ação comercial."
- O mesmo cargo é usado por 2 contas na WK (a outra é a Eduarda Morais, hoje **inativa**, que continua sem acesso por estar inativa).

## O que será feito
1. Adicionar, **só no workspace WK**, um ajuste local de permissão (allow) no cargo "Representante de Vendas (externa)":
   - Enriquecimento — Visualizar (escopo: próprios)
   - Enriquecimento — Gerenciar (escopo: próprios)
   Escopo "próprios" = ela só enriquece leads que ela mesma criou ou pelos quais é responsável.
2. Fazer pelo mecanismo oficial de ajustes por workspace (sem alterar o cargo global, outros workspaces, admins/owners ou dados de leads). Negações explícitas continuam prevalecendo.
3. Validar com a sessão da Eduarda (somente leitura): conferir que as duas permissões aparecem como efetivas e que a busca do LinkedIn deixa de ser negada, sem criar lead real. Confirmar também que a conta inativa segue sem acesso.

## Fora do escopo
- Não alterar outros cargos (observação: "Gerente Comercial" tem só a chave antiga de visualização; posso revisar depois se quiser).
- Não publicar.

## Detalhes técnicos
- Inserção em `job_role_permission_overrides` (workspace WK, role `a88b68ee…`, effect allow) para `techsales.prospecting_enrichment.view.own` e `.manage.own`, via migration nova (dados de configuração RBAC, não de clientes).
- Verificação via `sales_area_authorize` com a sessão dela e `current_user_permissions()`.
- Alternativa caso prefira escopo maior: `.team` ou `.workspace`.
