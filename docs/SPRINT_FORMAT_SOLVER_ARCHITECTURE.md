# Sprint — Format Solver Architecture

## Objetivo

Separar o conhecimento compartilhado do Equinox dos critérios de decisão específicos de cada modo de jogo. O objetivo é evitar que regras de Champions Doubles/VGC contaminem Vanilla, Radical Red ou Champions Singles.

## Escopo do produto

O Equinox passa a trabalhar com quatro famílias principais:

- Vanilla
- Radical Red
- Pokémon Champions Singles
- Pokémon Champions Doubles

Pokémon Showdown/National Dex foi removido do escopo principal do produto. Aliases antigos ficam como fallback seguro para Champions Singles, mas não recebem mais solver próprio nem UI dedicada.

## Arquitetura entregue

### Shared Battle Engine

Camadas reaproveitáveis entre modos:

- normalização de nome, forma e espécie;
- validação de habilidade, item e Mega Stone;
- cobertura ofensiva e defensiva;
- fraquezas acumuladas;
- roles gerais;
- sanitização de set;
- geração de kit quando o usuário informa apenas nomes.

### Format Solver Registry

Novo registry:

```txt
src/equinox/format-solvers/FormatSolverRegistry.ts
```

Ele roteia cada formato para um solver dedicado:

```txt
VanillaSolver
RadicalRedSolver
ChampionsSinglesSolver
ChampionsDoublesSolver
```

## Solvers

### VanillaSolver

Critério principal: campanha simples e fácil de usar.

Prioriza:

- cobertura ofensiva;
- redução de fraquezas coletivas;
- variedade de tipos;
- velocidade suficiente;
- sets simples.

Não aplica contratos de VGC/Doubles.

### RadicalRedSolver

Critério principal: consistência do time completo de 6 contra bosses, Elite 4 e campeão.

Prioriza:

- score da boss gauntlet;
- pior matchup;
- consistência média contra chefes;
- respostas defensivas e ofensivas para ameaças estáticas.

Não aplica lead 2, redirection obrigatório ou modos de 4.

### ChampionsSinglesSolver

Critério principal: time competitivo single de 6.

Prioriza:

- hazards;
- hazard removal;
- pivots;
- speed control;
- win conditions;
- núcleo defensivo;
- Item Clause e Mega Clause.

Não aplica contratos de VGC/Doubles.

### ChampionsDoublesSolver

Critério principal: batalha dupla competitiva.

Prioriza:

- contratos de arquétipo;
- lead de 2;
- modos de 4;
- Trick Room;
- Tailwind;
- redirection;
- clima;
- terreno;
- turn control;
- Item Clause e Mega Clause.

## Mudanças técnicas principais

- `TeamService` agora resolve um `FormatSolver` por requisição.
- Sets do core base e dos candidatos passam pelo solver do formato, não sempre por `optimizeVgcSet`.
- `CandidateScoreEngine` recebe o solver e aplica bônus/penalidades específicas do modo.
- `CombinationSearchEngine` recebe o solver e só usa contratos Doubles quando o solver é `ChampionsDoublesSolver`.
- Item Clause agora é decidida por solver.
- UI removeu a família Pokémon Showdown/Competitivo do seletor principal.

## Regra de arquitetura

```txt
Conhecimento compartilhado pode ser global.
Critério de decisão nunca deve ser global.
```

