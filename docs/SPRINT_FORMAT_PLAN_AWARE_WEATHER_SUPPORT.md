# Sprint — Format Plan-Aware Weather Support

## Problema raiz

O Equinox separou os solvers por formato, mas ainda havia uma lacuna entre:

1. o plano inferido a partir do core do usuário;
2. a geração de sets para Pokémon informados apenas por nome;
3. a validação de candidatos antes da montagem final.

Isso fazia Pokémon de suporte com potencial mecânico, como usuários lentos de Prankster, receberem sets genéricos de disrupção mesmo quando o core já indicava um plano de clima.

## Correção sistêmica

A correção não trata um Pokémon específico. Ela adiciona contexto de plano ao pipeline de sets em Champions Doubles.

### Novas regras

- O plano de clima pode ser detectado por setter automático, por abuser primário ou por combinação de abuser + setter manual provável.
- Usuários lentos de Prankster com perfil de suporte podem ser tratados como setters manuais de clima quando o core já aponta para Rain, Sun, Sand ou Snow.
- A geração de set de Champions Doubles agora recebe `formatPlan` e pode ajustar o set para sustentar o arquétipo detectado.
- Esse comportamento fica restrito ao solver de Champions Doubles e não vaza para Vanilla, Radical Red ou Champions Singles.

## Exemplo esperado

Core:

```txt
Pelipper + Swampert-Mega + Sableye
```

Plano inferido:

```txt
Rain + weather_speed
```

Sableye, como suporte lento de Prankster, pode receber:

```txt
Sableye @ Light Clay
Ability: Prankster
Calm Nature
- Reflect
- Light Screen
- Rain Dance
- Quash
```

## Arquivos alterados

- `src/equinox/format-solvers/FormatSolver.ts`
- `src/equinox/format-solvers/FormatPlanResolver.ts`
- `src/equinox/format-solvers/ChampionsDoublesSolver.ts`
- `src/equinox/utils/VgcSetOptimizer.ts`
- `src/equinox/recommendation/CandidateScoreEngine.ts`
- `src/services/TeamService.ts`
