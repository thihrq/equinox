import { Dex } from '@pkmn/dex';

export type CompetitiveSetSourceKind = 'curated' | 'observed' | 'database' | 'generated' | 'fallback' | 'unknown';
export type CompetitiveBattleType = 'singles' | 'doubles' | 'mixed' | 'unknown';
export type AuditSeverity = 'error' | 'warning';
export type ConfidenceBucket = 'high' | 'medium' | 'low' | 'unknown';

export interface AuditStatSpread {
  hp?: number;
  atk?: number;
  def?: number;
  spa?: number;
  spd?: number;
  spe?: number;
}

export interface CompetitiveSetAuditSource {
  kind?: CompetitiveSetSourceKind;
  name?: string;
  url?: string;
  updatedAt?: string;
  confidence?: number;
}

export interface CompetitiveSetAuditInput {
  pokemonName: string;
  formatId: string;
  setName?: string;
  item?: string;
  ability?: string;
  nature?: string;
  evs?: AuditStatSpread;
  ivs?: AuditStatSpread;
  moves?: string[];
  role?: string;
  roles?: string[];
  synergyTags?: string[];
  archetypes?: string[];
  regulationId?: string;
  battleType?: CompetitiveBattleType;
  source?: CompetitiveSetAuditSource;
  sourceDate?: string;
  confidence?: number;
}

export interface SetAuditResult {
  setId: string;
  legal: boolean;
  errors: string[];
  warnings: string[];
}

export interface SetCoherenceIssue {
  setId: string;
  pokemonId: string;
  code: string;
  severity: AuditSeverity;
  message: string;
}

export interface SetDuplicateGroup {
  fingerprint: string;
  setIds: string[];
}

export interface SetInventoryEntry {
  sourceKind: CompetitiveSetSourceKind;
  sourceName: string;
  formatId: string;
  regulationId: string;
  battleType: CompetitiveBattleType;
  sourceDate: string;
  confidenceBucket: ConfidenceBucket;
  count: number;
}

export interface SetCoverageEntry {
  pokemonId: string;
  present: boolean;
  curated: boolean;
  complete: boolean;
  bestConfidence: number;
  formats: string[];
}

export interface CompetitiveSetDataAuditOptions {
  formatId?: string;
  expectedPokemonIds?: string[];
  requireMetadata?: boolean;
}

export interface CompetitiveSetDataAuditSummary {
  totalSets: number;
  legalityErrors: number;
  legalityWarnings: number;
  coherenceIssues: number;
  duplicateGroups: number;
  coverageMissing: number;
  missingMetadata: number;
}

export interface CompetitiveSetDataAuditReport {
  summary: CompetitiveSetDataAuditSummary;
  inventory: SetInventoryEntry[];
  legality: SetAuditResult[];
  coherence: SetCoherenceIssue[];
  duplicates: SetDuplicateGroup[];
  coverage: SetCoverageEntry[];
  recommendedActions: string[];
}

interface NormalizedSetRecord {
  setId: string;
  pokemonName: string;
  pokemonId: string;
  formatId: string;
  setName: string;
  item: string;
  ability: string;
  nature: string;
  evs: Required<AuditStatSpread>;
  ivs: Required<AuditStatSpread>;
  moves: string[];
  role: string;
  roles: string[];
  synergyTags: string[];
  archetypes: string[];
  regulationId: string;
  battleType: CompetitiveBattleType;
  source: Required<CompetitiveSetAuditSource>;
}

const STAT_KEYS: Array<keyof AuditStatSpread> = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const DEFAULT_IVS: Required<AuditStatSpread> = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const MISSING_SOURCE = 'unclassified';

