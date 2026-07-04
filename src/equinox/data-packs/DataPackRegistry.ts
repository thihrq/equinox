import {
  EquinoxDataPackKind,
  EquinoxDataPackManifest,
  EquinoxDataPackReport,
  EquinoxDataPackValidationResult,
} from './DataPackManifest';
import { DataPackValidator } from './DataPackValidator';
import { EquinoxDataSourceStatus } from '../data/DataSourceReport';
import { VANILLA_GAME_PROFILES, VanillaGameProfile } from '../formats/VanillaGameProfiles';
import { RADICAL_RED_4_1_HARDCORE_INDIGO_LEAGUE } from '../radicalred/RadicalRedBossData';
import { RadicalRedDataPack } from '../radicalred/RadicalRedBossProfile';
import { CHAMPIONS_REGULATION_PROFILES } from '../champions/ChampionsRegulationData';
import { ChampionsRegulationProfile } from '../champions/ChampionsRegulationProfile';
import { CHAMPIONS_META_SOURCE_PACKS, ChampionsMetaSourcePack } from '../champions/ChampionsMetaSourcePack';

const emptyCounts = (): Record<EquinoxDataPackKind, number> => ({
  vanilla_pool: 0,
  boss_gauntlet: 0,
  regulation_profile: 0,
  eligible_roster: 0,
  meta_profile: 0,
});

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

export class DataPackRegistry {
  private readonly validator = new DataPackValidator();

  public buildReport(): EquinoxDataPackReport {
    const manifests = this.getManifests();
    const failingPacks = manifests
      .filter(manifest => manifest.validation.status === 'fail')
      .map(manifest => manifest.id);

    const warnings = manifests.flatMap(manifest =>
      manifest.validation.warnings.map(warning => `${manifest.title}: ${warning}`),
    );

    const packsByKind = manifests.reduce((acc, manifest) => {
      acc[manifest.kind] += 1;
      return acc;
    }, emptyCounts());

    return {
      generatedAt: new Date().toISOString(),
      overallStatus: this.calculateOverallStatus(manifests),
      confidence: this.calculateConfidence(manifests),
      totalPacks: manifests.length,
      packsByKind,
      manifests,
      failingPacks,
      warnings,
      updateActions: this.buildUpdateActions(manifests),
    };
  }

  public getManifests(): EquinoxDataPackManifest[] {
    const manifests: EquinoxDataPackManifest[] = [
      this.buildRadicalRedManifest(RADICAL_RED_4_1_HARDCORE_INDIGO_LEAGUE),
      ...Object.values(CHAMPIONS_REGULATION_PROFILES).flatMap(profile => this.buildChampionsManifests(profile)),
      ...Object.values(CHAMPIONS_META_SOURCE_PACKS).map(pack => this.buildChampionsMetaManifest(pack)),
      ...Object.values(VANILLA_GAME_PROFILES).map(profile => this.buildVanillaManifest(profile)),
    ];

    return manifests.sort((a, b) => `${a.gameFamily}:${a.kind}:${a.title}`.localeCompare(`${b.gameFamily}:${b.kind}:${b.title}`));
  }

  private buildRadicalRedManifest(pack: RadicalRedDataPack): EquinoxDataPackManifest {
    const pokemonCount = pack.bosses.reduce(
      (sum, boss) => sum + boss.variants.reduce((inner, variant) => inner + variant.pokemon.length, 0),
      0,
    );

    const baseManifest = {
      id: `boss:${pack.id}`,
      kind: 'boss_gauntlet' as const,
      title: pack.label,
      gameFamily: 'radical_red' as const,
      formatIds: ['radical_red', 'radical_red_hardcore', 'rr_hardcore'],
      dataVersion: pack.dataVersion,
      status: this.normalizeStatus(pack.dataStatus),
      sourceName: pack.sourceName,
      sourceUrl: pack.sourceUrl,
      sourceUpdatedAt: pack.sourceUpdatedAt,
      dataHash: pack.dataHash,
      recordCount: pokemonCount,
      refreshCadence: 'on_patch' as const,
      owner: 'Equinox Radical Red Data Pack',
      notes: [
        `${pack.bosses.length} boss lines loaded.`,
        `${pokemonCount} boss Pokémon entries across all variants.`,
        'Hardcore / Restricted Mode is the intentional Radical Red target for Equinox.',
      ],
    };

    return this.withValidation(baseManifest, this.validator.validateRadicalRedBossPack(pack));
  }

