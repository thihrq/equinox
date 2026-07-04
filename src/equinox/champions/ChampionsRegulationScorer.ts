import { TYPE_CHART } from '../../utils/TypeChart';
import { PokemonData } from '../core/AnalysisContext';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import {
  ChampionsCandidateFit,
  ChampionsRegulationAnalysis,
  ChampionsRegulationLevel,
  ChampionsRegulationProfile,
  ChampionsThreatAnswer,
  ChampionsRegulationThreat,
} from './ChampionsRegulationProfile';
import { ChampionsRegulationProfileRegistry } from './ChampionsRegulationData';

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, Math.round(value)));

const average = (values: number[]): number => {
  const valid = values.filter(value => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
};

export class ChampionsRegulationScorer {
  private readonly registry = new ChampionsRegulationProfileRegistry();

  public isApplicable(format: string): boolean {
    return this.registry.isChampionsFormat(format);
  }

  public getProfile(format: string): ChampionsRegulationProfile | undefined {
    return this.registry.getProfile(format);
  }

  public scoreCandidate(params: {
    baseTeam: PokemonData[];
    candidate: PokemonData;
    format: string;
  }): ChampionsCandidateFit {
    const { baseTeam, candidate, format } = params;
    const profile = this.getProfile(format);

    if (!profile) return { score: 0, reasons: [] };

    const current = this.scoreTeam(baseTeam, format);
    const next = this.scoreTeam([...baseTeam, candidate], format);
    const delta = next.score - current.score;
    const reasons: string[] = [];
    const traits = this.getTraits(candidate, format);

    if (profile.battleStyle === 'doubles') {
      if (traits.fakeOut || traits.intimidate || traits.redirection || traits.tailwind || traits.trickRoom) {
        reasons.push(`${candidate.name} adds Champions doubles board-control utility`);
      }

      if (traits.fieldControl) reasons.push(`${candidate.name} improves field control for Regulation ${profile.regulationSet}`);
      if (traits.speedControl) reasons.push(`${candidate.name} improves doubles speed control`);
    } else {
      if (traits.speedControl) reasons.push(`${candidate.name} improves Champions singles speed control`);
      if (traits.priority || traits.setupCheck) reasons.push(`${candidate.name} helps answer fast setup or endgame threats`);
      if (traits.steelOrFairy || traits.ghostOrDark) reasons.push(`${candidate.name} improves Regulation ${profile.regulationSet} defensive coverage`);
    }

    const threatDelta = next.roleCoverage.threatCoverage - current.roleCoverage.threatCoverage;
    if (threatDelta >= 8) reasons.push(`${candidate.name} improves answers into key Champions threats`);

    const metaSourceFit = this.scoreCandidateIntoMetaSource(candidate, profile);
    if (metaSourceFit.score > 0) reasons.push(...metaSourceFit.reasons);

    return {
      score: Math.round((delta + metaSourceFit.score) / 3),
      reasons: reasons.slice(0, 4),
    };
  }

  public scoreTeam(team: PokemonData[], format: string): ChampionsRegulationAnalysis {
    const profile = this.getProfile(format);

    if (!profile) {
      return this.emptyAnalysis(format);
    }

    const roleCoverage = profile.battleStyle === 'doubles'
      ? this.scoreDoublesRoles(team, format, profile)
      : this.scoreSinglesRoles(team, format, profile);

    const threatAnswers = profile.keyThreats.map(threat => this.scoreThreatAnswer(team, format, threat));
    const threatCoverage = average(threatAnswers.map(answer => answer.score));
    roleCoverage.threatCoverage = clamp((roleCoverage.threatCoverage + threatCoverage) / 2);

    const weightedScore =
      roleCoverage.speedControl * profile.weights.speedControl +
      roleCoverage.roleCompression * profile.weights.roleCompression +
      roleCoverage.threatCoverage * profile.weights.threatCoverage +
      roleCoverage.fieldControl * profile.weights.fieldControl +
      roleCoverage.megaReadiness * profile.weights.megaReadiness +
      roleCoverage.consistency * profile.weights.consistency;

    const totalWeight =
      profile.weights.speedControl +
      profile.weights.roleCompression +
      profile.weights.threatCoverage +
      profile.weights.fieldControl +
      profile.weights.megaReadiness +
      profile.weights.consistency;

    const score = clamp(weightedScore / totalWeight);
    const confidence = clamp(
      average([
        score,
        roleCoverage.consistency,
        threatCoverage,
        profile.rosterStatus === 'pending_full_import' ? 72 : 88,
        profile.metaSourceConfidence ?? 70,
      ]),
      35,
      95,
    );

    return {
      profileId: profile.id,
      regulationSet: profile.regulationSet,
      label: profile.label,
      battleStyle: profile.battleStyle,
      mode: profile.mode,
      seasonLabel: profile.seasonLabel,
      startDate: profile.startDate,
      endDate: profile.endDate,
      dataVersion: profile.dataVersion,
      dataStatus: profile.dataStatus,
      rosterStatus: profile.rosterStatus,
      sourceName: profile.sourceName,
      sourceUrl: profile.sourceUrl,
      secondarySourceName: profile.secondarySourceName,
      secondarySourceUrl: profile.secondarySourceUrl,
      metaSourcePackId: profile.metaSourcePackId,
      metaSourcePackLabel: profile.metaSourcePackLabel,
      metaSourceStatus: profile.metaSourceStatus,
      metaSourceConfidence: profile.metaSourceConfidence,
      sourceBreakdown: profile.sourceBreakdown ?? [],
      metaArchetypes: profile.metaArchetypes ?? [],
      megaEvolutionAllowed: profile.megaEvolutionAllowed,
      teamPreviewSize: profile.teamPreviewSize,
      selectedForBattle: profile.selectedForBattle,
      score,
      confidence,
      level: this.resolveLevel(score),
      roleCoverage,
      threatAnswers,
      keyThreats: profile.keyThreats,
      strengths: this.buildStrengths(profile, roleCoverage, threatAnswers),
      concerns: this.buildConcerns(profile, roleCoverage, threatAnswers),
      recommendations: this.buildRecommendations(profile, roleCoverage, threatAnswers),
      notes: profile.notes,
      warnings: profile.warnings,
      uiTags: profile.uiTags,
    };
  }

  private scoreSinglesRoles(
    team: PokemonData[],
    format: string,
    profile: ChampionsRegulationProfile,
  ): ChampionsRegulationAnalysis['roleCoverage'] {
    const traits = team.map(pokemon => this.getTraits(pokemon, format));
    const megaCount = team.filter(pokemon => pokemon.name.toLowerCase().includes('-mega')).length;
    const fastCount = traits.filter(trait => trait.fast || trait.veryFast).length;
    const priorityCount = traits.filter(trait => trait.priority).length;
    const defensiveAnswers = traits.filter(trait => trait.steelOrFairy || trait.ghostOrDark || trait.bulky).length;
    const breakers = traits.filter(trait => trait.breaker).length;
    const sourceMatches = this.countMetaSourceMatches(team, profile);

    return {
      speedControl: clamp(42 + fastCount * 14 + priorityCount * 9 + traits.filter(trait => trait.speedControl).length * 8),
      roleCompression: clamp(45 + defensiveAnswers * 8 + breakers * 6 + traits.filter(trait => trait.pivot).length * 7 + sourceMatches * 3),
      threatCoverage: clamp(40 + defensiveAnswers * 8 + priorityCount * 7 + fastCount * 5 + sourceMatches * 3),
      fieldControl: clamp(42 + traits.filter(trait => trait.hazardControl || trait.pivot).length * 9),
      megaReadiness: this.scoreMegaReadiness({ profile, megaCount, hasMegaPlan: traits.some(trait => trait.mega) }),
      consistency: clamp(50 + Math.min(4, defensiveAnswers) * 7 + Math.min(3, breakers) * 5 + Math.min(4, sourceMatches) * 4 - Math.max(0, megaCount - 1) * 20),
    };
  }

  private scoreDoublesRoles(
    team: PokemonData[],
    format: string,
    profile: ChampionsRegulationProfile,
  ): ChampionsRegulationAnalysis['roleCoverage'] {
    const traits = team.map(pokemon => this.getTraits(pokemon, format));
    const megaCount = team.filter(pokemon => pokemon.name.toLowerCase().includes('-mega')).length;

    const speedTools = traits.filter(trait => trait.tailwind || trait.trickRoom || trait.priority || trait.fast || trait.veryFast).length;
    const boardTools = traits.filter(trait => trait.fakeOut || trait.intimidate || trait.redirection || trait.terrain || trait.weather || trait.pivot).length;
    const spreadPressure = traits.filter(trait => trait.spreadPressure || trait.breaker).length;
    const supportCompression = traits.filter(trait => trait.fieldControl || trait.bulky || trait.pivot).length;
    const sourceMatches = this.countMetaSourceMatches(team, profile);

    return {
      speedControl: clamp(38 + speedTools * 12 + traits.filter(trait => trait.tailwind || trait.trickRoom).length * 12),
      roleCompression: clamp(42 + supportCompression * 9 + boardTools * 6 + sourceMatches * 3),
      threatCoverage: clamp(42 + spreadPressure * 7 + boardTools * 5 + speedTools * 4 + sourceMatches * 3),
      fieldControl: clamp(36 + boardTools * 12 + traits.filter(trait => trait.redirection || trait.terrain || trait.weather).length * 12 + sourceMatches * 2),
      megaReadiness: this.scoreMegaReadiness({ profile, megaCount, hasMegaPlan: traits.some(trait => trait.mega) }),
      consistency: clamp(48 + Math.min(4, boardTools) * 7 + Math.min(3, speedTools) * 5 + Math.min(3, supportCompression) * 5 + Math.min(5, sourceMatches) * 3 - Math.max(0, megaCount - 1) * 20),
    };
  }

  private scoreCandidateIntoMetaSource(
    candidate: PokemonData,
    profile: ChampionsRegulationProfile,
  ): { score: number; reasons: string[] } {
    const normalizedName = this.normalizePokemonName(candidate.name);
    const matchedArchetypes = (profile.metaArchetypes ?? []).filter(archetype => {
      const names = [...archetype.corePokemon, ...archetype.supportPokemon].map(name => this.normalizePokemonName(name));
      return names.some(name => normalizedName.includes(name) || name.includes(normalizedName));
    });

    if (!matchedArchetypes.length) return { score: 0, reasons: [] };

    const best = matchedArchetypes.sort((a, b) => b.priority - a.priority)[0];
    const coreNames = best.corePokemon.map(name => this.normalizePokemonName(name));
    const isCore = coreNames.some(name => normalizedName.includes(name) || name.includes(normalizedName));
    const reliabilityBonus = best.reliability === 'tournament_derived' ? 8 : best.reliability === 'official' ? 10 : 4;

    return {
      score: (isCore ? 14 : 9) + reliabilityBonus,
      reasons: [`${candidate.name} matches ${best.label} from the Champions meta source pack`],
    };
  }

  private countMetaSourceMatches(team: PokemonData[], profile: ChampionsRegulationProfile): number {
    const sourceNames = new Set<string>();

    for (const archetype of profile.metaArchetypes ?? []) {
      for (const name of [...archetype.corePokemon, ...archetype.supportPokemon]) {
        sourceNames.add(this.normalizePokemonName(name));
      }
    }

    if (!sourceNames.size) return 0;

    return team.filter(pokemon => {
      const normalizedName = this.normalizePokemonName(pokemon.name);
      return [...sourceNames].some(sourceName => normalizedName.includes(sourceName) || sourceName.includes(normalizedName));
    }).length;
  }

  private normalizePokemonName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/mega$/, '')
      .replace(/^mega/, '');
  }

  private scoreMegaReadiness(params: {
    profile: ChampionsRegulationProfile;
    megaCount: number;
    hasMegaPlan: boolean;
  }): number {
    const { profile, megaCount, hasMegaPlan } = params;

    if (!profile.megaEvolutionAllowed) return megaCount === 0 ? 86 : 35;
    if (megaCount === 1 && hasMegaPlan) return 88;
    if (megaCount > 1) return 35;

    return 70;
  }

  private scoreThreatAnswer(
    team: PokemonData[],
    format: string,
    threat: ChampionsRegulationThreat,
  ): ChampionsThreatAnswer {
    const answers = team
      .map(pokemon => this.scorePokemonIntoThreat(pokemon, format, threat))
      .sort((a, b) => b.score - a.score);

    const best = answers[0];
    const score = clamp(best?.score ?? 35);
    const reasons = best?.reasons ?? [`No clear answer found for ${threat.name}`];
    const warnings = best?.warnings ?? [`${threat.name} may be difficult under Regulation pressure`];

    return {
      threat,
      bestAnswer: best?.pokemon,
      score,
      confidence: clamp((score + threat.importance) / 2),
      level: this.resolveLevel(score),
      reasons,
      warnings,
    };
  }

  private scorePokemonIntoThreat(
    pokemon: PokemonData,
    format: string,
    threat: ChampionsRegulationThreat,
  ): { pokemon: string; score: number; reasons: string[]; warnings: string[] } {
    const types = getPokemonTypes(pokemon, format);
    const stats = getVariant(pokemon, format)?.baseStats;
    const speed = Number(stats?.spe ?? 0);
    const physicalBulk = Number(stats?.hp ?? 0) + Number(stats?.def ?? 0);
    const specialBulk = Number(stats?.hp ?? 0) + Number(stats?.spd ?? 0);
    const traits = this.getTraits(pokemon, format);

    let score = 45;
    const reasons: string[] = [];
    const warnings: string[] = [];

    for (const attackType of threat.types) {
      const multiplier = getDamageMultiplier(types, attackType);
      if (multiplier === 0) {
        score += 18;
        reasons.push(`${pokemon.name} is immune to ${threat.name}'s ${attackType} pressure`);
      } else if (multiplier <= 0.5) {
        score += 12;
        reasons.push(`${pokemon.name} resists ${threat.name}'s ${attackType} pressure`);
      } else if (multiplier >= 2) {
        score -= 14;
        warnings.push(`${pokemon.name} is weak to ${threat.name}'s ${attackType} pressure`);
      }
    }

    for (const ownType of types) {
      const resolvedType = Object.keys(TYPE_CHART).find(type => type.toLowerCase() === ownType.toLowerCase());
      if (!resolvedType) continue;

      const pressure = Math.max(
        ...threat.types.map(defType => TYPE_CHART[resolvedType]?.[defType] ?? 1),
      );

      if (pressure > 1) {
        score += 12;
        reasons.push(`${pokemon.name} pressures ${threat.name} with ${resolvedType} STAB`);
        break;
      }
    }

    if (speed >= threat.baseSpeed) {
      score += 12;
      reasons.push(`${pokemon.name} can naturally contest ${threat.name}'s speed tier`);
    } else if (traits.priority || traits.speedControl) {
      score += 8;
      reasons.push(`${pokemon.name} can offset ${threat.name}'s speed with priority or speed control`);
    }

    if (threat.category === 'Physical' && physicalBulk >= 185) score += 8;
    if (threat.category === 'Special' && specialBulk >= 185) score += 8;
    if (threat.category === 'Utility' && (traits.fieldControl || traits.pivot)) score += 8;

    if (score < 55) warnings.push(`${threat.name} remains a regulation pressure point`);

    return {
      pokemon: pokemon.name,
      score: clamp(score),
      reasons: reasons.slice(0, 3),
      warnings: warnings.slice(0, 2),
    };
  }

  private getTraits(pokemon: PokemonData, format: string) {
    const name = pokemon.name.toLowerCase();
    const types = getPokemonTypes(pokemon, format).map(type => type.toLowerCase());
    const roles = (pokemon.competitive?.roles ?? []).map(role => role.toLowerCase());
    const utilityTags = (pokemon.competitive?.utilityTags ?? []).map(tag => tag.toLowerCase());
    const offensiveTags = (pokemon.competitive?.offensiveTags ?? []).map(tag => tag.toLowerCase());
    const defensiveTags = (pokemon.competitive?.defensiveTags ?? []).map(tag => tag.toLowerCase());
    const teamStyles = (pokemon.competitive?.teamStyles ?? []).map(tag => tag.toLowerCase());
    const allTags = [...roles, ...utilityTags, ...offensiveTags, ...defensiveTags, ...teamStyles, name];
    const stats = getVariant(pokemon, format)?.baseStats;
    const hp = Number(stats?.hp ?? 0);
    const atk = Number(stats?.atk ?? 0);
    const def = Number(stats?.def ?? 0);
    const spa = Number(stats?.spa ?? 0);
    const spd = Number(stats?.spd ?? 0);
    const spe = Number(stats?.spe ?? 0);
    const bulk = hp + Math.max(def, spd);
    const power = Math.max(atk, spa);

    const hasAny = (keywords: string[]) => keywords.some(keyword => allTags.some(tag => tag.includes(keyword)) || name.includes(keyword));

    return {
      mega: name.includes('-mega'),
      fast: spe >= 100,
      veryFast: spe >= 120,
      bulky: bulk >= 185,
      breaker: power >= 112 || hasAny(['wallbreaker', 'breaker', 'sweeper']),
      pivot: hasAny(['pivot', 'regenerator', 'u-turn', 'volt switch']) || ['incineroar', 'rotom', 'landorus', 'corviknight'].some(key => name.includes(key)),
      speedControl: spe >= 100 || hasAny(['speed control', 'tailwind', 'trick room', 'priority', 'scarf']),
      priority: hasAny(['priority']) || ['kingambit', 'rillaboom', 'dragonite', 'chien-pao', 'scizor', 'azumarill'].some(key => name.includes(key)),
      setupCheck: hasAny(['haze', 'unaware', 'phazing', 'taunt']) || ['ditto', 'dondozo', 'skeledirge', 'toxapex', 'corviknight'].some(key => name.includes(key)),
      steelOrFairy: types.includes('steel') || types.includes('fairy'),
      ghostOrDark: types.includes('ghost') || types.includes('dark'),
      hazardControl: hasAny(['hazard removal', 'hazard setter', 'rapid spin', 'defog']) || ['great-tusk', 'corviknight', 'glimmora'].some(key => name.includes(key)),
      fakeOut: hasAny(['fake out']) || ['incineroar', 'rillaboom', 'kangaskhan', 'hariyama', 'grimmsnarl', 'sableye'].some(key => name.includes(key)),
      intimidate: hasAny(['intimidate']) || ['incineroar', 'landorus', 'arcanine', 'gyarados', 'salamence'].some(key => name.includes(key)),
      redirection: hasAny(['redirection', 'rage powder', 'follow me']) || ['amoonguss', 'indeedee', 'clefairy', 'togekiss', 'volcarona'].some(key => name.includes(key)),
      tailwind: hasAny(['tailwind']) || ['tornadus', 'whimsicott', 'talonflame', 'murkrow', 'pelipper'].some(key => name.includes(key)),
      trickRoom: hasAny(['trick room']) || ['indeedee', 'farigiraf', 'cresselia', 'hatterene', 'dusclops', 'porygon2'].some(key => name.includes(key)),
      terrain: hasAny(['terrain']) || ['rillaboom', 'indeedee', 'miraidon', 'tapu'].some(key => name.includes(key)),
      weather: hasAny(['weather']) || ['pelipper', 'torkoal', 'tyranitar', 'ninetales', 'abomasnow', 'koraidon', 'kyogre', 'groudon'].some(key => name.includes(key)),
      spreadPressure: hasAny(['spread']) || ['gholdengo', 'flutter-mane', 'ursaluna', 'heatran', 'sylveon', 'landorus'].some(key => name.includes(key)),
      fieldControl: hasAny(['support', 'utility', 'terrain', 'weather', 'redirection', 'tailwind', 'trick room']),
    };
  }

  private buildStrengths(
    profile: ChampionsRegulationProfile,
    roles: ChampionsRegulationAnalysis['roleCoverage'],
    threatAnswers: ChampionsThreatAnswer[],
  ): string[] {
    const strengths: string[] = [];

    if (roles.speedControl >= 75) strengths.push(`Strong speed-control structure for Champions ${profile.battleStyle}.`);
    if (roles.threatCoverage >= 75) strengths.push(`Reliable coverage into the main Regulation ${profile.regulationSet} threat list.`);
    if (roles.fieldControl >= 75 && profile.battleStyle === 'doubles') strengths.push('Board-control tools are present for doubles tempo management.');
    if (roles.megaReadiness >= 80) strengths.push('Mega Evolution plan is compatible with the current regulation profile.');
    if ((profile.metaSourceConfidence ?? 0) >= 80) strengths.push('Champions meta source pack has enough confidence to guide archetype weighting.');
    if (threatAnswers.filter(answer => answer.score >= 75).length >= Math.ceil(threatAnswers.length / 2)) {
      strengths.push('Most key regulation threats have at least one stable answer.');
    }

    if (strengths.length === 0) strengths.push('The team has a workable Regulation baseline, but still needs tighter season-specific validation.');

    return strengths.slice(0, 4);
  }

  private buildConcerns(
    profile: ChampionsRegulationProfile,
    roles: ChampionsRegulationAnalysis['roleCoverage'],
    threatAnswers: ChampionsThreatAnswer[],
  ): string[] {
    const concerns: string[] = [];
    const weakThreat = threatAnswers.find(answer => answer.score < 58);

    if (profile.rosterStatus === 'pending_full_import') {
      concerns.push('Full official allowed-roster import is not loaded yet; treat this as a Regulation M-B source-aware profile, not a roster-locked output.');
    }

    if ((profile.metaSourceStatus === 'bootstrap' || (profile.metaSourceConfidence ?? 100) < 78)) {
      concerns.push('Champions meta source confidence is still limited; refresh this pack when official usage or stable tournament results are available.');
    }

    if (roles.speedControl < 60) concerns.push('Speed control may be too thin for the current Champions ladder pace.');
    if (profile.battleStyle === 'doubles' && roles.fieldControl < 62) concerns.push('Doubles board control is limited; consider Fake Out, redirection, Tailwind, terrain, or weather support.');
    if (weakThreat) concerns.push(`Weakest Regulation ${profile.regulationSet} answer: ${weakThreat.threat.name}.`);

    return concerns.slice(0, 4);
  }

  private buildRecommendations(
    profile: ChampionsRegulationProfile,
    roles: ChampionsRegulationAnalysis['roleCoverage'],
    threatAnswers: ChampionsThreatAnswer[],
  ): string[] {
    const recommendations: string[] = [];
    const weakThreat = threatAnswers.find(answer => answer.score < 65);

    if (profile.battleStyle === 'doubles') {
      recommendations.push('Prioritize a reliable lead pair with speed control plus board-control pressure.');
      if (roles.fieldControl < 70) recommendations.push('Add or preserve a field-control tool such as Fake Out, redirection, Tailwind, terrain, weather, or Trick Room.');
    } else {
      recommendations.push('Prioritize direct answers to the fastest Regulation threats before optimizing generic balance.');
      if (roles.speedControl < 70) recommendations.push('Add priority, a fast revenge killer, or a safer anti-setup line.');
    }

    if (weakThreat) recommendations.push(`Improve the answer into ${weakThreat.threat.name} before treating this team as ladder-ready.`);
    recommendations.push(`Revalidate against Regulation ${profile.regulationSet} after every Pokémon Champions season update.`);
    if (profile.metaSourcePackLabel) recommendations.push(`Use ${profile.metaSourcePackLabel} as source context, not as final official usage data.`);

    return recommendations.slice(0, 4);
  }

  private resolveLevel(score: number): ChampionsRegulationLevel {
    if (score >= 84) return 'Excellent';
    if (score >= 74) return 'Strong';
    if (score >= 62) return 'Playable';
    if (score >= 50) return 'Fragile';
    return 'Unsafe';
  }

  private emptyAnalysis(format: string): ChampionsRegulationAnalysis {
    return {
      profileId: format,
      regulationSet: 'unknown',
      label: 'Pokémon Champions Regulation',
      battleStyle: 'singles',
      mode: 'ranked',
      seasonLabel: 'Unknown season',
      startDate: '',
      endDate: '',
      dataVersion: 'unknown',
      dataStatus: 'unknown',
      rosterStatus: 'pending_full_import',
      sourceName: 'Unknown',
      sourceUrl: '',
      sourceBreakdown: [],
      metaArchetypes: [],
      megaEvolutionAllowed: false,
      teamPreviewSize: 6,
      selectedForBattle: 3,
      score: 0,
      confidence: 0,
      level: 'Unsafe',
      roleCoverage: {
        speedControl: 0,
        roleCompression: 0,
        threatCoverage: 0,
        fieldControl: 0,
        megaReadiness: 0,
        consistency: 0,
      },
      threatAnswers: [],
      keyThreats: [],
      strengths: [],
      concerns: [],
      recommendations: [],
      notes: [],
      warnings: [],
      uiTags: [],
    };
  }
}
