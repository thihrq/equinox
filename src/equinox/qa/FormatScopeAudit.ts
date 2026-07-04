import { Dex } from '@pkmn/dex';
import { MetaDatabase } from '../meta/MetaDatabase';
import { Threat } from '../threats/Threat';
import { FormatIntelligenceRegistry } from '../formats/FormatIntelligenceRegistry';
import {
  VANILLA_GAME_PROFILES,
  VanillaGameProfile,
  VanillaGameProfileRegistry,
} from '../formats/VanillaGameProfiles';
import {
  CHAMPIONS_REGULATION_PROFILES,
  ChampionsRegulationProfileRegistry,
} from '../champions/ChampionsRegulationData';
import { RADICAL_RED_4_1_HARDCORE_INDIGO_LEAGUE } from '../radicalred/RadicalRedBossData';

export type FormatScopeAuditStatus = 'pass' | 'warning' | 'fail';

export interface FormatScopeAuditCheck {
  id: string;
  label: string;
  status: FormatScopeAuditStatus;
  details: string[];
  errors: string[];
  warnings: string[];
}

export interface FormatScopeAuditReport {
  generatedAt: string;
  status: FormatScopeAuditStatus;
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  failedChecks: number;
  checks: FormatScopeAuditCheck[];
  errors: string[];
  warnings: string[];
}

interface MinimalPokemonData {
  name: string;
  dexNumber: number;
}

const uniq = <T>(items: T[]): T[] => [...new Set(items)];

const normalizeName = (name: string): string => name.trim();

const isPass = (check: FormatScopeAuditCheck): boolean => check.errors.length === 0 && check.warnings.length === 0;

const withStatus = (check: Omit<FormatScopeAuditCheck, 'status'>): FormatScopeAuditCheck => {
  const status: FormatScopeAuditStatus = check.errors.length > 0
    ? 'fail'
    : check.warnings.length > 0
      ? 'warning'
      : 'pass';

  return { ...check, status };
};

const resolveSpecies = (name: string) => {
  const normalized = normalizeName(name);
  const species = Dex.species.get(normalized);

  if (species.exists) return species;

  const fallbackAliases: Record<string, string> = {
    'Iron-Bundle': 'Iron Bundle',
    'Zacian-C': 'Zacian-Crowned',
    'Mega Gengar': 'Gengar-Mega',
    'Mega Salamence': 'Salamence-Mega',
  };

  const fallback = fallbackAliases[normalized];

  return fallback ? Dex.species.get(fallback) : species;
};

export class FormatScopeAudit {
  private readonly metaDatabase = new MetaDatabase();
  private readonly formatRegistry = new FormatIntelligenceRegistry();
  private readonly vanillaRegistry = new VanillaGameProfileRegistry();
  private readonly championsRegistry = new ChampionsRegulationProfileRegistry();

  public run(): FormatScopeAuditReport {
    const checks = [
      ...this.auditVanillaGameScopes(),
      this.auditRadicalRedScope(),
      ...this.auditChampionsScopes(),
      this.auditFormatAliases(),
    ];

    const failedChecks = checks.filter(check => check.status === 'fail').length;
    const warningChecks = checks.filter(check => check.status === 'warning').length;
    const passedChecks = checks.filter(check => check.status === 'pass').length;

    return {
      generatedAt: new Date().toISOString(),
      status: failedChecks > 0 ? 'fail' : warningChecks > 0 ? 'warning' : 'pass',
      totalChecks: checks.length,
      passedChecks,
      warningChecks,
      failedChecks,
      checks,
      errors: checks.flatMap(check => check.errors.map(error => `${check.label}: ${error}`)),
      warnings: checks.flatMap(check => check.warnings.map(warning => `${check.label}: ${warning}`)),
    };
  }

  private auditVanillaGameScopes(): FormatScopeAuditCheck[] {
    return Object.values(VANILLA_GAME_PROFILES).map(profile => this.auditSingleVanillaProfile(profile));
  }

