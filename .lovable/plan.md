# Associação automática de clientes na Inbox

## Objetivo
Ao receber uma nova mensagem, identificar o remetente dentro do mesmo workspace e associar a conversa a um **Contato** ou **Lead**, refletindo o vínculo na Inbox Unificada, WhatsApp, Email e Chat ao Vivo.

## Regras confirmadas
- **Contato tem prioridade** sobre Lead quando ambos corresponderem ao identificador recebido.
- Se houver mais de um registro correspondente dentro do mesmo tipo, a associação automática não será feita; a conversa ficará marcada como **ambígua** para escolha manual.
- A busca nunca atravessa workspaces e respeita registros ocultos/de teste.
- WhatsApp busca pelo número normalizado; Email e Chat ao Vivo usam e-mail quando disponível. O Chat continuará sem associação automática quando o visitante não informar uma identidade pesquisável.
- Nenhum Contato ou Lead será criado automaticamente.

## Implementação
1. **Centralizar a resolução de identidade**
   - Criar um serviço de servidor reutilizável para normalizar telefone/e-mail e procurar Contatos e Leads no workspace.
   - Comparar telefone por campos normalizados, incluindo telefone e celular.
   - Retornar um resultado explícito: Contato encontrado, Lead encontrado, ambíguo ou não encontrado.

2. **Persistir os vínculos e a ambiguidade**
   - Adicionar às conversas de WhatsApp e sessões de Chat o vínculo opcional com Lead.
   - Adicionar um estado/metadado de resolução suficiente para distinguir “não encontrado” de “mais de um resultado”.
   - Preservar os vínculos já existentes e nunca substituir automaticamente uma escolha manual válida.
   - Criar índices para as novas referências e manter RLS/GRANTs alinhados às políticas atuais.

3. **Aplicar em cada canal no recebimento**
   - **WhatsApp:** após resolver corretamente o workspace pelo número conectado, associar pelo telefone antes de concluir o upsert da conversa.
   - **Email:** ampliar a sincronização existente, que hoje procura apenas Contatos, para Contato primeiro e Lead como alternativa, com detecção de duplicidade.
   - **Chat ao Vivo:** ao criar/reutilizar uma sessão, associar pelo e-mail informado pelo visitante; preservar a sessão anônima quando não houver e-mail.
   - Manter idempotência, retry e distribuição automática já existentes.

4. **Atualizar a Inbox**
   - Exibir nome e tipo do registro associado em todas as listas e painéis de contexto.
   - Disponibilizar escolha manual quando a resolução for ambígua, usando apenas registros visíveis ao usuário.
   - Manter o telefone/e-mail como fallback quando não houver associação.
   - Invalidar as consultas relevantes após uma associação manual para atualizar todos os canais sem recarregar a página.

5. **Cobertura de dados existentes**
   - Executar backfill seguro somente para conversas sem vínculo e com correspondência única.
   - Não alterar conversas ambíguas; apenas sinalizá-las para revisão.
   - Registrar contagens de vinculados, não encontrados e ambíguos sem expor dados pessoais em logs.

## Detalhes técnicos
- O webhook do WhatsApp já é autenticado e idempotente; a mudança ficará no processador existente.
- A tabela de Email já possui `contact_id` e `lead_id`; WhatsApp possui apenas `contact_id`, e Chat possui apenas `contact_id`.
- A busca atual do WhatsApp no envio usa igualdade textual com/sem `+`; será substituída por resolução normalizada e compartilhada.
- O roteamento do workspace no WhatsApp será confirmado pelo cadastro do número conectado antes da associação, evitando inferência entre workspaces.
- As alterações de banco serão aditivas, com chaves estrangeiras, índices, GRANTs e RLS preservados.

## Validação
- Testes unitários da prioridade Contato → Lead, normalização, nenhum resultado e ambiguidades.
- Testes de integração para recebimento nos três canais, repetição idempotente e isolamento entre workspaces.
- Teste de regressão para garantir que vínculo manual não seja sobrescrito.
- Playwright na Inbox Unificada e nas telas de WhatsApp, Email e Chat: mensagem identificada, fallback sem vínculo e seleção manual em caso ambíguo.
- Revisão de diff, lint, testes focados e compilação automática antes da entrega.

## Fora do escopo
- Criar automaticamente Contatos ou Leads.
- Mesclar registros duplicados.
- Alterar regras de distribuição, envio, permissões ou design geral da Inbox.
