# Sprint — VGC Mechanic Profiles

## Objetivo

Criar uma camada central de perfis mecânicos para que o Equinox deixe de depender apenas de tipos, stats e sets vindos do banco quando o usuário informa somente 3 Pokémon por nome.

A nova camada permite inferir intenção competitiva provável para Pokémon que habilitam ou abusam de:

- Trick Room
- clima
- terreno
- redirecionamento
- Tailwind
- controle de turno
- prioridade
- setup

## Arquitetura adicionada

### `src/equinox/vgc/VgcMechanicProfiles.ts`

Registry central com:

- tags mecânicas por Pokémon;
- confiança da função;
- função primária/secundária;
- família de clima/terreno quando aplicável;
- set VGC padrão quando o banco não fornece um set competitivo confiável.

Exemplo de intenção inferida:

```txt
Farigiraf → Trick Room setter + anti-priority support
Torkoal → Drought setter + Trick Room Sun abuser
Mawile-Mega → slow Trick Room physical damage + priority
Indeedee-F → Psychic Terrain + Follow Me + Trick Room support
Whimsicott → Prankster Tailwind + Sunny Day + Encore
```

## Integrações

### `VgcSetOptimizer`

Agora consulta `getPreferredVgcMechanicSet()` quando não há preset local mais específico. Isso evita fallbacks de singles ou genéricos em Pokémon com função VGC conhecida.

### `VgcTeamBuilding`

Agora usa os perfis mecânicos para:

- inferir papéis VGC;
- detectar arquétipos compostos;
- separar Trick Room Sun de Sun Offense comum;
- reconhecer Psychic Terrain Trick Room;
- reconhecer Rain Tailwind;
- detectar Terrain Balance/Offense;
- detectar redirection e Tailwind por intenção do Pokémon, mesmo quando o set não veio completo do usuário.

### `CombinationSearchEngine`

A verificação de conflito agora também entende perfis mecânicos, não apenas habilidade/move atual:

- conflito de climas;
- conflito de terrenos;
- Electric/Misty Terrain com plano de sono;
- abusers de clima/terreno incompatíveis com setter de outra família.

## Resultado esperado no caso crítico

Entrada:

```txt
Farigiraf
Mawile-Mega
Torkoal
```

Antes:

```txt
Sun Offense genérico
Farigiraf sem Trick Room
Torkoal com set de singles
Venusaur forçado por Drought
```

Agora:

```txt
Archetype: Trick Room Sun
Farigiraf: Trick Room / Psychic / Hyper Voice / Protect
Torkoal: Eruption / Heat Wave / Earth Power / Protect
Mawile-Mega: Play Rough / Iron Head / Sucker Punch / Protect
Lacuna crítica provável: Redirection
```

## Observação

O registry cobre os principais padrões competitivos conhecidos, mas foi desenhado para crescer de forma incremental. Para adicionar um novo Pokémon ou arquétipo, prefira incluir um perfil mecânico central em `VgcMechanicProfiles.ts` em vez de espalhar regras específicas por engines diferentes.
