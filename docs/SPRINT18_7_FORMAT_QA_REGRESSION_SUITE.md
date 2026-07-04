# Sprint 18.7 — Format QA Regression Suite

## Objetivo

Evitar regressões de escopo como ameaças modernas aparecendo em jogos Vanilla antigos, Radical Red caindo em leitura de meta genérico ou Pokémon Champions perdendo o vínculo com seus Regulation Profiles.

Esta sprint adiciona uma auditoria executável para validar o contrato entre:

- Format Intelligence Layer;
- MetaDatabase;
- Vanilla Game Profiles;
- Radical Red Hardcore Boss Gauntlet Data Pack;
- Pokémon Champions Regulation Profiles;
- aliases de formato usados pela UI/API.

## Novo comando

```bash
npm run format:check
```

## Release check

O comando de release agora também executa a auditoria de escopo:

```bash
npm run release:check
```

Fluxo:

```txt
typecheck → data:check → format:check → frontend build
```

## Endpoint

```txt
GET /api/system/format-scope
GET /system/format-scope
```

Retorna o relatório JSON da auditoria, com checks, avisos e erros.

## O que é validado

### Vanilla por jogo

- As ameaças do MetaDatabase precisam respeitar o pool do jogo selecionado.
- FireRed/LeafGreen não pode carregar Kingambit, Great Tusk, Dragapult etc.
- Megas e formas regionais são bloqueadas quando o perfil do jogo não permite.
- Ameaças por jogo precisam carregar a tag `Game Pool Threat`.

### Radical Red

- Radical Red precisa permanecer como `boss_gauntlet`.
- Precisa usar boss data.
- Data pack precisa ser Hardcore/Restricted.
- Lorelei, Bruno, Agatha, Lance e Champion precisam existir.
- Ameaças do meta Radical Red precisam carregar tag `Boss Threat`.

### Pokémon Champions

- Champions Singles/Doubles precisam resolver para Regulation Set M-B.
- As ameaças do MetaDatabase precisam vir do Regulation Profile/Meta Source Pack.
- O sistema mantém aviso enquanto roster completo continuar `pending_full_import`.

### Aliases de formato

A auditoria valida aliases críticos como:

```txt
FireRed / LeafGreen → vanilla_fire_red
pokemon emerald → vanilla_emerald
radical red → radical_red
rr hardcore → radical_red
pokemon champions singles → champions_reg_m_b_singles
champions doubles → champions_reg_m_b_doubles
national dex → national_dex
```

## Resultado esperado

Enquanto os rosters de Pokémon Champions e alguns pools Vanilla ainda forem bootstrap/pending, é normal o relatório retornar `warning`, mas não `fail`.

Falhas devem bloquear release, porque indicam risco real de recomendação fora de escopo.
