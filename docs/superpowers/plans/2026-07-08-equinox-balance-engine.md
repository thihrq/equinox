# Equinox Balance Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Equinox Balance Engine so each recommendation includes competitive sets, meta context, matchup validation, a practical game plan, and a balanced score that preserves fun plus competitiveness.

**Architecture:** Add a focused `src/equinox/balance/` domain with small engines for sets, meta context, game plan, matchups, and final balance scoring. Integrate it as an additive analysis engine so the existing recommendation pipeline and `topTeams` response remain backward-compatible.

**Tech Stack:** TypeScript, Express, Mongoose, existing Equinox AnalysisPipeline, existing recommendation regression scripts, Vite React frontend.

## Global Constraints

- Preserve the Equinox identity: balance between fun and competitiveness, synergy with the user's chosen core, clear direction, and honest source confidence.
- Do not claim official complete data where the source does not exist in the repo.
- Do not add external network calls during recommendation.
- Keep existing `topTeams` API backward-compatible.
- Final scoring must evaluate the full team of six, not only the recommended trio.
- Implement on `develop` and do not push to production until typecheck, recommendation checks, and frontend build pass.

---

## File Structure

- Create `src/equinox/balance/EquinoxBalanceTypes.ts` for shared contracts.
- Create `src/equinox/balance/SetRecommendationEngine.ts` for item, ability, nature, EVs, moves, role, style, and confidence.
- Create `src/equinox/balance/MetaContextEngine.ts` for format pressure, key threats, archetypes, and source confidence.
- Create `src/equinox/balance/GamePlanEngine.ts` for lead, win conditions, offensive and defensive plans, pivots, and piloting guide.
- Create `src/equinox/balance/MatchupValidationEngine.ts` for archetype matchup scores and worst-matchup detection.
- Create `src/equinox/balance/EquinoxBalanceEngine.ts` for final balanced scoring and integration into `AnalysisPipeline`.
- Modify `src/equinox/core/AnalysisContext.ts` to store `analysis.balance`, `analysis.recommendedSets`, `analysis.metaContext`, `analysis.gamePlan`, and `analysis.matchups`.
- Modify `src/services/TeamService.ts` to add `EquinoxBalanceEngine` near the end of the pipeline before `FinalScoreEngine`.
- Modify `src/equinox/recommendation/RecommendationAdapter.ts` to expose the new fields while keeping existing fields.
- Modify `frontend/src/types/equinox.ts` to type the new response fields.
- Modify `frontend/src/App.tsx` only enough to display the new balance/game-plan sections without redesigning the current UI.
- Modify or create `src/scripts/validateBalanceEngine.ts` and wire it into `package.json`.

---

### Task 1: Balance Contracts and Regression Harness

**Files:**
- Create: `src/equinox/balance/EquinoxBalanceTypes.ts`
- Create: `src/scripts/validateBalanceEngine.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `RecommendedSet`, `MetaContextSummary`, `GamePlanSummary`, `MatchupValidationSummary`, `EquinoxBalanceReport`.
- Consumes: existing `PokemonData`, `TeamIdentity`, and format strings.

- [ ] **Step 1: Write the failing validation script**

Create `src/scripts/validateBalanceEngine.ts` with assertions that import the new contracts and engines:

```ts
import { EquinoxBalanceReport } from '../equinox/balance/EquinoxBalanceTypes';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const sample: EquinoxBalanceReport = {
  score: 82,
  level: 'Strong',
  dimensions: {
    competitivePower: 84,
    formatFit: 83,
    coreSynergy: 80,
    setQuality: 78,
    gamePlanClarity: 82,
    matchupStability: 79,
    riskControl: 76,
    creativityViability: 72,
    identityAlignment: 85,
  },
  summary: 'Balanced competitive team with clear direction.',
  warnings: [],
};