export function toCanonicalPokemonId(value: string): string {
  const raw = String(value ?? '').trim();
  const megaPrefix = raw.match(/^mega[\s-]+(.+)$/i);
  const canonical = megaPrefix ? `${megaPrefix[1]}-mega` : raw;
  return canonical.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function toCanonicalId(value: string): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function auditCompetitiveSetData(
  records: CompetitiveSetAuditInput[],
  options: CompetitiveSetDataAuditOptions = {},
): CompetitiveSetDataAuditReport {
  const normalized = records
    .filter(record => options.formatId === undefined || options.formatId === 'all' || record.formatId === options.formatId)
    .map((record, index) => normalizeRecord(record, index));

  const legality = normalized.map(validateLegality);
  const coherence = normalized.flatMap(validateCoherence);
  const duplicates = findDuplicateGroups(normalized);
  const coverage = buildCoverage(normalized, options.expectedPokemonIds ?? []);
  const inventory = buildInventory(normalized);
  const missingMetadata = normalized.filter(record => hasMissingMetadata(record, options.requireMetadata ?? true)).length;

  const summary: CompetitiveSetDataAuditSummary = {
    totalSets: normalized.length,
    legalityErrors: legality.reduce((sum, result) => sum + result.errors.length, 0),
    legalityWarnings: legality.reduce((sum, result) => sum + result.warnings.length, 0),
    coherenceIssues: coherence.length,
    duplicateGroups: duplicates.length,
    coverageMissing: coverage.filter(entry => !entry.present).length,
    missingMetadata,
  };

  return {
    summary,
    inventory,
    legality,
    coherence,
    duplicates,
    coverage,
    recommendedActions: buildRecommendedActions(summary, inventory, coherence),
  };
}

function normalizeRecord(record: CompetitiveSetAuditInput, index: number): NormalizedSetRecord {
  const pokemonId = toCanonicalPokemonId(record.pokemonName);
  const formatId = toCanonicalId(record.formatId);
  const regulationId = toCanonicalId(record.regulationId ?? record.formatId);
  const roles = normalizeList([...(record.roles ?? []), record.role ?? '', ...(record.synergyTags ?? [])]);
  const archetypes = normalizeList(record.archetypes ?? []);
  const sourceKind = normalizeSourceKind(record.source?.kind);
  const confidence = normalizeConfidence(record.source?.confidence ?? record.confidence, sourceKind);
  const sourceDate = record.source?.updatedAt ?? record.sourceDate ?? '';
  const setName = record.setName?.trim() || `${record.pokemonName} ${record.formatId} set`;
  const setId = [
    pokemonId,
    formatId,
    toCanonicalId(setName),
    index.toString().padStart(4, '0'),
  ].join(':');

  return {
    setId,
    pokemonName: record.pokemonName,
    pokemonId,
    formatId,
    regulationId,
    battleType: normalizeBattleType(record.battleType, formatId),
    setName,
    item: record.item?.trim() ?? '',
    ability: record.ability?.trim() ?? '',
    nature: record.nature?.trim() ?? '',
    evs: normalizeSpread(record.evs, { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }),
    ivs: normalizeSpread(record.ivs, DEFAULT_IVS),
    moves: (record.moves ?? []).filter(Boolean).map(move => move.trim()),
    role: record.role ?? '',
    roles,
    synergyTags: normalizeList(record.synergyTags ?? []),
    archetypes,
    source: {
      kind: sourceKind,
      name: record.source?.name?.trim() || MISSING_SOURCE,
      url: record.source?.url ?? '',
      updatedAt: sourceDate,
      confidence,
    },
  };
}

function normalizeSpread(spread: AuditStatSpread | undefined, fallback: Required<AuditStatSpread>): Required<AuditStatSpread> {
  return {
    hp: Number(spread?.hp ?? fallback.hp),
    atk: Number(spread?.atk ?? fallback.atk),
    def: Number(spread?.def ?? fallback.def),
    spa: Number(spread?.spa ?? fallback.spa),
    spd: Number(spread?.spd ?? fallback.spd),
    spe: Number(spread?.spe ?? fallback.spe),
  };
}

function normalizeSourceKind(kind?: CompetitiveSetSourceKind): CompetitiveSetSourceKind {
  if (kind === 'curated' || kind === 'observed' || kind === 'database' || kind === 'generated' || kind === 'fallback') return kind;
  return 'unknown';
}

function normalizeConfidence(value: number | undefined, kind: CompetitiveSetSourceKind): number {
  if (typeof value === 'number' && Number.isFinite(value)) return clamp(value, 0, 100);
  if (kind === 'curated') return 90;
  if (kind === 'observed') return 75;
  if (kind === 'database') return 68;
  if (kind === 'generated') return 45;
  if (kind === 'fallback') return 30;
  return 0;
}

function normalizeBattleType(input: CompetitiveBattleType | undefined, formatId: string): CompetitiveBattleType {
  if (input === 'singles' || input === 'doubles' || input === 'mixed') return input;
  if (/doubles|vgc|champions/i.test(formatId)) return 'doubles';
  if (/ou|uu|ru|nu|pu|zu|ubers|lc|singles/i.test(formatId)) return 'singles';
  return 'unknown';
}

function normalizeList(values: string[]): string[] {
  return [...new Set(values.map(toCanonicalId).filter(Boolean))];
}

function validateLegality(record: NormalizedSetRecord): SetAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!record.pokemonName) errors.push('Pokemon ausente.');
  if (!record.formatId) errors.push('Formato ausente.');
  if (!record.item) errors.push('Item ausente.');
  if (!record.ability) errors.push('Habilidade ausente.');
  if (!record.nature) errors.push('Natureza ausente.');
  if (record.moves.length !== 4) errors.push('Set precisa conter exatamente quatro golpes.');

  const evTotal = sumSpread(record.evs);
  if (evTotal > 510) errors.push('EVs excedem 510 pontos.');
  for (const key of STAT_KEYS) {
    if (record.evs[key] < 0 || record.evs[key] > 252) errors.push(`EV ${key} fora do intervalo 0-252.`);
    if (record.ivs[key] < 0 || record.ivs[key] > 31) errors.push(`IV ${key} fora do intervalo 0-31.`);
  }

  const species = Dex.species.get(record.pokemonName);
  if (!species.exists) warnings.push('Especie nao encontrada no Dex para validacao profunda.');
  if (record.item && !Dex.items.get(record.item).exists) warnings.push(`Item nao reconhecido pelo Dex: ${record.item}.`);
  if (record.nature && !Dex.natures.get(record.nature).exists) warnings.push(`Natureza nao reconhecida pelo Dex: ${record.nature}.`);

  for (const moveName of record.moves) {
    if (!Dex.moves.get(moveName).exists) warnings.push(`Golpe nao reconhecido pelo Dex: ${moveName}.`);
  }

  if (species.exists && record.ability) {
    const abilityId = toCanonicalId(record.ability);
    const abilityIds = Object.values(species.abilities ?? {}).map(ability => toCanonicalId(String(ability)));
    if (abilityIds.length > 0 && !abilityIds.includes(abilityId)) {
      warnings.push(`Habilidade ${record.ability} nao aparece nas habilidades conhecidas de ${record.pokemonName}.`);
    }
  }

  return {
    setId: record.setId,
    legal: errors.length === 0,
    errors,
    warnings,
  };
}

