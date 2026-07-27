import { ArchetypeCompositionRegistry } from './ArchetypeCompositionRegistry';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function runArchetypeCompositionRegistryValidatorTest() {
  const registry = new ArchetypeCompositionRegistry();
  const archetypes = registry.getAll();

  assert(archetypes.length >= 6, 'O registro deve conter ao menos 6 arquétipos base (Sun, Rain, TR, Tailwind, Terrains, Defensive).');

  const seenIds = new Set<string>();
  for (const arch of archetypes) {
    assert(!seenIds.has(arch.id), `ID de arquétipo duplicado: ${arch.id}`);
    seenIds.add(arch.id);

    assert(arch.supportedStrategyProfiles.length > 0, `Arquétipo ${arch.id} deve declarar ao menos um perfil de estratégia.`);
    assert(arch.plan.slots.length > 0, `Arquétipo ${arch.id} deve conter slots de composição.`);
  }

  // Check explicit Terrain profiles from Amendment #2
  const terrains = ['psychic_terrain', 'grassy_terrain', 'electric_terrain', 'misty_terrain'];
  for (const t of terrains) {
    assert(registry.getArchetype(t) !== undefined, `Perfil de terreno ${t} deve estar registrado no ArchetypeCompositionRegistry.`);
  }

  console.log('✅ ArchetypeCompositionRegistryValidator.test PASS');
}

if (require.main === module) {
  runArchetypeCompositionRegistryValidatorTest();
}