assert(sample.score === 82, 'Balance report contract should support score.');
assert(sample.level === 'Strong', 'Balance report contract should support level.');
console.log('[Equinox] Balance engine contract validation passed.');
```

- [ ] **Step 2: Run the script and verify RED**

Run: `npx ts-node src/scripts/validateBalanceEngine.ts`

Expected: fail because `src/equinox/balance/EquinoxBalanceTypes.ts` does not exist.

- [ ] **Step 3: Implement the type contracts**

Create `src/equinox/balance/EquinoxBalanceTypes.ts`:

```ts
export type BalanceLevel = 'Elite' | 'Strong' | 'Playable' | 'Creative' | 'Risky';
export type SetStyle = 'Competitive Safe' | 'Balanced' | 'Creative Viable' | 'Offensive' | 'Support';
export type MatchupLevel = 'Favored' | 'Even' | 'Playable' | 'Difficult' | 'Unsafe';

export interface RecommendedSet {
  pokemon: string;
  item: string;
  ability: string;
  nature: string;
  evs: Record<string, number>;
  moves: string[];
  role: string;
  style: SetStyle;
  confidence: number;
  source: string;
  notes: string[];
}

export interface MetaContextSummary {
  format: string;
  sourceName: string;
  sourceConfidence: number;
  keyThreats: string[];
  archetypes: string[];
  pressureSummary: string;
  warnings: string[];
}

export interface GamePlanSummary {
  likelyLead: string;
  primaryWinCondition: string;
  secondaryWinCondition: string;
  defensivePlan: string;
  offensivePlan: string;
  pivotPlan: string;
  biggestRisk: string;
  pilotingGuide: string;
}

export interface MatchupScore {
  archetype: string;
  score: number;
  level: MatchupLevel;
  notes: string[];
}

export interface MatchupValidationSummary {
  scores: MatchupScore[];
  worstMatchup: string;
  stabilityLabel: MatchupLevel;
  riskNotes: string[];
}

export interface EquinoxBalanceDimensions {
  competitivePower: number;
  formatFit: number;
  coreSynergy: number;
  setQuality: number;
  gamePlanClarity: number;
  matchupStability: number;
  riskControl: number;
  creativityViability: number;
  identityAlignment: number;
}

export interface EquinoxBalanceReport {
  score: number;
  level: BalanceLevel;
  dimensions: EquinoxBalanceDimensions;
  summary: string;
  warnings: string[];
}
```

- [ ] **Step 4: Wire the script**

Add this script to `package.json`:

```json
"balance:check": "ts-node src/scripts/validateBalanceEngine.ts"
```

Update `preflight` so it includes `npm run balance:check` after `recommendation:check`.

- [ ] **Step 5: Verify GREEN**

Run: `npm run balance:check`

Expected: `[Equinox] Balance engine contract validation passed.`

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json src/equinox/balance/EquinoxBalanceTypes.ts src/scripts/validateBalanceEngine.ts
git commit -m "feat: add equinox balance contracts"
```

---

### Task 2: Set Recommendation Engine

**Files:**
- Create: `src/equinox/balance/SetRecommendationEngine.ts`
- Modify: `src/scripts/validateBalanceEngine.ts`

**Interfaces:**
- Consumes: `PokemonData[]`, `format`.
- Produces: `RecommendedSet[]`.

- [ ] **Step 1: Add failing set assertions**

Extend `validateBalanceEngine.ts`:

```ts
import { SetRecommendationEngine } from '../equinox/balance/SetRecommendationEngine';

const setEngine = new SetRecommendationEngine();
const sets = setEngine.recommendSets({
  team: [
    { name: 'Charizard', dexNumber: 6, variants: [{ formatId: 'vanilla', types: ['Fire', 'Flying'], abilities: { 0: 'Blaze' }, baseStats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 } }] } as never,
  ],
  format: 'gen9ou',
});

assert(sets.length === 1, 'Set engine should return one set per Pokemon.');
assert(sets[0].moves.length === 4, 'Each recommended set should include four moves.');
assert(sets[0].confidence > 0, 'Each recommended set should expose confidence.');
```

- [ ] **Step 2: Verify RED**

Run: `npm run balance:check`

Expected: fail because `SetRecommendationEngine` does not exist.

- [ ] **Step 3: Implement minimal set engine**

Create `SetRecommendationEngine.ts` with deterministic heuristics:

```ts
import { PokemonData } from '../core/AnalysisContext';
import { RecommendedSet, SetStyle } from './EquinoxBalanceTypes';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

export class SetRecommendationEngine {
  public recommendSets(params: { team: PokemonData[]; format: string }): RecommendedSet[] {
    return params.team.map(pokemon => this.recommendSet(pokemon, params.format));
  }

  private recommendSet(pokemon: PokemonData, format: string): RecommendedSet {
    const variant = getVariant(pokemon, format) ?? getVariant(pokemon, 'vanilla');
    const stats = variant?.baseStats;
    const atk = Number(stats?.atk ?? 0);
    const spa = Number(stats?.spa ?? 0);
    const spe = Number(stats?.spe ?? 0);
    const hp = Number(stats?.hp ?? 0);
    const def = Number(stats?.def ?? 0);
    const spd = Number(stats?.spd ?? 0);
    const types = getPokemonTypes(pokemon, format);
    const isFast = spe >= 100;
    const isBulky = hp + Math.max(def, spd) >= 185;
    const isPhysical = atk >= spa;
    const style: SetStyle = isFast ? 'Offensive' : isBulky ? 'Support' : 'Balanced';

    return {
      pokemon: pokemon.name,
      item: isFast ? 'Heavy-Duty Boots' : isBulky ? 'Leftovers' : 'Expert Belt',
      ability: Object.values(variant?.abilities ?? {})[0] ?? 'Standard ability',
      nature: isPhysical ? (isFast ? 'Jolly' : 'Adamant') : (isFast ? 'Timid' : 'Modest'),
      evs: isFast
        ? { hp: 0, atk: isPhysical ? 252 : 0, def: 0, spa: isPhysical ? 0 : 252, spd: 4, spe: 252 }
        : { hp: 252, atk: isPhysical ? 120 : 0, def: 68, spa: isPhysical ? 0 : 120, spd: 68, spe: 0 },
      moves: this.buildMoves(types, isPhysical),
      role: isFast ? 'Speed pressure' : isBulky ? 'Defensive support' : 'Flexible pressure',
      style,
      confidence: clamp(62 + (variant ? 18 : 0) + (pokemon.competitive?.roles?.length ? 10 : 0)),
      source: 'Equinox heuristic set engine',
      notes: ['Heuristic set built from stats, typing, and role data. Replace with format data packs when available.'],
    };
  }

  private buildMoves(types: string[], isPhysical: boolean): string[] {
    const stab = types.slice(0, 2).map(type => `${type} STAB`);
    return [...stab, isPhysical ? 'Setup / coverage' : 'Special coverage', 'Utility / protection'].slice(0, 4);
  }
}
```

- [ ] **Step 4: Verify GREEN**

Run: `npm run balance:check`

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/equinox/balance/SetRecommendationEngine.ts src/scripts/validateBalanceEngine.ts
git commit -m "feat: add set recommendation engine"
```

---

### Task 3: Meta Context and Matchup Engines

**Files:**
- Create: `src/equinox/balance/MetaContextEngine.ts`
- Create: `src/equinox/balance/MatchupValidationEngine.ts`
- Modify: `src/scripts/validateBalanceEngine.ts`

**Interfaces:**
- Consumes: `PokemonData[]`, `format`, existing `MetaDatabase`, existing `FormatIntelligenceRegistry`.
- Produces: `MetaContextSummary`, `MatchupValidationSummary`.

- [ ] **Step 1: Add failing assertions**

Extend `validateBalanceEngine.ts`:

```ts
import { MetaContextEngine } from '../equinox/balance/MetaContextEngine';
import { MatchupValidationEngine } from '../equinox/balance/MatchupValidationEngine';

const metaContext = new MetaContextEngine().analyze({ team: [], format: 'gen9ou' });
assert(metaContext.keyThreats.length > 0, 'Meta context should include key threats.');
assert(metaContext.sourceConfidence > 0, 'Meta context should expose source confidence.');

const matchups = new MatchupValidationEngine().validate({ team: [], format: 'gen9ou', metaContext });
assert(matchups.scores.length > 0, 'Matchup validation should include archetype scores.');
assert(Boolean(matchups.worstMatchup), 'Matchup validation should identify a worst matchup.');
```

- [ ] **Step 2: Verify RED**

Run: `npm run balance:check`

Expected: fail because the engines do not exist.

- [ ] **Step 3: Implement MetaContextEngine**

Create `MetaContextEngine.ts` using `MetaDatabase` and `FormatIntelligenceRegistry`:

```ts
import { PokemonData } from '../core/AnalysisContext';
import { FormatIntelligenceRegistry } from '../formats/FormatIntelligenceRegistry';
import { MetaDatabase } from '../meta/MetaDatabase';
import { MetaContextSummary } from './EquinoxBalanceTypes';

