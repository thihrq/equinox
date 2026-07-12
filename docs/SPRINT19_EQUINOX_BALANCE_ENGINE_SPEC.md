# Sprint 19 - Equinox Balance Engine Spec

## Goal

Add a new recommendation layer that raises the competitive quality of Equinox suggestions without turning the product into a purely meta-driven team copier.

The engine must preserve the Equinox identity:

- balance between fun and competitiveness;
- synergy with the user's chosen core;
- clear direction for how to play the team;
- honest source confidence when a format does not have complete verified data.

## Product Principle

Equinox should not answer only "what is the strongest team?"

It should answer:

> What is the strongest viable team that respects the user's core, selected format, team identity, risk tolerance, and creative preference?

This means meta pressure matters, but it cannot erase the user-selected core or force every result toward the same obvious ladder picks.

## Scope

This sprint introduces the Equinox Balance Engine as an additive layer on top of the current recommendation pipeline.

The existing flow remains:

1. user provides three fixed Pokemon;
2. Equinox filters valid candidates by format;
3. Equinox builds candidate trios;
4. Equinox evaluates the full team of six;
5. Equinox returns five ranked team options.

The new layer adds four competitive dimensions before final ranking:

1. Set Engine
2. Meta Context Engine
3. Game Plan Engine
4. Matchup Validation Engine

## Non-Goals

This sprint will not claim official complete data where the source does not exist in the repo.

It will not:

- scrape live usage data at request time;
- depend on external network calls during recommendation;
- replace the existing Radical Red or Champions engines;
- force a single Smogon-style optimal set for every Pokemon;
- remove creative or favorite-preserving recommendations.

## Engine Components

### 1. Set Engine

The Set Engine suggests a practical set for each recommended Pokemon.

Each set should include:

- item;
- ability;
- nature;
- EV spread;
- moves;
- role label;
- confidence;
- style tag.

Initial style tags:

- Competitive Safe
- Balanced
- Creative Viable
- Offensive
- Support

The first implementation may use curated heuristics from Pokemon data, roles, stats, format, and known utility tags. It must expose source confidence rather than pretending every set is official.

### 2. Meta Context Engine

The Meta Context Engine explains what the team is being built to survive or pressure.

It should use the current internal format data:

- FormatIntelligenceRegistry;
- MetaDatabase;
- RadicalRedBossGauntlet data;
- Champions Regulation profiles;
- future data packs when added.

It should output:

- key threats considered;
- archetypes considered;
- format pressure summary;
- source confidence;
- warnings when the format is bootstrap, pending, or community-derived.

### 3. Game Plan Engine

The Game Plan Engine turns analysis into player-facing direction.

It should output:

- likely lead;
- primary win condition;
- secondary win condition;
- defensive plan;
- offensive plan;
- pivot or transition plan;
- biggest risk;
- short piloting guide.

This keeps Equinox useful for players who do not only want a list of Pokemon, but want to understand how the team is supposed to win.

### 4. Matchup Validation Engine

The Matchup Validation Engine evaluates the full team against format-relevant pressure.

It should output:

- matchup scores by archetype;
- threat answer summary;
- worst matchup;
- risk notes;
- stability label.

Initial archetype labels:

- Hyper Offense
- Bulky Offense
- Balance
- Stall
- Rain
- Sun
- Trick Room
- Hazard Stack
- Boss Gauntlet, when Radical Red applies
- Live Regulation, when Champions applies

The first version can use internal threats and role heuristics. Later versions can consume imported usage stats, sample teams, and matchup data packs.

## Equinox Balance Score

The new score should combine competitive strength with the Equinox identity.

Initial dimensions:

- competitivePower;
- formatFit;
- coreSynergy;
- setQuality;
- gamePlanClarity;
- matchupStability;
- riskControl;
- creativityViability;
- identityAlignment;

The final score must not rank only by raw competitivePower.

Suggested first weighting:

