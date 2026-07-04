import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import {
  EquinoxDataSourceEntry,
  EquinoxDataSourceReport,
  EquinoxDataSourceSeverity,
  EquinoxDataSourceStatus,
} from '../data/DataSourceReport';
import { VanillaGameProfileRegistry } from '../formats/VanillaGameProfiles';

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, Math.round(value)));

export class DataSourceEngine implements AnalysisEngine {
  public readonly name = 'DataSourceEngine';

  private readonly vanillaProfiles = new VanillaGameProfileRegistry();

  public execute(context: AnalysisContext): void {
    const entries: EquinoxDataSourceEntry[] = [];
    const format = context.analysis.formatIntelligence;

    if (format) {
      entries.push({
        id: `format:${format.id}`,
        title: format.label,
        category: 'format',
        status: this.normalizeStatus(format.dataStatus),
        severity: this.toSeverity(this.normalizeStatus(format.dataStatus)),
        version: format.dataVersion,
        scope: format.mode,
        sourceName: format.sourceName,
        sourceUrl: format.sourceUrl,
        sourceUpdatedAt: format.sourceUpdatedAt,
        notes: [format.description, `Engine strategy: ${format.engineStrategy}`],
        warnings: format.warning ? [format.warning] : [],
        refreshPolicy: this.buildFormatRefreshPolicy(format.gameFamily, format.mode),
      });
    }

    const vanilla = this.vanillaProfiles.getProfile(context.format);
    if (vanilla) {
      const status = vanilla.poolStatus === 'verified'
        ? 'verified'
        : vanilla.poolStatus === 'pending'
          ? 'pending'
          : 'bootstrap';

      entries.push({
        id: `vanilla:${vanilla.id}`,
        title: vanilla.label,
        category: 'vanilla_pool',
        status,
        severity: this.toSeverity(status),
        version: vanilla.poolLabel,
        scope: vanilla.strictPool ? 'Strict game pool' : 'Fallback game pool',
        sourceName: 'Equinox Vanilla Game Profile Registry',
        notes: [
          `Pool: ${vanilla.poolLabel}`,
          vanilla.allowMegas ? 'Mega Evolution is allowed for this profile.' : 'Mega Evolution is not allowed for this profile.',
          vanilla.allowRegionalForms ? 'Regional forms are allowed for this profile.' : 'Regional forms are blocked for this profile.',
        ],
        warnings: vanilla.warning ? [vanilla.warning] : [],
        refreshPolicy: 'Replace this bootstrap profile with a versioned encounter/story data pack when exact availability is imported.',
      });
    }

    const radicalRed = context.analysis.radicalRedGauntlet;
    if (radicalRed) {
      const status = this.normalizeStatus(radicalRed.dataStatus);
      entries.push({
        id: `radical-red:${radicalRed.profileId}`,
        title: radicalRed.label,
        category: 'boss_gauntlet',
        status,
        severity: this.toSeverity(status),
        version: radicalRed.dataVersion,
        scope: `Radical Red ${radicalRed.version} ${radicalRed.mode} Elite Four + Champion`,
        sourceName: radicalRed.sourceName,
        sourceUpdatedAt: radicalRed.sourceUpdatedAt,
        dataHash: radicalRed.dataHash,
        notes: [
          `${radicalRed.bossReports.length} boss lines loaded.`,
          `Worst boss score: ${radicalRed.worstBossScore}/100.`,
          `Consistency score: ${radicalRed.consistencyScore}/100.`,
        ],
        warnings: radicalRed.warnings,
        refreshPolicy: 'Revalidate against the official Radical Red Drive/Sheets whenever the ROM hack publishes a public update or changelog.',
      });
    }

    const champions = context.analysis.championsRegulation;
    if (champions) {
      const regulationStatus = this.normalizeStatus(champions.dataStatus);
      entries.push({
        id: `champions:${champions.profileId}`,
        title: champions.label,
        category: 'regulation',
        status: regulationStatus,
        severity: this.toSeverity(regulationStatus),
        version: champions.dataVersion,
        scope: `${champions.regulationSet} ${champions.battleStyle} · ${champions.startDate} — ${champions.endDate}`,
        sourceName: champions.sourceName,
        sourceUrl: champions.sourceUrl,
        notes: [
          `Battle style: ${champions.battleStyle}.`,
          `Team preview: ${champions.teamPreviewSize}; selected for battle: ${champions.selectedForBattle}.`,
          champions.megaEvolutionAllowed ? 'Mega Evolution enabled.' : 'Mega Evolution disabled.',
        ],
        warnings: champions.warnings,
        refreshPolicy: 'Refresh at every Pokémon Champions ranked season, Regulation Set update, or eligibility update.',
      });

      if (champions.metaSourcePackId) {
        const metaStatus = this.normalizeStatus(champions.metaSourceStatus ?? champions.dataStatus);
        entries.push({
          id: `champions-meta:${champions.metaSourcePackId}`,
          title: champions.metaSourcePackLabel ?? `${champions.regulationSet} meta source pack`,
          category: 'meta',
          status: metaStatus,
          severity: this.toSeverity(metaStatus),
          version: champions.metaSourcePackId,
          scope: `${champions.regulationSet} ${champions.battleStyle} source weighting · confidence ${champions.metaSourceConfidence ?? 0}/100`,
          sourceName: champions.sourceBreakdown?.map(source => source.sourceName).join(' + ') || champions.sourceName,
          sourceUrl: champions.secondarySourceUrl ?? champions.sourceUrl,
          notes: [
            `Source entries: ${champions.sourceBreakdown?.length ?? 0}.`,
            `Archetypes loaded: ${champions.metaArchetypes?.length ?? 0}.`,
            'Official rules are prioritized over community/tournament-derived source weighting.',
          ],
          warnings: [
            ...champions.warnings.filter(warning => warning.toLowerCase().includes('source') || warning.toLowerCase().includes('roster')),
            'Meta source pack is not the same as official usage statistics; refresh when reliable usage or event results are imported.',
          ],
          refreshPolicy: 'Refresh whenever Pokémon Champions publishes a new Regulation Set, when Victory Road updates regulation/team resources, or when usage data becomes available.',
        });
      }

      const rosterStatus = this.toRosterSourceStatus(champions.rosterStatus);
      entries.push({
        id: `champions-roster:${champions.profileId}`,
        title: `${champions.regulationSet} eligible roster`,
        category: 'roster',
        status: rosterStatus,
        severity: this.toSeverity(rosterStatus),
        version: champions.rosterStatus,
        scope: 'Allowed Pokémon / item / mechanic availability',
        sourceName: champions.secondarySourceName ?? champions.sourceName,
        sourceUrl: champions.secondarySourceUrl ?? champions.sourceUrl,
        notes: [
          'The scorer is regulation-aware, but full allowed-roster import is intentionally separated from the engine.',
          'Threat bootstrap is active until a versioned roster data pack is imported.',
        ],
        warnings: champions.rosterStatus === 'pending_full_import'
          ? ['Full Pokémon Champions eligible roster has not been imported yet. Treat results as regulation-aware bootstrap, not final roster-locked output.']
          : [],
        refreshPolicy: 'Import a roster data pack for each official Regulation Set before treating the format as fully locked.',
      });
    }

    if (format?.usesMeta && context.analysis.meta) {
      entries.push({
        id: `meta:${context.analysis.meta.id}`,
        title: context.analysis.meta.name,
        category: 'meta',
        status: 'community',
        severity: 'notice',
        version: context.analysis.meta.threatProfileName,
        scope: 'Curated competitive threat profile',
        sourceName: 'Equinox Meta Database',
        notes: context.analysis.meta.notes,
        warnings: [],
        refreshPolicy: 'Update when the ladder, tier list, or regulation threat profile changes materially.',
      });
    }

    const report = this.buildReport(entries);
    context.analysis.dataSources = report;

    context.addExplanation({
      engine: this.name,
      reason: `Data source confidence: ${report.confidence}/100 (${report.overallStatus}).`,
      value: report.confidence,
      impact: report.confidence >= 80 ? 'positive' : report.confidence >= 62 ? 'neutral' : 'negative',
      type: 'data-source',
    });
  }

