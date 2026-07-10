# Sprint — Format Solver Root Cause Refinement

## Objetivo

Corrigir a causa raiz das inconsistências após a separação inicial por solvers: o Equinox ainda estava permitindo que pontuações legadas e sets competitivos genéricos atravessassem os solvers específicos de formato.

## Causa raiz identificada

A arquitetura já tinha `VanillaSolver`, `RadicalRedSolver`, `ChampionsSinglesSolver` e `ChampionsDoublesSolver`, mas três problemas continuavam ativos:

1. **Scorers legados ainda eram somados após o solver do formato.**
   - `CandidateScoreEngine` ainda adicionava `RadicalRedGauntletScorer` e `ChampionsRegulationScorer` por fora do solver.
   - Isso permitia que rankings genéricos superassem contratos específicos do formato.

2. **Sets de Doubles/VGC vazavam para Singles, Radical Red e Vanilla.**
   - Exemplos: `Tailwind`, `Helping Hand`, `Follow Me`, `Rage Powder` e `Protect` como filler em Singles/adventure.
   - A partir deste patch, esses modos usam `SingleBattleSetOptimizer`.

3. **Mega Stone não materializava a forma Mega antes de resolver habilidade.**
   - Exemplo: `Swampert @ Swampertite` ainda podia ficar com `Torrent` porque o Pokémon continuava sendo tratado como `Swampert` durante a resolução de habilidade.
   - Agora Mega Stone transforma o set em sua forma Mega antes de validar habilidade.

## Solução aplicada

### 1. `SingleBattleSetOptimizer`

Novo arquivo:

```txt
src/equinox/utils/SingleBattleSetOptimizer.ts
```

Responsável por gerar/sanitizar sets para:

- Vanilla
- Radical Red
- Champions Singles

Ele remove movimentos de Doubles quando não fazem sentido para Singles/adventure e prioriza:

- STAB coerente;
- coverage compatível com o maior atributo ofensivo;
- pivôs;
- hazards/removal quando aplicável;
- presets singles para funções centrais.

### 2. `FormatObjectiveGuards`

Novo arquivo:

```txt
src/equinox/format-solvers/FormatObjectiveGuards.ts
```

Responsável por validar objetivos de formato de maneira sistêmica:

- clima base detectado;
- abuser primário do clima;
- conflito de climas;
- conflitos de terreno/sono;
- slots de singles como hazards/removal/pivot;
- objetivos de Radical Red e Vanilla sem herdar contratos de VGC.

### 3. Solvers passaram a sanitizar sets por formato

- `VanillaSolver` ignora sets competitivos salvos e usa set simples/adventure.
- `RadicalRedSolver` usa set singles/boss-gauntlet.
- `ChampionsSinglesSolver` usa set singles competitivo e Item Clause.
- `ChampionsDoublesSolver` continua usando VGC set optimizer.

### 4. CandidateScoreEngine deixou de somar scorers legados

Agora o solver do formato é a camada decisora principal.

### 5. CombinationSearchEngine usa guardrails de formato

Combinações finais passam por objetivo de formato antes de serem ranqueadas.

## Regra arquitetural resultante

```txt
Shared engines podem medir dados comuns.
Mas apenas o FormatSolver ativo pode decidir o que é bom para aquele modo.
```

