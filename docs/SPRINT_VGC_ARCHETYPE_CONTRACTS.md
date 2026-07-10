# Sprint VGC Archetype Contracts

## Objetivo

Esta sprint remove a dependência de correções por combinação específica e adiciona uma camada sistêmica de contrato mecânico por arquétipo.

Antes, o Equinox podia corrigir um caso como `Farigiraf + Mawile-Mega + Torkoal`, mas ainda não tinha uma regra geral dizendo o que qualquer time de Trick Room, clima, terreno, redirection ou Tailwind precisa cumprir.

Agora, cada arquétipo possui um blueprint com:

- mecânicas críticas;
- mecânicas importantes;
- conflitos mecânicos;
- pontuação própria de contrato;
- impacto direto em candidatos, combinações e plano VGC final.

## Arquivo central

```txt
src/equinox/vgc/VgcArchetypeBlueprints.ts
```

Esse arquivo concentra a regra sistêmica. Ele não decide que “Farigiraf precisa de Amoonguss”; ele decide que `hard_trick_room`, `sun_trick_room` e `psychic_terrain_trick_room` precisam de:

- setter de Trick Room;
- abuser lento;
- proteção para colocar Trick Room;
- redirection/premium redirection quando o arquétipo pedir;
- controle de turno.

Com isso, qualquer Pokémon que preencha esses slots pode ser escolhido, desde que o banco tenha perfil mecânico ou informações suficientes de moves/abilities/stats.

## Contratos implementados

- Sun Offense
- Trick Room Sun
- Rain Offense
- Rain Tailwind
- Sand Balance
- Snow Balance
- Hard Trick Room
- Psychic Terrain Trick Room
- Terrain Balance
- Terrain Offense
- Tailwind Balance
- Setup + Redirection
- Bulky Offense
- Hyper Offense
- Balance

## Como funciona

### 1. Classificação de slots

Cada Pokémon é classificado em slots mecânicos, como:

```txt
weather_setter_sun
weather_abuser_sun_primary
trick_room_setter
trick_room_abuser
trick_room_protection
terrain_setter_psychic
terrain_abuser_psychic
tailwind_setter
redirection
premium_redirection
turn_control
speed_control
physical_damage
special_damage
```

A classificação usa:

- perfis do `VgcMechanicProfiles`;
- abilities;
- moves;
- stats;
- role text competitivo;
- tags de utilidade.

### 2. Validação por arquétipo

Depois que o arquétipo é detectado, o time é comparado com o blueprint desse arquétipo.

Exemplo: `Trick Room Sun` exige:

```txt
trick_room_setter
trick_room_abuser x2
weather_setter_sun
weather_abuser_sun_primary
trick_room_protection
```

Isso evita que um time com Torkoal seja automaticamente tratado como Sun Offense comum, quando o core sugere Trick Room.

### 3. Pontuação de candidato

`evaluateVgcMechanicCandidateFit` compara o contrato antes e depois da entrada de um candidato.

O candidato ganha pontos quando:

- fecha uma mecânica crítica ausente;
- fecha uma mecânica importante;
- reduz conflitos mecânicos;
- adiciona redirection premium em arquétipos que dependem de proteção.

O candidato perde pontos quando:

- introduz conflito de terreno/sono;
- disputa clima sem função clara;
- adiciona velocidade ofensiva incompatível com Trick Room;
- quebra o contrato mecânico do arquétipo.

### 4. Pontuação de combinação

`CombinationSearchEngine` agora usa o contrato mecânico antes de privilegiar score bruto.

Isso significa:

```txt
Time forte individualmente < Time que cumpre o contrato do arquétipo
```

## Resultado esperado

A ferramenta deixa de corrigir um erro individual e passa a seguir esta regra:

```txt
Detectar arquétipo → aplicar contrato mecânico → preencher lacunas → penalizar conflitos → só então ranquear força individual.
```

## Próximo passo recomendado

Expandir o `VgcMechanicProfiles.ts` com mais Pokémon por formato/meta, sem alterar o algoritmo. A arquitetura agora permite crescer o conhecimento competitivo adicionando dados, não criando exceções no motor.
