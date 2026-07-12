# Sprint — Format Plan Resolver

## Objetivo

Corrigir a causa raiz em que o Equinox criava solvers por formato, mas ainda deixava a seleção inicial de candidatos e os guardrails de formato trabalharem com leituras diferentes do plano do core escolhido pelo usuário.

## Problema sistêmico encontrado

O motor já tinha `VanillaSolver`, `RadicalRedSolver`, `ChampionsSinglesSolver` e `ChampionsDoublesSolver`, porém a identificação de plano ficava distribuída em vários pontos:

- `CandidateSelector` ainda selecionava candidatos principalmente por BST antes do solver atuar.
- `FormatObjectiveGuards` tinha uma leitura própria de clima/terreno.
- `VgcTeamBuilding` tinha outra leitura de arquétipo.
- `CandidateScoreEngine` só recebia candidatos que sobreviveram ao corte inicial.

Isso permitia que candidatos fora do arquétipo entrassem cedo no funil e que candidatos mecânicos importantes ficassem de fora.

## Solução aplicada

Foi criado um resolvedor central:

```txt
src/equinox/format-solvers/FormatPlanResolver.ts
```

Ele passa a identificar, a partir do core base já normalizado:

- clima primário;
- confiança do plano de clima;
- plano de velocidade;
- sinais mecânicos relevantes.

Também expõe validações reutilizáveis para:

- candidato contra plano travado;
- time final contra plano travado;
- setter/abuser/suporte de clima;
- conflito de clima;
- conflito terrain + sono;
- suporte de turno, pivot e redirection.

## Integrações

### CandidateSelector

Agora recebe:

- `baseTeam`;
- `formatSolverMode`.

Com isso, o corte inicial de candidatos já considera o plano travado. Exemplo: se o core base for Rain, candidatos com Swift Swim, suporte de Rain, turn control ou redirection sobem antes do corte por limite.

### FormatObjectiveGuards

Agora combina as validações antigas com a validação central do `FormatPlanResolver`, evitando múltiplas fontes de verdade.

### TeamService

Agora registra no log o plano travado:

```txt
[Equinox] LockedFormatPlan mode=... weather=... speed=... confidence=...
```

Isso facilita depurar quando o frontend ou a recomendação parecerem não seguir o arquétipo esperado.

### VGC Rain preset

Adicionado preset de Doubles para `Pelipper`, evitando set genérico com `Weather Ball` e mantendo função clara de Rain Setter + Tailwind.

## Resultado esperado

Para um core como:

```txt
Pelipper + Swampert-Mega + Sableye
```

O log deve identificar:

```txt
weather=rain
speed=tailwind ou weather_speed
```

E o funil deve favorecer candidatos que realmente contribuem para Rain, como Swift Swim, suporte de chuva, turn control ou redirection, antes de considerar opções genéricas por BST/score bruto.