- competitivePower: 18%
- formatFit: 16%
- coreSynergy: 14%
- matchupStability: 14%
- gamePlanClarity: 10%
- setQuality: 10%
- riskControl: 8%
- identityAlignment: 6%
- creativityViability: 4%

Team identity can adjust these weights:

- hyper_offense increases competitivePower and speed pressure;
- stall increases riskControl and matchupStability;
- fun increases creativityViability and identityAlignment but still requires formatFit;
- balanced keeps the default weights.

## Data Flow

The target recommendation flow becomes:

1. TeamService receives the user's three Pokemon and selected format.
2. Existing validation confirms the core exists and is legal.
3. CandidateSelector filters format-valid Pokemon.
4. CandidateScoreEngine performs the current first-pass score.
5. DiversityCandidateSelector keeps a diverse candidate pool.
6. CombinationSearchEngine forms trios and creates the full team of six.
7. Existing AnalysisPipeline runs on the full team.
8. Set Engine proposes sets for the six Pokemon.
9. Meta Context Engine attaches format and threat context.
10. Game Plan Engine creates the practical plan.
11. Matchup Validation Engine scores archetype and threat matchups.
12. Equinox Balance Engine calculates the final balanced score.
13. RecommendationAdapter returns five options with the new sections.

## API Shape

Each returned team option should gain a new `balance` block:

```ts
balance: {
  score: number;
  level: 'Elite' | 'Strong' | 'Playable' | 'Creative' | 'Risky';
  dimensions: {
    competitivePower: number;
    formatFit: number;
    coreSynergy: number;
    setQuality: number;
    gamePlanClarity: number;
    matchupStability: number;
    riskControl: number;
    creativityViability: number;
    identityAlignment: number;
  };
  summary: string;
  warnings: string[];
}
```

Each team option should also gain:

```ts
sets: RecommendedSet[];
metaContext: MetaContextSummary;
gamePlan: GamePlanSummary;
matchups: MatchupValidationSummary;
```

The frontend can render these progressively. The API must remain backward-compatible with the current UI while the new UI sections are added.

## Format Behavior

### Vanilla

Vanilla formats should remain game-pool aware.

If the pool is bootstrap, the engine must show lower source confidence and avoid claiming exact encounter availability.

### Showdown

Showdown formats should use stricter format legality and archetype pressure.

Special attention:

- LC should require Little Cup-eligible candidates;
- NatDex LC should not allow fully evolved high-BST picks;
- Draft should be clearly labeled as draft-style heuristic, not ladder-locked;
- doubles formats should value field control, spread pressure, Fake Out, redirection, Tailwind, Trick Room, and Protect-aware play.

### Radical Red

Radical Red should keep boss gauntlet scoring as the primary competitive objective.

The new engine should explain:

- best lead logic;
- safest boss sequence plan;
- worst boss matchup;
- critical threat answers.

### Pokemon Champions

Champions should stay source-aware.

Until a full eligible roster is imported, the output must clearly indicate:

- regulation profile is active;
- source confidence is limited;
- roster lock is not fully official;
- suggestions are regulation-aware, not official-roster guaranteed.

## Testing Requirements

The implementation must add regression coverage proving:

- the full team of six is still the unit of final scoring;
- the Balance Score changes ranking when two teams have similar raw score but different risk/matchup quality;
- fun identity can preserve creative viable picks without allowing illegal format picks;
- LC and NatDex LC do not suggest fully evolved high-BST candidates;
- Champions output exposes source confidence and roster warning;
- Radical Red output keeps gauntlet scoring as the primary ranking signal;
- API responses remain backward-compatible with current `topTeams`.

## Rollout

Implement in `develop`.

Do not push to production until:

- typecheck passes;
- recommendation regression checks pass;
- frontend build passes;
- production-like payload samples show the new blocks without breaking existing UI.

## Success Criteria

The sprint is successful when each of the five returned teams includes:

- a balanced score;
- practical sets;
- meta context;
- matchup validation;
- a readable game plan;
- source confidence when data is incomplete.

The recommendations must feel more competitive without losing the user's chosen core or the Equinox personality of balance, synergy, and direction.