export class MetaContextEngine {
  private readonly formats = new FormatIntelligenceRegistry();
  private readonly meta = new MetaDatabase();

  public analyze(params: { team: PokemonData[]; format: string }): MetaContextSummary {
    const profile = this.formats.getProfile(params.format);
    const meta = this.meta.getFormat(params.format);
    const keyThreats = meta.threats.slice(0, 8).map(threat => threat.name);

    return {
      format: profile.id,
      sourceName: profile.sourceName,
      sourceConfidence: profile.dataStatus === 'verified' ? 92 : profile.dataStatus === 'community' ? 76 : 54,
      keyThreats,
      archetypes: this.resolveArchetypes(profile.battleStyle),
      pressureSummary: `${profile.label} pressure is evaluated through ${meta.threatProfileName}.`,
      warnings: profile.warning ? [profile.warning] : [],
    };
  }

  private resolveArchetypes(style: string): string[] {
    if (style === 'doubles') return ['Balance', 'Tailwind', 'Trick Room', 'Weather', 'Bulky Offense'];
    if (style === 'gauntlet') return ['Boss Gauntlet', 'Worst Matchup', 'Critical Threats'];
    return ['Hyper Offense', 'Bulky Offense', 'Balance', 'Stall', 'Rain', 'Sun', 'Hazard Stack'];
  }
}
```

- [ ] **Step 4: Implement MatchupValidationEngine**

Create `MatchupValidationEngine.ts`:

```ts
import { PokemonData } from '../core/AnalysisContext';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { MatchupLevel, MatchupValidationSummary, MetaContextSummary } from './EquinoxBalanceTypes';

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

export class MatchupValidationEngine {
  public validate(params: { team: PokemonData[]; format: string; metaContext: MetaContextSummary }): MatchupValidationSummary {
    const scores = params.metaContext.archetypes.map(archetype => {
      const score = this.scoreArchetype(params.team, params.format, archetype);
      return {
        archetype,
        score,
        level: this.level(score),
        notes: [`${archetype} evaluated from team speed, bulk, roles, and format pressure.`],
      };
    });

    const worst = [...scores].sort((a, b) => a.score - b.score)[0];

    return {
      scores,
      worstMatchup: worst?.archetype ?? 'Unknown',
      stabilityLabel: this.level(worst?.score ?? 45),
      riskNotes: worst ? [`Worst pressure point: ${worst.archetype}.`] : ['No matchup data available.'],
    };
  }

  private scoreArchetype(team: PokemonData[], format: string, archetype: string): number {
    const speeds = team.map(pokemon => Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0));
    const types = new Set(team.flatMap(pokemon => getPokemonTypes(pokemon, format)));
    const averageSpeed = speeds.length ? speeds.reduce((sum, value) => sum + value, 0) / speeds.length : 75;
    const typeDiversity = types.size;
    const base = 52 + typeDiversity * 3;

    if (/Hyper|Tailwind/i.test(archetype)) return clamp(base + (averageSpeed >= 90 ? 18 : 4));
    if (/Stall|Bulky/i.test(archetype)) return clamp(base + (typeDiversity >= 8 ? 14 : 4));
    if (/Trick Room/i.test(archetype)) return clamp(base + (averageSpeed <= 80 ? 12 : 2));
    if (/Boss|Worst|Critical/i.test(archetype)) return clamp(base + 8);
    return clamp(base + 10);
  }

  private level(score: number): MatchupLevel {
    if (score >= 82) return 'Favored';
    if (score >= 70) return 'Even';
    if (score >= 58) return 'Playable';
    if (score >= 46) return 'Difficult';
    return 'Unsafe';
  }
}
```

- [ ] **Step 5: Verify GREEN**

Run: `npm run balance:check`

Expected: pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/equinox/balance/MetaContextEngine.ts src/equinox/balance/MatchupValidationEngine.ts src/scripts/validateBalanceEngine.ts
git commit -m "feat: add meta context and matchup validation"
```

