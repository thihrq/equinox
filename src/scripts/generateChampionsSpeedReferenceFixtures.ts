import fs from 'fs';
import path from 'path';
import { calculateIndependentSpeed } from '../services/competitive-data/reference-conformance/adapters/PokemonShowdownSpeedReferenceAdapter';
import { IndependentSpeedActor, IndependentSpeedFixture, stableDigest } from '../services/competitive-data/reference-conformance/contracts/ReferenceConformanceContracts';

// Offline fixture generation: exercises the already-installed, already-acquired @pkmn/sim
// reference many times with different structured inputs. This is distinct from
// bootstrapChampionsMechanicsReference.ts (the gated acquisition/registration step) -- no
// network access, no re-acquisition, just running the local reference adapter.

const SEED = 'champions-mb-speed-reference-v1';
const FORMAT_ID = 'champions-reg-mb-doubles';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function rejectUnknownArgs(): void {
  const allowed = new Set(['--run-id', '--output-dir']);
  for (let i = 2; i < process.argv.length; i += 1) {
    if (!process.argv[i].startsWith('--')) continue;
    if (!allowed.has(process.argv[i])) throw new Error(`Unknown argument: ${process.argv[i]}`);
    i += 1;
  }
}

function writeAtomic(destination: string, value: unknown, reasonCodes: string[]): void {
  const resolved = path.resolve(destination);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      const fallback = `${resolved}.fallback-${Date.now()}.json`;
      fs.writeFileSync(fallback, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      reasonCodes.push('ARTIFACT_ATOMIC_RENAME_BLOCKED', 'ARTIFACT_FALLBACK_PATH_USED');
      return;
    }
    throw error;
  }
}

const NEUTRAL: IndependentSpeedActor = {
  species: 'Ditto', level: 50, baseSpeed: 48, nature: 'Serious', speedEv: 0, speedIv: 31, speedStage: 0, move: 'protect', movePriority: 0,
};

interface CaseDefinition {
  id: string;
  description: string;
  category: string;
  actor?: Partial<IndependentSpeedActor>;
  opponent?: Partial<IndependentSpeedActor>;
  context?: Partial<IndependentSpeedFixture['battleContext']>;
  limitations?: string[];
}

function buildActor(overrides?: Partial<IndependentSpeedActor>): IndependentSpeedActor {
  return { ...NEUTRAL, ...overrides };
}