  private buildChampionsMetaManifest(pack: ChampionsMetaSourcePack): EquinoxDataPackManifest {
    const recordCount = pack.sources.length + pack.archetypes.length + pack.priorityThreats.length;
    const manifest = {
      id: `meta:${pack.id}`,
      kind: 'meta_profile' as const,
      title: pack.label,
      gameFamily: 'pokemon_champions' as const,
      formatIds: [`champions_reg_m_b_${pack.battleStyle}`, `champions_${pack.battleStyle}`, `champions_ranked_${pack.battleStyle}`],
      dataVersion: pack.dataVersion,
      status: this.normalizeStatus(pack.dataStatus),
      sourceName: pack.sources.map(source => source.sourceName).join(' + '),
      sourceUrl: pack.sources[0]?.sourceUrl,
      sourceUpdatedAt: pack.sourceUpdatedAt,
      dataHash: pack.sourceHash,
      recordCount,
      refreshCadence: 'seasonal' as const,
      owner: 'Equinox Pokémon Champions Meta Source Pack',
      notes: [
        `${pack.sources.length} source entries loaded.`,
        `${pack.archetypes.length} archetypes loaded.`,
        `${pack.priorityThreats.length} priority threats loaded.`,
        pack.sourcePolicy,
      ],
    };

    return this.withDefaultValidation(manifest);
  }

  private buildChampionsManifests(profile: ChampionsRegulationProfile): EquinoxDataPackManifest[] {
    const baseManifest = {
      id: `regulation:${profile.id}`,
      kind: 'regulation_profile' as const,
      title: profile.label,
      gameFamily: 'pokemon_champions' as const,
      formatIds: [profile.id, `champions_${profile.battleStyle}`, `champions_ranked_${profile.battleStyle}`],
      dataVersion: profile.dataVersion,
      status: this.normalizeStatus(profile.dataStatus),
      sourceName: profile.sourceName,
      sourceUrl: profile.sourceUrl,
      sourceUpdatedAt: profile.startDate,
      dataHash: profile.dataVersion,
      recordCount: profile.keyThreats.length,
      refreshCadence: 'seasonal' as const,
      owner: 'Equinox Pokémon Champions Regulation Pack',
      notes: [
        `${profile.keyThreats.length} key regulation threats are loaded.`,
        `${profile.battleStyle} profile with team preview ${profile.teamPreviewSize} and selected ${profile.selectedForBattle}.`,
        profile.megaEvolutionAllowed ? 'Mega Evolution enabled.' : 'Mega Evolution disabled.',
      ],
    };

    const rosterStatus = profile.rosterStatus === 'pending_full_import' ? 'pending' : 'community';
    const rosterManifest = {
      id: `roster:${profile.id}`,
      kind: 'eligible_roster' as const,
      title: `${profile.label} eligible roster`,
      gameFamily: 'pokemon_champions' as const,
      formatIds: [profile.id],
      dataVersion: profile.rosterStatus,
      status: rosterStatus as EquinoxDataSourceStatus,
      sourceName: profile.secondarySourceName ?? profile.sourceName,
      sourceUrl: profile.secondarySourceUrl ?? profile.sourceUrl,
      sourceUpdatedAt: profile.startDate,
      dataHash: undefined,
      recordCount: 0,
      refreshCadence: 'seasonal' as const,
      owner: 'Equinox Pokémon Champions Roster Pack',
      notes: [
        'Roster lock is intentionally separated from the regulation scorer.',
        'Import the official eligible Pokémon list when available for each Regulation Set.',
      ],
    };

    return [this.withDefaultValidation(baseManifest), this.withDefaultValidation(rosterManifest)];
  }

  private buildVanillaManifest(profile: VanillaGameProfile): EquinoxDataPackManifest {
    const recordCount = this.countVanillaPoolRecords(profile);
    const status: EquinoxDataSourceStatus = profile.poolStatus === 'verified'
      ? 'verified'
      : profile.poolStatus === 'pending'
        ? 'pending'
        : 'bootstrap';

    const manifest = {
      id: `vanilla:${profile.id}`,
      kind: 'vanilla_pool' as const,
      title: profile.label,
      gameFamily: 'core' as const,
      formatIds: [profile.id],
      dataVersion: `${profile.id}-pool-v1`,
      status,
      sourceName: 'Equinox Vanilla Game Profile Registry',
      sourceUrl: undefined,
      sourceUpdatedAt: undefined,
      dataHash: `${profile.id}:${profile.poolLabel}`,
      recordCount,
      refreshCadence: 'manual' as const,
      owner: 'Equinox Vanilla Game Pool Pack',
      notes: [
        `Pool: ${profile.poolLabel}.`,
        profile.strictPool ? 'Strict pool validation is enabled.' : 'Fallback pool is enabled until a verified data pack exists.',
        profile.allowMegas ? 'Mega Evolution can be used in this profile.' : 'Mega Evolution is blocked in this profile.',
      ],
    };

    return this.withDefaultValidation(manifest);
  }