  private auditSingleVanillaProfile(profile: VanillaGameProfile): FormatScopeAuditCheck {
    const meta = this.metaDatabase.getFormat(profile.id);
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: string[] = [
      `Pool: ${profile.poolLabel}.`,
      `Strict pool: ${profile.strictPool ? 'enabled' : 'disabled'}.`,
      `Threats audited: ${meta.threats.length}.`,
    ];

    if (!profile.strictPool) {
      warnings.push(`${profile.label} ainda usa fallback não estrito; isso é aceitável apenas para perfis pending/placeholder.`);
    }

    const outOfScopeThreats: string[] = [];
    const unknownThreats: string[] = [];

    for (const threat of meta.threats) {
      const species = resolveSpecies(threat.name);

      if (!species.exists || species.num <= 0) {
        unknownThreats.push(threat.name);
        continue;
      }

      const pseudoPokemon: MinimalPokemonData = {
        name: species.name,
        dexNumber: species.num,
      };

      const isAllowed = this.vanillaRegistry.isPokemonAllowed(profile.id, pseudoPokemon as never);

      if (!isAllowed && profile.strictPool) {
        outOfScopeThreats.push(`${threat.name} (#${species.num})`);
      }
    }

    if (unknownThreats.length > 0) {
      errors.push(`Ameaças sem espécie reconhecida pelo @pkmn/dex: ${uniq(unknownThreats).join(', ')}.`);
    }

    if (outOfScopeThreats.length > 0) {
      errors.push(`Ameaças fora do pool de ${profile.poolLabel}: ${uniq(outOfScopeThreats).join(', ')}.`);
    }

    if (!meta.threats.every(threat => threat.tags?.includes('Game Pool Threat'))) {
      errors.push('Todas as ameaças Vanilla por jogo devem carregar a tag Game Pool Threat para evitar fallback para ladder moderna.');
    }

    return withStatus({
      id: `vanilla:${profile.id}`,
      label: `${profile.label} scope`,
      details,
      errors,
      warnings,
    });
  }

  private auditRadicalRedScope(): FormatScopeAuditCheck {
    const profile = this.formatRegistry.getProfile('radical_red');
    const meta = this.metaDatabase.getFormat('radical_red');
    const pack = RADICAL_RED_4_1_HARDCORE_INDIGO_LEAGUE;
    const errors: string[] = [];
    const warnings: string[] = [];
    const details = [
      `Format mode: ${profile.mode}.`,
      `Boss data enabled: ${profile.usesBossData ? 'yes' : 'no'}.`,
      `Bosses loaded: ${pack.bosses.length}.`,
      `Meta threats audited: ${meta.threats.length}.`,
    ];

    if (profile.mode !== 'boss_gauntlet') {
      errors.push('Radical Red precisa permanecer como boss_gauntlet, não meta_ladder ou generic_balance.');
    }

    if (!profile.usesBossData) {
      errors.push('Radical Red precisa marcar usesBossData=true para acionar a leitura de gauntlet.');
    }

    if (!pack.mode.toLowerCase().includes('hardcore')) {
      errors.push(`Data pack Radical Red precisa ser Hardcore/Restricted; modo atual: ${pack.mode}.`);
    }

    const expectedBosses = ['Lorelei', 'Bruno', 'Agatha', 'Lance', 'Champion'];
    const loadedBosses = pack.bosses.map(boss => boss.name);
    const missingBosses = expectedBosses.filter(boss => !loadedBosses.includes(boss));

    if (missingBosses.length > 0) {
      errors.push(`Bosses obrigatórios ausentes no data pack Radical Red: ${missingBosses.join(', ')}.`);
    }

    const nonBossThreats = meta.threats.filter(threat => !threat.tags?.includes('Boss Threat')).map(threat => threat.name);

    if (nonBossThreats.length > 0) {
      errors.push(`Ameaças do Radical Red sem tag Boss Threat: ${uniq(nonBossThreats).join(', ')}.`);
    }

    const bossPokemonCount = pack.bosses.reduce(
      (sum, boss) => sum + boss.variants.reduce((variantSum, variant) => variantSum + variant.pokemon.length, 0),
      0,
    );

    if (bossPokemonCount < 30) {
      warnings.push(`Data pack Radical Red possui apenas ${bossPokemonCount} entradas de boss Pokémon; verifique se o snapshot está completo.`);
    }

    return withStatus({
      id: 'radical_red:boss_gauntlet_scope',
      label: 'Radical Red Hardcore boss gauntlet scope',
      details,
      errors,
      warnings,
    });
  }