  private buildReport(entries: EquinoxDataSourceEntry[]): EquinoxDataSourceReport {
    const criticalWarnings = entries.flatMap(entry =>
      entry.severity === 'critical' || entry.severity === 'warning'
        ? entry.warnings.map(warning => `${entry.title}: ${warning}`)
        : [],
    );

    const statusScores = entries.map(entry => this.statusScore(entry.status));
    const confidence = statusScores.length === 0
      ? 0
      : clamp(
          statusScores.reduce((sum, value) => sum + value, 0) / statusScores.length
          - criticalWarnings.length * 3,
        );

    const overallStatus = this.calculateOverallStatus(entries);

    return {
      overallStatus,
      confidence,
      entries,
      criticalWarnings,
      updateChecklist: this.buildUpdateChecklist(entries),
      generatedAt: new Date().toISOString(),
    };
  }

  private calculateOverallStatus(entries: EquinoxDataSourceEntry[]): EquinoxDataSourceStatus {
    if (entries.some(entry => entry.status === 'outdated')) return 'outdated';
    if (entries.some(entry => entry.status === 'pending')) return 'pending';
    if (entries.some(entry => entry.status === 'bootstrap')) return 'bootstrap';
    if (entries.some(entry => entry.status === 'community')) return 'community';
    if (entries.every(entry => entry.status === 'verified')) return 'verified';
    return 'unknown';
  }