const CASES: CaseDefinition[] = [
  // 14.1 -- calculated Speed base math
  { id: 'speed-calc-neutral-nature-v1', category: 'calculated-speed', description: 'Neutral nature, 0 EV, 31 IV baseline', actor: { nature: 'Serious', speedEv: 0, speedIv: 31 } },
  { id: 'speed-calc-positive-nature-v1', category: 'calculated-speed', description: 'Positive Speed nature (Timid, +10%)', actor: { nature: 'Timid', speedEv: 252, speedIv: 31 } },
  { id: 'speed-calc-negative-nature-v1', category: 'calculated-speed', description: 'Negative Speed nature (Brave, -10%)', actor: { nature: 'Brave', speedEv: 252, speedIv: 31 } },
  { id: 'speed-calc-0-speed-ev-v1', category: 'calculated-speed', description: '0 Speed EV', actor: { speedEv: 0, speedIv: 31 } },
  { id: 'speed-calc-252-speed-ev-v1', category: 'calculated-speed', description: '252 Speed EV', actor: { speedEv: 252, speedIv: 31 } },
  { id: 'speed-calc-0-speed-iv-v1', category: 'calculated-speed', description: '0 Speed IV', actor: { speedEv: 252, speedIv: 0 } },
  { id: 'speed-calc-31-speed-iv-v1', category: 'calculated-speed', description: '31 Speed IV', actor: { speedEv: 252, speedIv: 31 } },
  { id: 'speed-calc-level-100-v1', category: 'calculated-speed', description: 'Additional supported level (100)', actor: { level: 100, speedEv: 252, speedIv: 31 } },
  { id: 'speed-calc-stage-plus1-v1', category: 'calculated-speed', description: 'Speed stage +1', actor: { speedStage: 1, speedEv: 252, speedIv: 31 } },
  { id: 'speed-calc-stage-minus1-v1', category: 'calculated-speed', description: 'Speed stage -1', actor: { speedStage: -1, speedEv: 252, speedIv: 31 } },
  { id: 'speed-calc-stage-plus2-v1', category: 'calculated-speed', description: 'Speed stage +2', actor: { speedStage: 2, speedEv: 252, speedIv: 31 } },
  { id: 'speed-calc-stage-minus2-v1', category: 'calculated-speed', description: 'Speed stage -2', actor: { speedStage: -2, speedEv: 252, speedIv: 31 } },

  // 14.2 -- items
  { id: 'speed-item-choice-scarf-v1', category: 'items', description: 'Choice Scarf (1.5x effective Speed)', actor: { item: 'choicescarf', speedEv: 252, speedIv: 31 } },
  { id: 'speed-item-no-modifier-v1', category: 'items', description: 'Item with no Speed modifier (Leftovers)', actor: { item: 'leftovers', speedEv: 252, speedIv: 31 } },
  { id: 'speed-item-unrecognized-v1', category: 'items', description: 'Item id not recognized by the dex (fail-closed check)', actor: { item: 'not-a-real-item-id', speedEv: 252, speedIv: 31 } },

  // 14.3 -- status
  { id: 'speed-status-healthy-v1', category: 'status', description: 'No status', actor: { speedEv: 252, speedIv: 31 } },
  { id: 'speed-status-paralysis-v1', category: 'status', description: 'Paralysis (0.5x effective Speed, Gen 9)', actor: { status: 'par', speedEv: 252, speedIv: 31 } },
  { id: 'speed-status-paralysis-plus-tailwind-v1', category: 'status', description: 'Paralysis combined with Tailwind', actor: { status: 'par', speedEv: 252, speedIv: 31 }, context: { actorTailwind: true } },
  { id: 'speed-status-unrelated-burn-v1', category: 'status', description: 'Status unrelated to Speed (burn)', actor: { status: 'brn', speedEv: 252, speedIv: 31 } },

  // 14.4 -- weather abilities
  { id: 'speed-ability-swift-swim-active-v1', category: 'weather-ability', description: 'Swift Swim active in rain', actor: { ability: 'swiftswim', speedEv: 252, speedIv: 31 }, context: { weather: 'raindance' } },
  { id: 'speed-ability-swift-swim-inactive-v1', category: 'weather-ability', description: 'Swift Swim inactive (no rain)', actor: { ability: 'swiftswim', speedEv: 252, speedIv: 31 } },
  { id: 'speed-ability-chlorophyll-active-v1', category: 'weather-ability', description: 'Chlorophyll active in sun', actor: { ability: 'chlorophyll', speedEv: 252, speedIv: 31 }, context: { weather: 'sunnyday' } },
  { id: 'speed-ability-chlorophyll-inactive-v1', category: 'weather-ability', description: 'Chlorophyll inactive (no sun)', actor: { ability: 'chlorophyll', speedEv: 252, speedIv: 31 } },
  { id: 'speed-ability-sand-rush-active-v1', category: 'weather-ability', description: 'Sand Rush active in sandstorm', actor: { ability: 'sandrush', speedEv: 252, speedIv: 31 }, context: { weather: 'sandstorm' } },
  { id: 'speed-ability-sand-rush-inactive-v1', category: 'weather-ability', description: 'Sand Rush inactive (no sandstorm)', actor: { ability: 'sandrush', speedEv: 252, speedIv: 31 } },
  // NOTE: the pinned @pkmn/sim@0.10.11 reference still keys Slush Rush's activation off the
  // legacy 'hail' weather id, not the modern 'snow' id -- confirmed by reading
  // node_modules/@pkmn/sim/build/cjs/data/abilities.js directly (onModifySpe checks
  // this.field.isWeather(['hail', 'snowscape']); 'snow' alone is not a registered condition id
  // in this package version). 'hail' is used here to match what this exact reference version
  // actually recognizes, not the current in-game weather name. See
  // artifacts/competitive-production-readiness/<runId>/reports/speed-reference-completion-report.md.
  { id: 'speed-ability-slush-rush-active-v1', category: 'weather-ability', description: "Slush Rush active (pinned @pkmn/sim@0.10.11 keys this off weather id 'hail')", actor: { ability: 'slushrush', speedEv: 252, speedIv: 31 }, context: { weather: 'hail' } },
  { id: 'speed-ability-slush-rush-inactive-v1', category: 'weather-ability', description: 'Slush Rush inactive (no hail/snow)', actor: { ability: 'slushrush', speedEv: 252, speedIv: 31 } },

  // 14.5 -- Tailwind
  { id: 'speed-tailwind-none-v1', category: 'tailwind', description: 'No Tailwind on either side', actor: { speedEv: 252, speedIv: 31 } },
  { id: 'speed-tailwind-actor-v1', category: 'tailwind', description: 'Tailwind on the actor side', actor: { speedEv: 252, speedIv: 31 }, context: { actorTailwind: true } },
  { id: 'speed-tailwind-opponent-v1', category: 'tailwind', description: 'Tailwind on the opponent side', actor: { speedEv: 252, speedIv: 31 }, context: { opponentTailwind: true } },
  { id: 'speed-tailwind-both-v1', category: 'tailwind', description: 'Tailwind on both sides', actor: { speedEv: 252, speedIv: 31 }, context: { actorTailwind: true, opponentTailwind: true } },
  { id: 'speed-tailwind-with-choice-scarf-v1', category: 'tailwind', description: 'Tailwind combined with Choice Scarf', actor: { item: 'choicescarf', speedEv: 252, speedIv: 31 }, context: { actorTailwind: true } },

  // 14.6 -- Trick Room (calculated/effective Speed unaffected; only ordering criterion changes)
  { id: 'speed-trickroom-actor-faster-no-tr-v1', category: 'trick-room', description: 'Actor faster, no Trick Room', actor: { speedEv: 252, speedIv: 31 }, opponent: { speedEv: 0, speedIv: 31 } },
  { id: 'speed-trickroom-actor-faster-with-tr-v1', category: 'trick-room', description: 'Actor faster, Trick Room active (order reversed)', actor: { speedEv: 252, speedIv: 31 }, opponent: { speedEv: 0, speedIv: 31 }, context: { trickRoom: true } },
  { id: 'speed-trickroom-actor-slower-no-tr-v1', category: 'trick-room', description: 'Actor slower, no Trick Room', actor: { speedEv: 0, speedIv: 31 }, opponent: { speedEv: 252, speedIv: 31 } },
  { id: 'speed-trickroom-actor-slower-with-tr-v1', category: 'trick-room', description: 'Actor slower, Trick Room active (order reversed)', actor: { speedEv: 0, speedIv: 31 }, opponent: { speedEv: 252, speedIv: 31 }, context: { trickRoom: true } },
  { id: 'speed-trickroom-speed-tie-v1', category: 'trick-room', description: 'Exact Speed tie under Trick Room (still a tie, TR does not break ties)', actor: { speedEv: 252, speedIv: 31 }, opponent: { speedEv: 252, speedIv: 31 }, context: { trickRoom: true } },
  { id: 'speed-trickroom-priority-still-wins-v1', category: 'trick-room', description: 'Priority bracket still overrides Trick Room ordering', actor: { speedEv: 0, speedIv: 31, movePriority: 1 }, opponent: { speedEv: 252, speedIv: 31 }, context: { trickRoom: true } },

  // 14.7 -- Priority
  { id: 'speed-priority-both-zero-v1', category: 'priority', description: 'Both moves priority 0 (Speed decides)', actor: { speedEv: 252, speedIv: 31 }, opponent: { speedEv: 0, speedIv: 31 } },
  { id: 'speed-priority-actor-plus1-v1', category: 'priority', description: 'Actor priority +1', actor: { speedEv: 0, speedIv: 31, movePriority: 1 }, opponent: { speedEv: 252, speedIv: 31 } },
  { id: 'speed-priority-opponent-plus1-v1', category: 'priority', description: 'Opponent priority +1', actor: { speedEv: 252, speedIv: 31 }, opponent: { speedEv: 0, speedIv: 31, movePriority: 1 } },
  { id: 'speed-priority-actor-negative-v1', category: 'priority', description: 'Actor negative priority', actor: { speedEv: 252, speedIv: 31, movePriority: -1 }, opponent: { speedEv: 0, speedIv: 31 } },
  { id: 'speed-priority-opponent-negative-v1', category: 'priority', description: 'Opponent negative priority', actor: { speedEv: 0, speedIv: 31 }, opponent: { speedEv: 252, speedIv: 31, movePriority: -2 } },
  { id: 'speed-priority-bracket-gap-ignores-speed-v1', category: 'priority', description: 'Large priority gap overrides a large Speed disadvantage', actor: { speedEv: 0, speedIv: 0, movePriority: 2 }, opponent: { speedEv: 252, speedIv: 31, movePriority: -1 } },
  { id: 'speed-priority-tie-resolved-by-speed-v1', category: 'priority', description: 'Equal nonzero priority bracket, resolved by Speed', actor: { speedEv: 252, speedIv: 31, movePriority: 1 }, opponent: { speedEv: 0, speedIv: 31, movePriority: 1 } },
  { id: 'speed-priority-tie-under-trickroom-v1', category: 'priority', description: 'Equal nonzero priority bracket under Trick Room (Speed tiebreak reversed)', actor: { speedEv: 252, speedIv: 31, movePriority: 1 }, opponent: { speedEv: 0, speedIv: 31, movePriority: 1 }, context: { trickRoom: true } },

  // 14.8 -- priority-changing abilities (Prankster, Gale Wings only; see unsupported-speed-interactions.json for the rest)
  { id: 'speed-ability-prankster-status-move-v1', category: 'priority-ability', description: 'Prankster grants +1 priority to a status move', actor: { ability: 'prankster', move: 'thunderwave', speedEv: 0, speedIv: 31 }, opponent: { speedEv: 252, speedIv: 31 } },
  { id: 'speed-ability-prankster-physical-move-unchanged-v1', category: 'priority-ability', description: 'Prankster does not affect a physical move', actor: { ability: 'prankster', move: 'tackle', speedEv: 0, speedIv: 31 }, opponent: { speedEv: 252, speedIv: 31 } },
  { id: 'speed-ability-gale-wings-full-hp-v1', category: 'priority-ability', description: 'Gale Wings grants +1 priority to a Flying move at full HP', actor: { ability: 'galewings', move: 'bravebird', speedEv: 0, speedIv: 31 }, opponent: { speedEv: 252, speedIv: 31 } },

  // 14.9 -- speed ties
  { id: 'speed-tie-calculated-exact-v1', category: 'speed-tie', description: 'Exact calculated Speed tie, no modifiers', actor: { speedEv: 252, speedIv: 31 }, opponent: { speedEv: 252, speedIv: 31 } },
  { id: 'speed-tie-effective-via-tailwind-v1', category: 'speed-tie', description: 'Different calculated Speed (actor at -2 stage), tied effective Speed once actor Tailwind (2x) is applied', actor: { speedEv: 0, speedIv: 31, speedStage: -2 }, opponent: { speedEv: 0, speedIv: 31 }, context: { actorTailwind: true } },
];

