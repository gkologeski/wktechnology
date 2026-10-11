# Tirar o aviso de permissão da ficha do negócio para quem não acessa Perfis de vaga

## O que acontece hoje
- A ficha do negócio sempre mostra o quadro "Perfis de vaga" na coluna da direita.
- O quadro pede a lista ao servidor assim que a ficha abre.
- O perfil da Eduardo não tem a permissão de ver Perfis de vaga. O servidor recusa corretamente, e a recusa aparece como um aviso vermelho, mesmo sem a pessoa ter clicado em nada.

## O que muda
- Para quem **não tem** a permissão, o quadro "Perfis de vaga" deixa de aparecer na ficha. A lista não é pedida e o aviso não surge.
- Para quem **tem** a permissão, nada muda.
- A regra do servidor continua igual, sem afrouxar nada: quem não tem a permissão segue sem acesso aos dados.

## Validação
- Entrar em "Ver como" a Eduardo e abrir o mesmo negócio: o aviso não aparece e o quadro some.
- Abrir o mesmo negócio como administrador: o quadro aparece como antes.
- Rodar a verificação completa (tipos, lint e testes).

## Detalhes técnicos
- Em `src/routes/_authenticated/deals.$id.tsx`, envolver `RoleProfilesCard` com `usePermissions().can("techsales.role_profiles.view.workspace")`. Enquanto as permissões carregam, o quadro não é renderizado.
- Por segurança extra, adicionar ao `useQuery` de `role-profiles-card.tsx` um `enabled` com a mesma checagem, para outros pontos que usem o componente.
- Sem mudanças no servidor, no banco, em cargos ou permissões.
