# Perfis de vaga

- Perfis de vaga do negócio (`src/lib/role-profiles/`): aprovar/encaminhar/sincronizar só por RPCs `role_profile_*` (versão imutável, 1 requisição TechHire por perfil, trigger barra atalhos); comercial interno em tabela própria e cliente/TechHire só por allowlist (`toClientView`/`toAtsJob`); por quê: sem duplicar vagas nem vazar custo/margem.