  private countVanillaPoolRecords(profile: VanillaGameProfile): number {
    const rangeCount = profile.allowedDexRanges?.reduce(
      (sum, range) => sum + Math.max(0, range.to - range.from + 1),
      0,
    ) ?? 0;

    return rangeCount + (profile.allowedDexNumbers?.length ?? 0);
  }

  private withDefaultValidation(
    manifest: Omit<EquinoxDataPackManifest, 'validation'>,
  ): EquinoxDataPackManifest {
    return { ...manifest, validation: this.validator.validateManifest(manifest) };
  }

  private withValidation(
    manifest: Omit<EquinoxDataPackManifest, 'validation'>,
    validation: EquinoxDataPackValidationResult,
  ): EquinoxDataPackManifest {
    const defaultValidation = this.validator.validateManifest(manifest);
    const merged: EquinoxDataPackValidationResult = {
      status: validation.status === 'fail' || defaultValidation.status === 'fail'
        ? 'fail'
        : validation.status === 'warn' || defaultValidation.status === 'warn'
          ? 'warn'
          : 'pass',
      errors: this.unique([...defaultValidation.errors, ...validation.errors]),
      warnings: this.unique([...defaultValidation.warnings, ...validation.warnings]),
    };

    return { ...manifest, validation: merged };
  }

  private unique(values: string[]): string[] {
    return [...new Set(values)];
  }

  private normalizeStatus(status?: string): EquinoxDataSourceStatus {
    if (status === 'verified') return 'verified';
    if (status === 'community') return 'community';
    if (status === 'bootstrap') return 'bootstrap';
    if (status === 'pending' || status === 'pending_full_import') return 'pending';
    if (status === 'outdated') return 'outdated';
    return 'unknown';
  }

  private calculateOverallStatus(manifests: EquinoxDataPackManifest[]): EquinoxDataSourceStatus {
    if (manifests.some(manifest => manifest.validation.status === 'fail')) return 'outdated';
    if (manifests.some(manifest => manifest.status === 'outdated')) return 'outdated';
    if (manifests.some(manifest => manifest.status === 'pending')) return 'pending';
    if (manifests.some(manifest => manifest.status === 'bootstrap')) return 'bootstrap';
    if (manifests.some(manifest => manifest.status === 'community')) return 'community';
    if (manifests.length > 0 && manifests.every(manifest => manifest.status === 'verified')) return 'verified';
    return 'unknown';
  }

  private calculateConfidence(manifests: EquinoxDataPackManifest[]): number {
    if (!manifests.length) return 0;

    const score = manifests.reduce((sum, manifest) => sum + this.statusScore(manifest.status), 0) / manifests.length;
    const warningPenalty = manifests.filter(manifest => manifest.validation.status === 'warn').length * 0.75;
    const failurePenalty = manifests.filter(manifest => manifest.validation.status === 'fail').length * 8;

    return clamp(score - warningPenalty - failurePenalty);
  }

  private statusScore(status: EquinoxDataSourceStatus): number {
    switch (status) {
      case 'verified':
        return 94;
      case 'community':
        return 78;
      case 'bootstrap':
        return 66;
      case 'pending':
        return 52;
      case 'outdated':
        return 35;
      case 'unknown':
      default:
        return 46;
    }
  }

  private buildUpdateActions(manifests: EquinoxDataPackManifest[]): string[] {
    const actions: string[] = [];

    if (manifests.some(manifest => manifest.gameFamily === 'radical_red')) {
      actions.push('Revalidar o pacote Hardcore do Radical Red no Drive oficial quando houver changelog público da ROM hack.');
    }

    if (manifests.some(manifest => manifest.kind === 'eligible_roster' && manifest.status === 'pending')) {
      actions.push('Importar roster elegível por Regulation Set do Pokémon Champions antes de tratar recomendações como roster-locked.');
    }

    if (manifests.some(manifest => manifest.kind === 'meta_profile' && manifest.gameFamily === 'pokemon_champions')) {
      actions.push('Atualizar o Champions Meta Source Pack quando surgirem usage stats, resultados estáveis de M-B ou novo Regulation Set.');
    }

    if (manifests.some(manifest => manifest.kind === 'vanilla_pool' && manifest.status === 'bootstrap')) {
      actions.push('Substituir pools Vanilla bootstrap por data packs exatos por versão, rota, pós-game e trocas quando necessário.');
    }

    if (manifests.some(manifest => manifest.validation.status === 'fail')) {
      actions.push('Corrigir data packs com falha de validação antes de publicar release.');
    }

    return actions;
  }
}