function validateCoherence(record: NormalizedSetRecord): SetCoherenceIssue[] {
  const issues: SetCoherenceIssue[] = [];
  const roleText = [...record.roles, record.role, ...record.archetypes].map(toCanonicalId).join(' ');
  const moves = record.moves.map(toCanonicalId);

  if ((/redirection|followme|ragepowder|support|defensiveglue/.test(roleText) || moves.includes('followme') || moves.includes('ragepowder')) && record.evs.hp < 100) {
    issues.push(issue(record, 'ROLE_SPREAD_MISMATCH', 'error', 'Set de suporte/redirecionamento sem investimento minimo em HP.'));
  }

  if (/specialwall|defensivespecial|calm/.test(roleText) && record.evs.spe >= 200) {
    issues.push(issue(record, 'ROLE_SPEED_MISMATCH', 'warning', 'Set descrito como parede especial com investimento alto em Speed.'));
  }

  if (/trickroom|slowattacker|semiroom/.test(roleText) && record.ivs.spe > 0) {
    issues.push(issue(record, 'TRICK_ROOM_SPEED_IV', 'warning', 'Atacante de Trick Room deveria justificar IV de Speed acima de 0.'));
  }

  const hasSpecialAttack = record.moves.some(move => {
    const dexMove = Dex.moves.get(move);
    return dexMove.exists && dexMove.category === 'Special' && Number(dexMove.basePower ?? 0) > 0;
  });
  const hasPhysicalAttack = record.moves.some(move => {
    const dexMove = Dex.moves.get(move);
    return dexMove.exists && dexMove.category === 'Physical' && Number(dexMove.basePower ?? 0) > 0;
  });
  if (hasSpecialAttack && !hasPhysicalAttack && record.ivs.atk > 0) {
    issues.push(issue(record, 'SPECIAL_ATTACKER_ATTACK_IV', 'warning', 'Atacante especial puro deveria justificar IV de Attack acima de 0.'));
  }

  if (moves.includes('bodypress') && record.evs.def < 100) {
    issues.push(issue(record, 'BODY_PRESS_DEFENSE_INVESTMENT', 'warning', 'Set com Body Press sem investimento defensivo suficiente.'));
  }

  if (record.source.kind === 'unknown') {
    issues.push(issue(record, 'UNCLASSIFIED_SOURCE', 'warning', 'Set sem classificacao de fonte.'));
  }

  if (!record.source.updatedAt) {
    issues.push(issue(record, 'MISSING_SOURCE_DATE', 'warning', 'Set sem data de fonte ou atualizacao.'));
  }

  if (record.battleType === 'unknown') {
    issues.push(issue(record, 'UNKNOWN_BATTLE_TYPE', 'warning', 'Set sem battleType claro para separar singles/doubles.'));
  }

  return issues;
}

function issue(record: NormalizedSetRecord, code: string, severity: AuditSeverity, message: string): SetCoherenceIssue {
  return {
    setId: record.setId,
    pokemonId: record.pokemonId,
    code,
    severity,
    message,
  };
}

