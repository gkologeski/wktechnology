## Diagnóstico

No **preview ativo** (`id-preview--68dcfa85…lovable.app`):
- `/sourcing` responde **HTTP 200** e a rota está registrada no `routeTree.gen.ts`.
- A sidebar do TechHire **já mostra** o grupo **Sourcing** com Talent Pools, Sequências e Indicações (validado via JS no DOM atual do seu navegador).

Ou seja, no preview tudo está no ar. O sintoma "não funciona / não há menus novos" só bate com **outra origem** que ainda não recebeu o último build:

- `https://wktechnology.lovable.app` (publicado)
- `https://ats.wktechnology.com.br` (domínio custom — aponta para o publicado)

Como o domínio custom serve a versão **publicada**, e o último publish foi anterior a toda a entrega do Slice 2 (Sourcing, Pools, Sequências, Referrals, Notetaker etc.), nada disso aparece lá.

## Plano

Republicar o app para que as rotas e menus novos fiquem disponíveis nos domínios publicado e custom (`ats.wktechnology.com.br`).

Passos:

1. Confirmar com você que quer publicar a versão atual (estamos no preview com todas as entregas recentes: Sourcing completo, Notetaker, Wave 5 Slice 1/2, redesign Quiet Premium, correções de timeline, etc.).
2. Acionar **Publish** pelo painel do Lovable (botão abaixo).
3. Após o publish concluir, validar:
   - `https://wktechnology.lovable.app/sourcing` carrega.
   - `https://ats.wktechnology.com.br/sourcing` carrega.
   - Sidebar do TechHire mostra o grupo **Sourcing** com **Talent Pools**, **Sequências** e **Indicações**.
   - `/notetaker`, `/dei-analytics`, `/insights` também respondem.

Nenhuma alteração de código é necessária — o código já está correto no preview. Se após o publish ainda faltar algo, aí sim investigamos como bug de rota/sidebar.

## Como você pode publicar agora

<presentation-actions>
<presentation-open-publish>Publicar app</presentation-open-publish>
</presentation-actions>

## Se você quiser que eu mexa em código

Me confirme qual URL exata você está abrindo quando vê o erro. Se for o preview (`id-preview--…`) e mesmo assim faltar o menu, eu abro investigação (cache do navegador, service worker antigo, permissão de role específica filtrando o grupo, etc.) antes de propor alteração.