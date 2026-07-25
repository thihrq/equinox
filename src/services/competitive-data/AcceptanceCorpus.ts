import fs from 'fs';
import path from 'path';

export interface AcceptanceFixture {
  fixtureId: string;
  category: string;
  archetype: string;
  currentMembers: [string, string, string];
  format: string;
  allowLegendaries: boolean;
  teamIdentity: string;
  runtimeMode: 'disabled' | 'validate-only' | 'shadow' | 'serve';
  expectedClass: 'accepted' | 'accepted-with-warnings' | 'rejected-as-expected' | 'fail-closed-as-expected';
  expectedLegality: boolean;
  fixtureDigest: string;
}

export class AcceptanceCorpus {
  public static generateCorpus(count = 150): AcceptanceFixture[] {
    const categories = ['balanced', 'offensive', 'defensive', 'anti_meta', 'creative'];
    const archetypes = [
      'standard_balance', 'hyper_offense', 'bulky_offense', 'trick_room',
      'tailwind', 'rain', 'sun', 'sand', 'snow', 'terrain', 'redirection', 'priority'
    ];

    const sampleCores: Array<[string, string, string]> = [
      ['Charizard', 'Jolteon', 'Lapras'],
      ['Garchomp', 'Rotom-Wash', 'Scizor'],
      ['Venusaur', 'Arcanine', 'Gyarados'],
      ['Incineroar', 'Rillaboom', 'Flutter Mane'],
      ['Urshifu-Rapid-Strike', 'Pelipper', 'Kingdra'],
      ['Torkoal', 'Venusaur', 'Heatran'],
      ['Tyranitar', 'Excadrill', 'Garchomp'],
      ['Abomasnow', 'Glaceon', 'Ninetales-Alola'],
      ['Indeedee', 'Armarouge', 'Torkoal'],
      ['Whimsicott', 'Urshifu', 'Ogerpon-Hearthflame'],
      ['Charizard', 'Charizard', 'Lapras'], // Core ilegal (espécie duplicada)
      ['', '', ''], // Core incompleto
    ];

    const fixtures: AcceptanceFixture[] = [];

    for (let i = 0; i < count; i++) {
      const core = sampleCores[i % sampleCores.length];
      const category = categories[i % categories.length];
      const archetype = archetypes[i % archetypes.length];

      const isIllegal = core[0] === core[1];
      const isIncomplete = !core[0];

      let expectedClass: 'accepted' | 'accepted-with-warnings' | 'rejected-as-expected' | 'fail-closed-as-expected' = 'accepted';
      let expectedLegality = true;

      if (isIllegal || isIncomplete) {
        expectedClass = 'rejected-as-expected';
        expectedLegality = false;
      }

      fixtures.push({
        fixtureId: `acc-fix-${(i + 1).toString().padStart(3, '0')}`,
        category,
        archetype,
        currentMembers: core,
        format: 'champions_reg_m_b_doubles',
        allowLegendaries: i % 2 === 0,
        teamIdentity: category,
        runtimeMode: 'validate-only',
        expectedClass,
        expectedLegality,
        fixtureDigest: `digest-fix-${i + 1}`,
      });
    }

    return fixtures;
  }

  public static saveCorpus(wave5RunId: string, fixtures: AcceptanceFixture[]): void {
    const outputDir = path.join(
      process.cwd(),
      'artifacts',
      'competitive-production-readiness',
      wave5RunId,
      'acceptance'
    );

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'fixture-index.json'), JSON.stringify(fixtures, null, 2));
    fs.writeFileSync(
      path.join(outputDir, 'fixture-digests.json'),
      JSON.stringify(fixtures.map(f => ({ fixtureId: f.fixtureId, digest: f.fixtureDigest })), null, 2)
    );
  }
}