function findDuplicateGroups(records: NormalizedSetRecord[]): SetDuplicateGroup[] {
  const groups = new Map<string, string[]>();

  for (const record of records) {
    const fingerprint = [
      record.pokemonId,
      record.regulationId,
      record.battleType,
      toCanonicalId(record.item),
      toCanonicalId(record.ability),
      ...record.moves.map(toCanonicalId).sort(),
    ].join('|');
    const setIds = groups.get(fingerprint) ?? [];
    setIds.push(record.setId);
    groups.set(fingerprint, setIds);
  }

  return [...groups.entries()]
    .filter(([, setIds]) => setIds.length > 1)
    .map(([fingerprint, setIds]) => ({ fingerprint, setIds }));
}

function buildCoverage(records: NormalizedSetRecord[], expectedPokemonIds: string[]): SetCoverageEntry[] {
  const ids = [...new Set(expectedPokemonIds.map(toCanonicalPokemonId).filter(Boolean))];
  return ids.map(pokemonId => {
    const matches = records.filter(record => record.pokemonId === pokemonId);
    const completeMatches = matches.filter(isCompleteRecord);
    return {
      pokemonId,
      present: matches.length > 0,
      curated: matches.some(record => record.source.kind === 'curated'),
      complete: completeMatches.length > 0,
      bestConfidence: matches.reduce((best, record) => Math.max(best, record.source.confidence), 0),
      formats: [...new Set(matches.map(record => record.formatId))],
    };
  });
}

function buildInventory(records: NormalizedSetRecord[]): SetInventoryEntry[] {
  const groups = new Map<string, SetInventoryEntry>();

  for (const record of records) {
    const key = [
      record.source.kind,
      record.source.name,
      record.formatId,
      record.regulationId,
      record.battleType,
      record.source.updatedAt,
      confidenceBucket(record.source.confidence),
    ].join('|');
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    groups.set(key, {
      sourceKind: record.source.kind,
      sourceName: record.source.name,
      formatId: record.formatId,
      regulationId: record.regulationId,
      battleType: record.battleType,
      sourceDate: record.source.updatedAt,
      confidenceBucket: confidenceBucket(record.source.confidence),
      count: 1,
    });
  }

  return [...groups.values()].sort((a, b) => b.count - a.count);
}

function buildRecommendedActions(
  summary: CompetitiveSetDataAuditSummary,
  inventory: SetInventoryEntry[],
  coherence: SetCoherenceIssue[],
): string[] {
  const actions: string[] = [];
  if (summary.missingMetadata > 0) {
    actions.push(`Adicionar metadados obrigatorios de fonte, data, battleType, regulacao e confianca em ${summary.missingMetadata} sets.`);
  }
  if (summary.duplicateGroups > 0) {
    actions.push(`Consolidar ${summary.duplicateGroups} grupos de sets duplicados antes de ranquear recomendacoes.`);
  }
  if (summary.coverageMissing > 0) {
    actions.push(`Preencher ou bloquear explicitamente ${summary.coverageMissing} entradas esperadas sem cobertura de set.`);
  }
  if (summary.legalityErrors > 0) {
    actions.push(`Corrigir ${summary.legalityErrors} erros objetivos de legalidade antes de publicar nova release.`);
  }
  const highSeverityCoherence = coherence.filter(issueEntry => issueEntry.severity === 'error').length;
  if (highSeverityCoherence > 0) {
    actions.push(`Revisar ${highSeverityCoherence} incoerencias fortes entre role, spread, golpes e item.`);
  }
  if (inventory.some(entry => entry.sourceKind === 'fallback' || entry.sourceKind === 'generated' || entry.sourceKind === 'unknown')) {
    actions.push('Separar fallback/generated/unknown de curated/observed para impedir que o motor trate baixa confianca como dado competitivo.');
  }
  if (inventory.some(entry => entry.battleType === 'unknown')) {
    actions.push('Classificar battleType dos sets restantes para impedir mistura entre singles e doubles.');
  }
  return actions;
}

function hasMissingMetadata(record: NormalizedSetRecord, requireMetadata: boolean): boolean {
  if (!requireMetadata) return false;
  return record.source.kind === 'unknown' ||
    record.source.name === MISSING_SOURCE ||
    !record.source.updatedAt ||
    record.battleType === 'unknown' ||
    !record.regulationId;
}

function isCompleteRecord(record: NormalizedSetRecord): boolean {
  return Boolean(record.item && record.ability && record.nature && record.moves.length === 4 && sumSpread(record.evs) <= 510);
}

function confidenceBucket(confidence: number): ConfidenceBucket {
  if (confidence >= 80) return 'high';
  if (confidence >= 55) return 'medium';
  if (confidence > 0) return 'low';
  return 'unknown';
}

function sumSpread(spread: Required<AuditStatSpread>): number {
  return STAT_KEYS.reduce((sum, key) => sum + spread[key], 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
