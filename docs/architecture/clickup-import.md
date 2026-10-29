# Importação ClickUp → TechProjects

Tela: `/projects/settings/imports/clickup` (TechProjects › Configurações › Importar do ClickUp).

## Permissões
- `techprojects.clickup_import.view.workspace` — consultar a prévia e o resultado.
- `techprojects.clickup_import.manage.workspace` — ler o ClickUp, ajustar destinos e responsáveis, importar, completar responsáveis e desfazer.
- Avaliadas por `clickup_import_access` (membro ativo, deny prevalece, workspace selecionado). Nenhum cargo recebe as chaves automaticamente; administradores ativos têm acesso pelo bypass de administrador.
- "Ver como" em modo somente leitura não grava.

## Fluxo
1. **Ler o ClickUp**: hierarquia completa (workspaces, espaços, pastas, listas, sem arquivados) e tarefas com concluídas e subtarefas, 100 por página, respeitando o limite de requisições. Nada é gravado no TechProjects.
2. **Revisar**: aba Organização (espaço, projeto e nome da lista de cada lista do ClickUp; importar ou deixar fora) e aba Responsáveis (vínculo com pessoas do workspace).
3. **Importar**: cria espaços/projetos/listas que faltam e as tarefas (pais antes de subtarefas), em lotes de 300. Sem workflows. Pode ser retomada com "Continuar importação".
4. **Completar responsáveis**: depois de confirmar pessoas, preenche tarefas importadas sem responsável que ninguém editou.
5. **Desfazer importação**: remove tarefas, listas, projetos e espaços criados pela execução; mantém o que foi editado depois, tem horas ou subtarefa mantida.

## Regras da organização proposta (decisões do usuário, 29/10/2026)
- Workspaces de teste fora: FS - Cliente Exemplo, CS, OS - Logbit.
- WK Technology: Diretoria → espaço Diretoria (projeto por pasta); Gestão → espaço Gestão Técnica, projeto Gestão; Fábrica de Software → pastas Brooks no FS - Brooks, TechProjects - Interno no TechProjects, demais pastas viram projetos; Consultoria → espaço Consultoria, um projeto por pasta (Byteway é projeto novo, com o nome do ClickUp); Outsourcing → DEVs e Dailys no projeto OS - Controles internos.
- Workspaces de clientes → espaço OutSourcing, no projeto existente de mesmo nome (In Forma → OS - InForma, ActiveCorp → OS - Active).
- Horas não vêm do ClickUp.

## Execução de 29/10/2026 (workspace WK)
16.474 tarefas (395 subtarefas) em 42 listas, 12 projetos novos e 3 espaços novos; 9.842 tarefas com responsável; 3 pessoas do ClickUp sem cadastro no TechERP (84 tarefas sem responsável).
