# Alinhamento de autorização do TechERP

Iniciado por autorização do usuário em 23/10/2026. Abrange TechSales, TechHire,
TechPeople, TechContracts, TechProjects, TechFinance e áreas compartilhadas.
`techservice` é namespace legado, não um sétimo módulo.

## Fontes e estados

- `docs/security/permission-alignment.json`: decisões normativas das 32 regras
  levantadas e contratos explícitos das operações já tratadas.
- `docs/security/permission-route-inventory.csv`: 416 declarações de rota do
  inventário estático. Inclui layouts, APIs, retornos e redirecionamentos; não é
  contagem de telas distintas nem prova de enforcement.
- Código/SQL aplicados e testes de comportamento demonstram implementação;
  presença de uma chave em mapa/importação não demonstra autorização.
- Uma regra não fica concluída por código escrito. Distinguir preparado,
  testado, aplicado no banco, publicado e aceito no ambiente real.

## Decisão comum

Ator autenticado → membership ativo → workspace correto → permissão efetiva da
AÇÃO (deny prevalece) → escopo real da LINHA → proteção de CAMPOS → regras do
PROCESSO (alçada, estado, versões, período fechado, idempotência, consentimento).

Own é chave + vínculo de titularidade. Team é chave + equipe efetiva. Workspace
não ultrapassa tenant. Admin não é substituto genérico da ação e não deve anular
uma negativa explícita. Políticas permissivas se combinam por OR; a regra antiga
não pode continuar oferecendo uma alternativa que contorne a nova.

Exceções técnicas, pessoais, públicas por token, de plataforma e de serviço
precisam declarar identidade, alcance, validade e teste de negação. Não conceder
chaves novas a todos os cargos/workspaces como forma de fazer o teste passar.

## Sequência e estimativas iniciais

1. Matriz oficial incremental: inventário e sete contratos do primeiro lote
   registrados; ainda em andamento para as demais ações.
2. Riscos críticos: primeiro lote SQL (0191) aplicado e testado. Ainda pendentes
   configurações de pagamentos, NFS-e e reuniões. Próxima frente estimada em
   45–60 minutos, a atualizar antes de iniciar.
3. Servidor/RLS por módulo: priorizar TechPeople/TechHire, depois os demais;
   consolidar políticas, eliminar atalhos por owner/admin e escopos incorretos.
4. Interface e ações: menus/URL/abas/botões, projeção de campos, exportações,
   falhas de resolução e referências ausentes no catálogo.
5. Aceite dos cargos: permitido, sem chave, deny explícito, equipe/workspace
   diferente, inativo e URL/API direta. A sessão real de onboarding de Priscila
   não foi declarada validada pelos testes isolados.
6. Prevenção: checks automáticos da matriz e catálogo e cobertura obrigatória
   das novas funcionalidades na integração contínua.

Previsão inicial comunicada: primeira entrega em 60–90 minutos; conjunto em
3–5 dias de trabalho, dependente da quantidade de fluxos que precisarem ser
reconstruídos e do aceite real. São estimativas, não cronograma garantido nem
execução agendada em segundo plano. Cada nova frente exige sua própria previsão.

## Lote 0191 — aplicado

- Get entity field catalog é SECURITY INVOKER, autentica membro ativo no
  workspace selecionado e vincula p_owner_id ao ator. Service_role é exceção
  técnica explícita para filtros de campanhas. Retorna somente metadados e
  opções canônicas de enum/boolean, nunca amostras de linhas de negócio.
  Choices canônicos de pipelines/cadastros continuam no consumidor existente.
  Campos de texto sem cadastro canônico deixam de inferir opções por amostras.
- Anonimização nega ator NULL, inativo, workspace incorreto e View As somente
  leitura; exige compliance.delete.workspace E update de candidato em workspace
  ou próprio comprovado. Revoga consentimentos e registra auditoria atômica.
- Cinco helpers internos perdem EXECUTE para PUBLIC/anon/authenticated/API
  subject. Seus gatilhos SECURITY DEFINER preservam a execução como proprietário;
  service_role mantém o acesso de serviço.
- O teste do gatilho Silver Medalists revelou variável pool_id ambígua com
  plpgsql.variable_conflict=error. A variável local foi renomeada para v_pool_id,
  preservando a transição e ON CONFLICT. Correção necessária para validar o fluxo.

## Evidências e limites

101 verificações PostgreSQL passaram: 44 de RLS de RH, 15 de FK/salvamento e
42 de RPCs críticas. A fixture reproduziu as exposições anônimas antes da mudança
com dados sintéticos e rollback; depois confirmou bloqueios, escopos, denies,
registro de auditoria, recálculos de negócio/pagamento, seed de três modelos e
pool de recrutamento. Usa corpos reais selecionados dos helpers e triggers, mas
não é clone integral nem aceite de navegador/GoTrue/PostgREST.

Após aplicar, conferir EXECUTE, invoker/definer, hash da migração e hashes dos
overrides/memberships. Estes últimos permaneceram idênticos. Não houve publicação
de frontend: neste lote não há mudança de aplicação; a proteção SQL já está ativa.

Backups das definições/ACLs estão nos artefatos locais da auditoria. Em regressão,
priorizar correção progressiva ou contenção da porta afetada; nunca restaurar
EXECUTE anônimo para recuperar disponibilidade. Script de contenção:
`docs/security/0191-emergency-containment.sql` (não foi executado em produção).