---

### Task 4: Game Plan and Balance Score Engines

**Files:**
- Create: `src/equinox/balance/GamePlanEngine.ts`
- Create: `src/equinox/balance/EquinoxBalanceEngine.ts`
- Modify: `src/equinox/core/AnalysisContext.ts`
- Modify: `src/scripts/validateBalanceEngine.ts`

**Interfaces:**
- Consumes: full team, format, team identity, existing analysis, sets, meta context, matchups.
- Produces: `GamePlanSummary`, `EquinoxBalanceReport`.

- [ ] **Step 1: Add failing assertions**

Extend `validateBalanceEngine.ts`:

```ts
import { GamePlanEngine } from '../equinox/balance/GamePlanEngine';
import { EquinoxBalanceEngine } from '../equinox/balance/EquinoxBalanceEngine';

const gamePlan = new GamePlanEngine().build({
  team: [],
  format: 'gen9ou',
  metaContext,
  matchups,
});
assert(Boolean(gamePlan.primaryWinCondition), 'Game plan should include primary win condition.');

const balance = new EquinoxBalanceEngine().calculate({
  format: 'gen9ou',
  teamIdentity: 'balanced',
  existingScore: 75,
  existingAnalysis: { fatalUncovered: 0, normalUncovered: 2, totalWeaknesses: 8 } as never,
  sets,
  metaContext,
  gamePlan,
  matchups,
});
assert(balance.score > 0, 'Balance score should be calculated.');
assert(balance.dimensions.competitivePower > 0, 'Balance score should include competitive power.');
```

- [ ] **Step 2: Verify RED**

Run: `npm run balance:check`

Expected: fail because `GamePlanEngine` and `EquinoxBalanceEngine` do not exist.

- [ ] **Step 3: Implement GamePlanEngine**

Create `GamePlanEngine.ts`:

```ts
import { PokemonData } from '../core/AnalysisContext';
import { getVariant } from '../utils/PokemonUtils';
import { GamePlanSummary, MatchupValidationSummary, MetaContextSummary } from './EquinoxBalanceTypes';

export class GamePlanEngine {
  public build(params: {
    team: PokemonData[];
    format: string;
    metaContext: MetaContextSummary;
    matchups: MatchupValidationSummary;
  }): GamePlanSummary {
    const lead = this.fastest(params.team, params.format) ?? params.team[0]?.name ?? 'Best tempo piece';
    const winCondition = this.strongest(params.team, params.format) ?? lead;

    return {
      likelyLead: lead,
      primaryWinCondition: `Create progress until ${winCondition} can close the game.`,
      secondaryWinCondition: `Use defensive pivots to preserve answers into ${params.metaContext.keyThreats[0] ?? 'the main threat'}.`,
      defensivePlan: `Avoid overexposing the team into ${params.matchups.worstMatchup}.`,
      offensivePlan: 'Trade damage only when it opens a clear endgame path.',
      pivotPlan: 'Use resistances and immunities to move from defensive answers into pressure pieces.',
      biggestRisk: params.matchups.riskNotes[0] ?? 'Unclear matchup risk.',
      pilotingGuide: 'Lead for tempo, preserve the best matchup answer, then convert the strongest win condition once checks are weakened.',
    };
  }

  private fastest(team: PokemonData[], format: string): string | undefined {
    return [...team].sort((a, b) => Number(getVariant(b, format)?.baseStats?.spe ?? 0) - Number(getVariant(a, format)?.baseStats?.spe ?? 0))[0]?.name;
  }

  private strongest(team: PokemonData[], format: string): string | undefined {
    return [...team].sort((a, b) => {
      const aStats = getVariant(a, format)?.baseStats;
      const bStats = getVariant(b, format)?.baseStats;
      return Math.max(Number(bStats?.atk ?? 0), Number(bStats?.spa ?? 0)) - Math.max(Number(aStats?.atk ?? 0), Number(aStats?.spa ?? 0));
    })[0]?.name;
  }
}
```

- [ ] **Step 4: Implement EquinoxBalanceEngine**

Create `EquinoxBalanceEngine.ts` with `calculate()` and `execute(context)` so it can be used as an `AnalysisEngine`.