  private auditChampionsScopes(): FormatScopeAuditCheck[] {
    return Object.values(CHAMPIONS_REGULATION_PROFILES).map(profile => {
      const meta = this.metaDatabase.getFormat(profile.id);
      const canonical = this.championsRegistry.normalizeFormat(profile.id);
      const errors: string[] = [];
      const warnings: string[] = [];
      const details = [
        `Regulation: ${profile.regulationSet}.`,
        `Battle style: ${profile.battleStyle}.`,
        `Threats audited: ${meta.threats.length}.`,
        `Roster status: ${profile.rosterStatus}.`,
      ];

      if (canonical !== profile.id) {
        errors.push(`Alias de Champions deveria resolver ${profile.id}, mas resolveu ${canonical}.`);
      }

      if (!meta.id.includes('champions') && !meta.id.includes('reg_m_b')) {
        errors.push(`Meta de Champions resolveu id inesperado: ${meta.id}.`);
      }

      const profileThreats = new Set(profile.keyThreats.map(threat => threat.name));
      const metaThreats = new Set(meta.threats.map(threat => threat.name));
      const missingThreats = [...profileThreats].filter(name => !metaThreats.has(name));

      if (missingThreats.length > 0) {
        errors.push(`Meta de Champions não carregou ameaças-chave do Regulation Profile: ${missingThreats.join(', ')}.`);
      }

      if (profile.rosterStatus === 'pending_full_import') {
        warnings.push('Roster completo permitido ainda está pendente; mantenha o aviso de fonte/freshness na UI.');
      }

      if (profile.battleStyle === 'doubles' && !profile.rolePriorities.some(priority => /tailwind|trick room|fake out|terrain|redirection/i.test(priority))) {
        warnings.push('Perfil Doubles deveria carregar prioridades explícitas de campo, lead pressure ou controle de velocidade.');
      }

      return withStatus({
        id: `champions:${profile.id}`,
        label: `${profile.label} scope`,
        details,
        errors,
        warnings,
      });
    });
  }

  private auditFormatAliases(): FormatScopeAuditCheck {
    const cases: Array<[string, string]> = [
      ['FireRed / LeafGreen', 'vanilla_fire_red'],
      ['pokemon emerald', 'vanilla_emerald'],
      ['platinum', 'vanilla_platinum'],
      ['radical red', 'radical_red'],
      ['rr hardcore', 'radical_red'],
      ['pokemon champions singles', 'champions_reg_m_b_singles'],
      ['champions doubles', 'champions_reg_m_b_doubles'],
      ['national dex', 'national_dex'],
    ];

    const errors: string[] = [];
    const details: string[] = [];

    for (const [input, expected] of cases) {
      const actual = this.formatRegistry.normalizeFormat(input);
      details.push(`${input} -> ${actual}`);

      if (actual !== expected) {
        errors.push(`Alias '${input}' deveria resolver '${expected}', mas resolveu '${actual}'.`);
      }
    }

    return withStatus({
      id: 'format:aliases',
      label: 'Format alias canonicalization',
      details,
      errors,
      warnings: [],
    });
  }
}

export const runFormatScopeAudit = (): FormatScopeAuditReport => new FormatScopeAudit().run();