  private buildUpdateChecklist(entries: EquinoxDataSourceEntry[]): string[] {
    const checklist: string[] = [];

    if (entries.some(entry => entry.category === 'boss_gauntlet')) {
      checklist.push('Revalidar o pacote Radical Red no Drive oficial antes de publicar recomendações como definitivas.');
    }

    if (entries.some(entry => entry.category === 'regulation' || entry.category === 'roster')) {
      checklist.push('Conferir se o Regulation Set do Pokémon Champions ainda é o atual e importar roster elegível quando disponível.');
    }

    if (entries.some(entry => entry.category === 'vanilla_pool' && entry.status !== 'verified')) {
      checklist.push('Trocar pools Vanilla bootstrap por data packs de encontros/versões quando a precisão por jogo for necessária.');
    }

    if (checklist.length === 0) {
      checklist.push('Fontes essenciais carregadas. Manter o versionamento dos data packs em toda atualização.');
    }

    return checklist;
  }

  private normalizeStatus(status?: string): EquinoxDataSourceStatus {
    if (status === 'verified') return 'verified';
    if (status === 'community') return 'community';
    if (status === 'bootstrap') return 'bootstrap';
    if (status === 'pending' || status === 'pending_full_import') return 'pending';
    if (status === 'outdated') return 'outdated';
    return 'unknown';
  }

  private toRosterSourceStatus(status: string): EquinoxDataSourceStatus {
    if (status === 'official_summary') return 'community';
    if (status === 'community_curated') return 'community';
    if (status === 'pending_full_import') return 'pending';
    return 'unknown';
  }

  private toSeverity(status: EquinoxDataSourceStatus): EquinoxDataSourceSeverity {
    if (status === 'verified') return 'ok';
    if (status === 'community' || status === 'bootstrap') return 'notice';
    if (status === 'pending' || status === 'unknown') return 'warning';
    return 'critical';
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

  private buildFormatRefreshPolicy(gameFamily: string, mode: string): string {
    if (gameFamily === 'radical_red') return 'Refresh on every Radical Red changelog or official Drive data update.';
    if (gameFamily === 'pokemon_champions') return 'Refresh on every Pokémon Champions Regulation Set or ranked season update.';
    if (mode === 'meta_ladder') return 'Refresh when the ladder metagame or curated threat list changes.';
    return 'Refresh only when the selected game pool/profile changes.';
  }
}