The `execute` method should:

```ts
const sets = new SetRecommendationEngine().recommendSets({ team: context.selectedPokemon, format: context.format });
const metaContext = new MetaContextEngine().analyze({ team: context.selectedPokemon, format: context.format });
const matchups = new MatchupValidationEngine().validate({ team: context.selectedPokemon, format: context.format, metaContext });
const gamePlan = new GamePlanEngine().build({ team: context.selectedPokemon, format: context.format, metaContext, matchups });
const balance = this.calculate({ format: context.format, teamIdentity: context.teamIdentity, existingScore: context.score.total, existingAnalysis: context.analysis, sets, metaContext, gamePlan, matchups });
context.analysis.recommendedSets = sets;
context.analysis.metaContext = metaContext;
context.analysis.matchups = matchups;
context.analysis.gamePlan = gamePlan;
context.analysis.balance = balance;
```

The `calculate()` method should implement the weighted dimensions from the spec.

- [ ] **Step 5: Extend AnalysisContext types**

Add optional fields to the analysis object:

```ts
recommendedSets?: RecommendedSet[];
metaContext?: MetaContextSummary;
gamePlan?: GamePlanSummary;
matchups?: MatchupValidationSummary;
balance?: EquinoxBalanceReport;
```

- [ ] **Step 6: Verify GREEN**

Run: `npm run balance:check`

Expected: pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/equinox/balance/GamePlanEngine.ts src/equinox/balance/EquinoxBalanceEngine.ts src/equinox/core/AnalysisContext.ts src/scripts/validateBalanceEngine.ts
git commit -m "feat: add equinox balance scoring engine"
```

---

### Task 5: Pipeline and API Response Integration

**Files:**
- Modify: `src/services/TeamService.ts`
- Modify: `src/equinox/recommendation/RecommendationAdapter.ts`
- Modify: `src/scripts/validateRecommendationRules.ts`
- Modify: `src/scripts/validateBalanceEngine.ts`

**Interfaces:**
- Consumes: `EquinoxBalanceEngine`.
- Produces: `topTeams[n].balance`, `topTeams[n].sets`, `topTeams[n].metaContext`, `topTeams[n].gamePlan`, `topTeams[n].matchups`.

- [ ] **Step 1: Add failing response assertion**

Extend `validateBalanceEngine.ts` with an adapter-level assertion using a fake evaluated combination:

```ts
import { RecommendationAdapter } from '../equinox/recommendation/RecommendationAdapter';

const response = new RecommendationAdapter().toLegacyResponse([
  {
    team: [],
    context: {
      analysis: {
        fatalUncovered: 0,
        normalUncovered: 0,
        totalWeaknesses: 0,
        roles: [],
        speed: {},
        offensiveCoverage: {},
        threats: {},
        recommendedSets: sets,
        metaContext,
        gamePlan,
        matchups,
        balance,
      },
      score: { total: 80 },
      explanations: [],
      selectedPokemon: [],
    } as never,
  },
], 'gen9ou');