function main(): void {
  rejectUnknownArgs();
  const runId = arg('--run-id');
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId ?? 'missing-run-id'}/mechanics-reference`;
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) throw new Error('Valid --run-id is required');

  const fixtures: IndependentSpeedFixture[] = [];
  const unsupported: { fixtureId: string; reasons: string[] }[] = [];

  for (const testCase of CASES) {
    const actor = buildActor(testCase.actor);
    const opponent = buildActor(testCase.opponent);
    const draft: IndependentSpeedFixture = {
      fixtureId: testCase.id,
      description: testCase.description,
      generation: 9,
      formatId: FORMAT_ID,
      actor,
      opponent,
      battleContext: {
        doubles: true,
        actorTailwind: false,
        opponentTailwind: false,
        trickRoom: false,
        seed: SEED,
        ...testCase.context,
      },
      expected: {
        actorCalculatedSpeed: 0, actorEffectiveSpeed: 0, actorPriorityBracket: 0,
        opponentCalculatedSpeed: 0, opponentEffectiveSpeed: 0, opponentPriorityBracket: 0,
        actionOrder: 'unsupported', speedTie: false, trickRoomReversedOrder: false,
      },
      referenceMethod: 'vendored-reference',
      sourceReferences: ['@pkmn/sim@0.10.11'],
      calculationSteps: [
        'construct gen 9 VGC doubles battle with actor and opponent',
        'switch both sides in (both active slots filled)',
        'apply battle context (weather/terrain/tailwind/trick room)',
        'apply per-actor status and stat stage',
        'read structured calculated/effective Speed via Pokemon.getStat',
        'resolve priority bracket via Battle.runEvent(ModifyPriority)',
        'resolve action order via Battle.prototype.comparePriority and Pokemon.getActionSpeed',
      ],
      assumptions: [`category:${testCase.category}`],
      limitations: testCase.limitations ?? [],
      inputDigest: '', resultDigest: '', fixtureDigest: '',
    };

    const result = calculateIndependentSpeed(draft);
    if (!result.supported) {
      unsupported.push({ fixtureId: draft.fixtureId, reasons: result.unsupportedReasons });
      continue;
    }
    const withExpected: IndependentSpeedFixture = {
      ...draft,
      expected: {
        actorCalculatedSpeed: result.actorCalculatedSpeed,
        actorEffectiveSpeed: result.actorEffectiveSpeed,
        actorPriorityBracket: result.actorPriorityBracket,
        opponentCalculatedSpeed: result.opponentCalculatedSpeed,
        opponentEffectiveSpeed: result.opponentEffectiveSpeed,
        opponentPriorityBracket: result.opponentPriorityBracket,
        actionOrder: result.actionOrder,
        speedTie: result.speedTie,
        trickRoomReversedOrder: result.trickRoomReversedOrder,
      },
      inputDigest: result.inputDigest,
      resultDigest: result.resultDigest,
    };
    fixtures.push({ ...withExpected, fixtureDigest: stableDigest(withExpected) });
  }

  const reasonCodes: string[] = [];
  const previousPath = path.resolve(outputDir, 'speed-canonical-fixtures.json');
  if (fs.existsSync(previousPath)) {
    const archivePath = path.resolve(outputDir, 'speed-canonical-fixtures.pre-actor-opponent-contract.json');
    if (!fs.existsSync(archivePath)) {
      fs.copyFileSync(previousPath, archivePath);
      reasonCodes.push('ARTIFACT_EXISTING_FILE_PRESERVED');
    }
  }

  writeAtomic(path.resolve(outputDir, 'speed-canonical-fixtures.json'), { schemaVersion: '2', acquisitionRunId: runId, seed: SEED, contractMigrationNote: 'Migrated from the single-Pokemon flat-ordering contract to the actor/opponent battle-context contract required to express calculated Speed, effective Speed, priority bracket, and action order as four separate concepts. The v1 fixture is preserved at speed-canonical-fixtures.pre-actor-opponent-contract.json.', fixtures }, reasonCodes);
  writeAtomic(path.resolve(outputDir, 'speed-reference-source-map.json'), { '@pkmn/sim': '0.10.11', method: 'battle-state', fixtureCount: fixtures.length }, reasonCodes);
  writeAtomic(path.resolve(outputDir, 'speed-reference-digests.json'), { fixtures: fixtures.map(fixture => ({ fixtureId: fixture.fixtureId, fixtureDigest: fixture.fixtureDigest })) }, reasonCodes);
  writeAtomic(path.resolve(outputDir, 'speed-reference-methodology.md'), [
    '# Speed Reference Methodology',
    '',
    'Fixtures are generated by running the real `@pkmn/sim@0.10.11` battle simulator (not a reimplementation) against structured input: a Battle is constructed in the `gen9vgc2024regg` doubles format, both sides are switched in via `Battle.actions.switchIn`, battle context (weather/tailwind/Trick Room/status/stage/item/ability) is applied via the engine\'s own setters (`Field.setWeather`, `Side.addSideCondition`, `Pokemon.setStatus`, `Pokemon.setAbility`, `Pokemon.boosts`), and results are read from structured engine state:',
    '',
    '- Calculated Speed: `Pokemon.getStat(\'spe\', false, true)` (stage-boosted, no item/ability/status modifiers).',
    '- Effective Speed: `Pokemon.getStat(\'spe\', false, false)` (all modifiers applied through the engine\'s own event pipeline).',
    '- Priority bracket: `Battle.runEvent(\'ModifyPriority\', ...)`, the same call the engine itself makes when resolving turn order.',
    '- Action order: `Battle.prototype.comparePriority`, the exact comparator the engine uses to sort the turn queue, fed `{priority, speed}` where `speed` comes from `Pokemon.getActionSpeed()` (which already applies the Trick Room inversion and the real 13-bit truncation quirk).',
    '',
    `${fixtures.length} fixtures generated across: calculated-speed, items, status, weather-ability, tailwind, trick-room, priority, priority-ability, speed-tie.`,
    unsupported.length > 0 ? `${unsupported.length} case(s) were rejected as unsupported by the adapter and are NOT included as fixtures: ${unsupported.map(item => item.fixtureId).join(', ')}.` : 'No cases were rejected as unsupported.',
  ].join('\n'), reasonCodes);

  console.log(JSON.stringify({ valid: true, runId, fixtureCount: fixtures.length, unsupportedCount: unsupported.length, unsupported, reasonCodes, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 4;
}
