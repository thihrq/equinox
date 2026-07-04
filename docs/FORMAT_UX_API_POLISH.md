# Sprint 18.1.4 — Format UX + API Polish

## Objetivo

Reduzir a carga cognitiva da sidebar e corrigir riscos de rota/API em ambientes locais.

## Decisões

- `Vanilla` deixou de ser um formato executável genérico na UI principal.
- O usuário escolhe primeiro a família `Vanilla` e depois o jogo oficial desejado.
- O formato enviado ao backend é sempre um perfil real, por exemplo `vanilla_fire_red` ou `vanilla_emerald`.
- `Radical Red` permanece como perfil Hardcore / Restricted Boss Gauntlet.
- `Pokémon Champions` vira família visual com seleção interna Singles/Doubles.
- O seletor PT/EN saiu da sidebar e foi movido para o header ao lado do toggle de tema.
- `Permitir lendários` e `Gerar sinergia` foram reposicionados logo abaixo dos três Pokémon base.

## Compatibilidade de API

A rota canônica continua sendo:

```txt
POST /api/team/suggest
```

Foram adicionadas rotas de compatibilidade para ambientes locais com `VITE_API_BASE_URL` divergente:

```txt
POST /team/suggest
POST /api/api/team/suggest
```

O frontend também normaliza URLs quando `VITE_API_BASE_URL` já termina em `/api`.
