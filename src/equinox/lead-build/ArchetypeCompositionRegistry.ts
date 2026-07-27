import type { TeamCompositionPlan } from './TeamCompositionPlan';

export interface ArchetypeCompositionDefinition {
  id: string;
  supportedStrategyProfiles: string[];
  plan: TeamCompositionPlan;
  validationVersion: string;
}

export class ArchetypeCompositionRegistry {
  private readonly archetypes = new Map<string, ArchetypeCompositionDefinition>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register({
      id: 'sun_offense',
      supportedStrategyProfiles: ['weather_sun', 'sun_offense'],
      validationVersion: '1.0.0',
      plan: {
        archetypeId: 'sun_offense',
        name: 'Sun Offense',
        validationVersion: '1.0.0',
        requiredCapabilities: ['sun_abuser', 'ice_resistance', 'physical_attacker'],
        preferredCapabilities: ['pivot', 'fake_out'],
        slots: [
          { slotId: '1', role: 'Sun Abuser', priority: 1, requiredCapabilities: [{ capabilityId: 'sun_abuser', required: true }], preferredCapabilities: [] },
          { slotId: '2', role: 'Defensive Answer', priority: 2, requiredCapabilities: [{ capabilityId: 'ice_resistance', required: true }], preferredCapabilities: [] },
          { slotId: '3', role: 'Physical Pressure', priority: 3, requiredCapabilities: [{ capabilityId: 'physical_attacker', required: true }], preferredCapabilities: [] },
          { slotId: '4', role: 'Board Control / Pivot', priority: 4, requiredCapabilities: [], preferredCapabilities: [{ capabilityId: 'pivot', required: false }] },
        ],
      },
    });

    this.register({
      id: 'rain_offense',
      supportedStrategyProfiles: ['weather_rain', 'rain_offense'],
      validationVersion: '1.0.0',
      plan: {
        archetypeId: 'rain_offense',
        name: 'Rain Offense',
        validationVersion: '1.0.0',
        requiredCapabilities: ['swift_swim', 'electric_resistance', 'special_attacker'],
        preferredCapabilities: ['water_pressure'],
        slots: [
          { slotId: '1', role: 'Rain Abuser', priority: 1, requiredCapabilities: [{ capabilityId: 'swift_swim', required: true }], preferredCapabilities: [] },
          { slotId: '2', role: 'Electric Pivot', priority: 2, requiredCapabilities: [{ capabilityId: 'electric_resistance', required: true }], preferredCapabilities: [] },
          { slotId: '3', role: 'Special Damage', priority: 3, requiredCapabilities: [{ capabilityId: 'special_attacker', required: true }], preferredCapabilities: [] },
          { slotId: '4', role: 'Support', priority: 4, requiredCapabilities: [], preferredCapabilities: [] },
        ],
      },
    });

    this.register({
      id: 'trick_room',
      supportedStrategyProfiles: ['trick_room', 'trick_room_offense'],
      validationVersion: '1.0.0',
      plan: {
        archetypeId: 'trick_room',
        name: 'Trick Room',
        validationVersion: '1.0.0',
        requiredCapabilities: ['slow_attacker', 'redirection', 'anti_taunt'],
        preferredCapabilities: ['fake_out'],
        slots: [
          { slotId: '1', role: 'Secondary Setter / Redirection', priority: 1, requiredCapabilities: [{ capabilityId: 'redirection', required: true }], preferredCapabilities: [] },
          { slotId: '2', role: 'Slow Sweeper', priority: 2, requiredCapabilities: [{ capabilityId: 'slow_attacker', required: true }], preferredCapabilities: [] },
          { slotId: '3', role: 'Support', priority: 3, requiredCapabilities: [], preferredCapabilities: [] },
          { slotId: '4', role: 'Pivot', priority: 4, requiredCapabilities: [], preferredCapabilities: [] },
        ],
      },
    });

    this.register({
      id: 'tailwind',
      supportedStrategyProfiles: ['tailwind', 'tailwind_rush'],
      validationVersion: '1.0.0',
      plan: {
        archetypeId: 'tailwind',
        name: 'Tailwind Rush',
        validationVersion: '1.0.0',
        requiredCapabilities: ['fast_attacker', 'board_control'],
        preferredCapabilities: ['wide_guard'],
        slots: [
          { slotId: '1', role: 'Fast Sweeper', priority: 1, requiredCapabilities: [{ capabilityId: 'fast_attacker', required: true }], preferredCapabilities: [] },
          { slotId: '2', role: 'Board Control', priority: 2, requiredCapabilities: [{ capabilityId: 'board_control', required: true }], preferredCapabilities: [] },
          { slotId: '3', role: 'Defensive Backbone', priority: 3, requiredCapabilities: [], preferredCapabilities: [] },
          { slotId: '4', role: 'Flex', priority: 4, requiredCapabilities: [], preferredCapabilities: [] },
        ],
      },
    });

    // Amendment #2: Explicit Terrain Profiles
    for (const terrain of ['psychic_terrain', 'grassy_terrain', 'electric_terrain', 'misty_terrain']) {
      this.register({
        id: terrain,
        supportedStrategyProfiles: [terrain, `terrain_${terrain}`],
        validationVersion: '1.0.0',
        plan: {
          archetypeId: terrain,
          name: terrain.replace('_', ' ').toUpperCase(),
          validationVersion: '1.0.0',
          requiredCapabilities: ['terrain_abuser', 'terrain_setter'],
          preferredCapabilities: ['priority_block'],
          slots: [
            { slotId: '1', role: 'Terrain Abuser', priority: 1, requiredCapabilities: [{ capabilityId: 'terrain_abuser', required: true }], preferredCapabilities: [] },
            { slotId: '2', role: 'Terrain Setter / Support', priority: 2, requiredCapabilities: [{ capabilityId: 'terrain_setter', required: true }], preferredCapabilities: [] },
            { slotId: '3', role: 'Pivot', priority: 3, requiredCapabilities: [], preferredCapabilities: [] },
            { slotId: '4', role: 'Coverage Sweeper', priority: 4, requiredCapabilities: [], preferredCapabilities: [] },
          ],
        },
      });
    }

    this.register({
      id: 'defensive_core',
      supportedStrategyProfiles: ['defensive_core', 'balance'],
      validationVersion: '1.0.0',
      plan: {
        archetypeId: 'defensive_core',
        name: 'Defensive Core',
        validationVersion: '1.0.0',
        requiredCapabilities: ['physical_wall', 'special_wall'],
        preferredCapabilities: ['regen_pivot'],
        slots: [
          { slotId: '1', role: 'Physical Wall', priority: 1, requiredCapabilities: [{ capabilityId: 'physical_wall', required: true }], preferredCapabilities: [] },
          { slotId: '2', role: 'Special Wall', priority: 2, requiredCapabilities: [{ capabilityId: 'special_wall', required: true }], preferredCapabilities: [] },
          { slotId: '3', role: 'Win Condition / Sweeper', priority: 3, requiredCapabilities: [], preferredCapabilities: [] },
          { slotId: '4', role: 'Pivot', priority: 4, requiredCapabilities: [], preferredCapabilities: [] },
        ],
      },
    });
  }

  public register(def: ArchetypeCompositionDefinition) {
    this.archetypes.set(def.id, def);
  }

  public getArchetype(id: string): ArchetypeCompositionDefinition | undefined {
    return this.archetypes.get(id);
  }

  public getAll(): readonly ArchetypeCompositionDefinition[] {
    return Array.from(this.archetypes.values());
  }
}
