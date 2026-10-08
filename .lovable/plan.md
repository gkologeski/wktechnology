# Corrigir erro "permission denied" ao adicionar perfis

## Causa (confirmada no banco)
Quando o perfil foi revisado, a tabela de perfis ganhou três campos novos:
- item de linha de origem;
- cargo;
- preset.

Eles foram criados sem a permissão de gravação para usuários logados. Os demais campos têm essa permissão, então o banco recusa qualquer criação que preencha esses três campos — exatamente o que "Adicionar perfis" e "Criar 2 perfil(is)" fazem.

## Correção
- Pequena mudança no banco, só adicionando permissões:
  - liberar a gravação dos três campos na criação do perfil;
  - liberar a alteração do cargo e do preset quando você troca o título.
  - O item de linha de origem fica fixo depois de criado.
- As regras de acesso por workspace e por cargo continuam iguais. Nenhum dado é alterado.

## Verificação
- Conferir no banco que os três campos ficaram com a permissão certa.
- No navegador, no negócio de teste: abrir "Adicionar perfis", criar perfis a partir dos itens de linha e reabrir a tela sem duplicar. Remover em seguida os perfis criados no teste.
- Revisar as outras tabelas de perfis para descartar a mesma falha.

## Detalhes técnicos
Migração: `GRANT INSERT (source_line_item_id, job_profile_id, contracting_preset_id), UPDATE (job_profile_id, contracting_preset_id) ON public.deal_role_profiles TO authenticated;`
