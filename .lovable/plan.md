# Responsáveis do HubSpot como usuários inativos + filtro com Ativos/Inativos

## Situação atual (conferida no banco)
- Há 51 responsáveis vindos do HubSpot, e só 3 estão ligados a um usuário do TechERP. Dos 48 sem vínculo, 39 estão arquivados no HubSpot.
- Hoje o TechERP não tem o conceito de usuário inativo: quem é membro do workspace tem acesso.
- Quatro pessoas aparecem repetidas no filtro, como usuário e também como responsável do HubSpot com o mesmo nome: Marketing WK Technology, Andressa Wolf Kologeski, Sabrina Maciel e Priscila Alves do Nascimento.
- O filtro lateral "Responsável" (Leads, Contatos, Empresas, Tickets e Tarefas de projetos) mostra tudo numa lista única, só com "(arquivado)" no nome.

## O que muda

### 1. Usuário inativo
- Todo membro do workspace passa a ter a situação **Ativo** ou **Inativo**. Os membros de hoje continuam ativos.
- Um usuário inativo:
  - não recebe convite e não consegue entrar no sistema;
  - não conta como usuário do plano;
  - não aparece para escolha como responsável em registros novos;
  - continua aparecendo como responsável nos registros antigos e nos filtros.
- Administradores podem reativar e desativar usuários em Configurações › Usuários. Reativar libera o acesso pelo fluxo de convite normal.

### 2. Cadastrar os responsáveis do HubSpot
- Um botão em Configurações › Usuários do HubSpot, "Criar usuários inativos", processa todos os responsáveis ainda sem vínculo, ativos e arquivados.
- Se já existe um usuário com o mesmo e-mail ou nome, o responsável é **ligado a esse usuário**, sem criar outro. Isso resolve os quatro repetidos.
- Se não existe, cria um usuário **inativo** com o nome e o e-mail do HubSpot e já faz o vínculo.
- Ficam de fora, com o motivo listado no resumo:
  - robôs do HubSpot, como o e-mail "aichatbot" do Thobias;
  - responsáveis sem e-mail.
- Ao final aparece um resumo: quantos foram ligados, quantos foram criados e quantos foram ignorados.
- Rodar o botão de novo não duplica nada. A sincronização do HubSpot continua como está.

### 3. Filtro de Responsável
- "Sem responsável" continua no topo.
- **Ativos** vem aberto e **Inativos** vem fechado. Cada grupo mostra a quantidade e quantos estão marcados; se houver um inativo marcado, o grupo abre sozinho.
- Cada pessoa aparece uma só vez. Marcá-la filtra os registros do usuário e também os que vieram do HubSpot em nome dela.
- Os filtros salvos continuam funcionando.

## Fora do escopo
- O filtro rápido da barra da grade não muda. Ele continua mostrando só usuários ativos.
- Não mesclar automaticamente nomes diferentes com e-mail digitado errado (ex.: "eduada...@wktecnology").
- Não mudar a forma como os registros guardam o responsável.

## Detalhes técnicos
- **Migration:** `workspace_members.status text not null default 'active'`, com validação `active|inactive` via trigger. `is_workspace_member` e as funções de licença/assentos passam a ignorar `inactive`. É uma mudança em função de segurança, conservadora: remove acesso de quem está inativo e não concede nada novo. As policies de RLS não mudam.
- **`provisionHubspotOwnerUsers`** (server fn, apenas para administradores do workspace, verificado com `is_workspace_admin`):
  - `supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, ban_duration: '876000h', user_metadata: { full_name, source: 'hubspot' } })`, sem senha e sem convite;
  - `profiles.full_name` e `workspace_members` com `role='member'` e `status='inactive'`;
  - `hubspot_owners.mapped_user_id` recebe o usuário;
  - a correspondência usa e-mail e depois nome normalizado (sem acento, minúsculas);
  - é idempotente.
- **Reativar/desativar:** server fn para administradores. Atualiza `status` e remove ou aplica o banimento; reativar envia o convite padrão.
- **`listWorkspaceMembers`** retorna `status`, e os seletores de atribuição filtram `active`.
- **`src/lib/owner-filter-options.ts`** (puro e testado): agrupa usuários e responsáveis do HubSpot por e-mail/nome normalizado. Cada grupo tem `ids[]` (uuid + `hs:<id>`), e `active` vem do membro ou do status do HubSpot.
- **`owner-filter.tsx`:**
  - `Collapsible` com `aria-expanded`;
  - a caixa de seleção do grupo fica marcada, parcial ou vazia conforme os `ids`;
  - o ponto laranja passa a usar token semântico.
- **Testes e verificações:** testes unitários de agrupamento, correspondência e idempotência. Depois: typecheck, lint e os testes de valores fixos.
- **No navegador:** rodar o cadastro, ver o resumo, abrir e fechar os grupos em /leads e marcar uma pessoa que estava repetida.
