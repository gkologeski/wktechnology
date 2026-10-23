# Contrato obrigatório de autorização de novas funcionalidades

Decisão permanente do usuário em 23/10/2026. Aplica-se a TechSales, TechHire,
TechPeople, TechContracts, TechProjects, TechFinance e áreas compartilhadas.
Não é uma concessão automática de acesso nem altera os cargos existentes.

## Antes de implementar

1. Identificar a tela/rota, abas, dados sensíveis e TODAS as ações acessíveis,
   inclusive URL direta, API/RPC, importação, exportação, envio, publicação,
   aprovação, atribuição e operações de IA/integrações que geram custo.
2. Declarar uma matriz recurso × ação × escopo. Reutilizar uma chave somente
   se representar o mesmo recurso/ação/escopo; criar as demais em `permissions`
   com rótulo e descrição em português, visíveis em `/settings/permissions`.
   Os enums existentes precisam ser respeitados: uma ação especial pode ser
   representada por recurso específico e ação existente, sem inventar chave
   inválida nem esconder a distinção de negócio.
3. Definir quem pode receber cada permissão. Defaults são presets, não uma
   autorização para conceder a todos; preservar overrides, denies e isolamento
   de workspace. Documentar os bypasses administrativos já existentes.
4. Registrar o vínculo da tela e das ações com a permissão REALMENTE exigida.
   Mapas usados somente por diagnóstico não constituem controle de acesso.

## Implementação

- Negar por padrão, inclusive quando a resolução de acesso falhar.
- UI: controlar navegação, URL direta, abas, botões, campos e estados de loading.
- Servidor: revalidar ator, membership ativo, workspace, ação e escopo em cada
  operação, antes de ler dados privilegiados ou executar efeitos externos.
- Banco: aplicar RLS/GRANT/RPC coerentes com o servidor. Políticas permissivas
  combinam-se por OR: uma regra ampla não pode anular a regra granular.
- SECURITY DEFINER/service_role: não confiar na UI ou em UUID fornecido pelo
  chamador. Verificar autorização e tenant; limitar EXECUTE a quem precisa.
  Sempre tratar ator NULL explicitamente; `owner <> auth.uid()` sozinho não
  nega uma sessão anônima, pois a comparação pode resultar em NULL.
- Escopo own exige o predicado de titularidade apropriado; não pode conceder
  acesso a qualquer linha do workspace apenas por possuir a chave `.own`.
- Proteger dados hidden/masked/readonly antes de retorná-los/gravar, incluindo
  APIs, exportações, arquivos e URLs assinadas. Máscara visual não protege o dado.
- Aprovações, alçadas, estado/versão do registro, idempotência e limites técnicos
  são regras adicionais à autorização, e não substitutos dela.
- Fluxos públicos por token, pessoais, de plataforma ou de serviço têm exceção
  explícita: definir mecanismo, escopo, validade, revogação, anti-replay quando
  aplicável e teste de negação. Não os classificar como livres de controle.

## Aceite obrigatório

Testar usuário permitido, sem chave, com deny explícito, usuário de outro
workspace e membro inativo. Conferir URL direta e chamada de servidor sem UI,
leitura/criação/edição/exclusão/ações especiais, own/team/workspace conforme
aplicáveis e proteção de campos/arquivos. Não testar destrutivamente dados reais.

Atualizar a matriz Permissões × Telas × Ações e anexar evidências. Uma tela nova
não está concluída enquanto a autorização não estiver implementada e validada.
Alterações no catálogo exigem migração versionada, sem concessões indiscriminadas.

## Estado da auditoria de 23/10/2026

A auditoria foi de leitura de código e metadados do banco. O relatório externo
`outputs/permissoes-telas-2026-10-23/` na tarefa Codex contém a matriz e as
pendências encontradas. Não representa correção das lacunas nem execução de
ataques em produção. Nenhum dado, grant, policy ou cargo foi alterado pela auditoria.