assert(response.topTeams[0].balance.score === balance.score, 'Recommendation response should expose balance score.');
```

- [ ] **Step 2: Verify RED**

Run: `npm run balance:check`

Expected: fail because adapter does not expose balance fields yet.

- [ ] **Step 3: Add EquinoxBalanceEngine to TeamService**

In `TeamService.ts`, import and place it after `AIBuilderEngine()` and before `FinalScoreEngine()`:

```ts
.use(new AIBuilderEngine())
.use(new EquinoxBalanceEngine())
.use(new FinalScoreEngine());
```

- [ ] **Step 4: Expose fields in RecommendationAdapter**

In `formatOption()`, add:

```ts
sets: context.analysis.recommendedSets,
metaContext: context.analysis.metaContext,
gamePlan: context.analysis.gamePlan,
matchups: context.analysis.matchups,
balance: context.analysis.balance,
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npm run balance:check
npm run recommendation:check
npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/services/TeamService.ts src/equinox/recommendation/RecommendationAdapter.ts src/scripts/validateBalanceEngine.ts src/scripts/validateRecommendationRules.ts
git commit -m "feat: expose equinox balance recommendations"
```

---

### Task 6: Frontend Types and UI Display

**Files:**
- Modify: `frontend/src/types/equinox.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`

**Interfaces:**
- Consumes: new optional API response blocks.
- Produces: visible balance score, game plan, set summary, and matchup summary without breaking old responses.

- [ ] **Step 1: Add failing type usage**

In `frontend/src/types/equinox.ts`, add interfaces matching `EquinoxBalanceTypes.ts`.

In `App.tsx`, reference optional fields:

```tsx
{selectedOption.balance && (
  <DetailsBlock title={t(locale, 'balanceScore')} subtitle={selectedOption.balance.level} count={1} locale={locale}>
    <p>{selectedOption.balance.summary}</p>
  </DetailsBlock>
)}
```

Expected initial failure: missing i18n keys and styles.

- [ ] **Step 2: Add i18n keys**

Add PT-BR and EN-US labels:

```ts
balanceScore: 'Pontuação Equinox',
gamePlan: 'Plano de jogo',
recommendedSets: 'Sets sugeridos',
matchupValidation: 'Validação de matchups',
```

English:

```ts
balanceScore: 'Equinox Score',
gamePlan: 'Game plan',
recommendedSets: 'Suggested sets',
matchupValidation: 'Matchup validation',
```

- [ ] **Step 3: Add compact UI sections**

Render optional sections below the existing details:

- Equinox Score summary;
- Game Plan;
- Suggested Sets;
- Matchup Validation.

Keep the UI restrained, black/white/gray, and aligned with the current identity.

- [ ] **Step 4: Verify frontend build**

Run: `npm --prefix frontend run build`

Expected: build passes.

- [ ] **Step 5: Commit**

Run:

```bash
git add frontend/src/types/equinox.ts frontend/src/App.tsx frontend/src/App.css frontend/src/i18n/equinoxI18n.ts
git commit -m "feat: show equinox balance insights"
```

---

### Task 7: Full Verification and Production Readiness

**Files:**
- Modify: `docs/SPRINT19_EQUINOX_BALANCE_ENGINE_SPEC.md` only if verification discovers a documented scope mismatch.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified local release candidate on `develop`.

- [ ] **Step 1: Run backend preflight**

Run: `npm run preflight`

Expected: typecheck, data check, format check, recommendation check, and balance check pass.

- [ ] **Step 2: Run frontend build**

Run: `npm --prefix frontend run build`

Expected: build passes.

- [ ] **Step 3: Run local API smoke test**

Start API and frontend locally. Submit:

```json
{
  "team": ["Charizard", "Jolteon", "Lapras"],
  "format": "gen9ou",
  "allowLegendaries": false,
  "teamIdentity": "balanced",
  "locale": "pt-BR"
}
```

Expected response:

- `topTeams.length` is greater than zero;
- every option keeps `suggestedPokemons`;
- every option includes `balance`, `sets`, `metaContext`, `gamePlan`, and `matchups`;
- no existing UI section disappears.

- [ ] **Step 4: Run production-like build variables**

Run:

```bash
$env:VITE_BASE_PATH='/equinox/'
$env:VITE_API_BASE_URL='https://equinox-api-c7zy.onrender.com'
npm --prefix frontend run build
Remove-Item Env:\VITE_BASE_PATH
Remove-Item Env:\VITE_API_BASE_URL
```

Expected: production frontend build passes and still points to Render API.

- [ ] **Step 5: Final commit if needed**

Run:

```bash
git status -sb
git add docs/SPRINT19_EQUINOX_BALANCE_ENGINE_SPEC.md
git commit -m "docs: align balance engine verification notes"
```

Only create this commit if documentation changed during verification.

---

## Self-Review Checklist

- Spec coverage: Tasks cover Set Engine, Meta Context Engine, Game Plan Engine, Matchup Validation Engine, Equinox Balance Score, API compatibility, UI rendering, and verification.
- Placeholder scan: This plan avoids open-ended placeholders and gives concrete files, interfaces, commands, and expected outcomes.
- Type consistency: API field names match the spec: `balance`, `sets`, `metaContext`, `gamePlan`, `matchups`.
- Scope control: No external runtime network dependency is introduced. Data packs can improve later without blocking this sprint.
