import fs from 'fs';
import path from 'path';
import { Stage4CandidateContext } from './Stage4ExpertTypes';

const SENTINEL_ROOT = path.resolve('artifacts/champions-curation/mb/champions-mb-sentinel-champions-mb-sentinel-v1');
const PACKAGE_ROOT = path.resolve('src/equinox/data-packs/competitive/champions-reg-mb-doubles');
const CALIBRATION_BATCH = path.resolve('artifacts/competitive-curation/champions-mb-human-calibration-champions-mb-human-calibration-v1/human-calibration/calibration-batch.json');

function readJson<T>(file: string): T { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; }

interface Draft { pokemonId: string; setId: string; sourceType: 'generated'; status: 'draft'; humanReviewed: false; automaticPromotionAllowed: false; declaredRoles: string[]; targetArchetypes: string[]; provenance: { candidateDigest: string }; [key: string]: unknown; }
interface FindingRecord { setId: string; legal?: boolean; coherent?: boolean; rolesSupported?: boolean; findings?: unknown[]; }
interface FullTeamRecord { setId: string; legal: boolean; structureId: string; findings?: unknown[]; }
interface MatchupRecord { setId: string; outcome: string; }
interface GenerationRecord { pokemonId: string; rosterVerified: boolean; speciesGeneration?: number; formGeneration?: number; verificationStatus: string; }
interface CalibrationBatch { packageDigest: string; rosterDigest: string; mechanicsDigest: string; }

export function loadStage4SentinelContexts(): Stage4CandidateContext[] {
  const drafts = readJson<Draft[]>(path.join(SENTINEL_ROOT, 'drafts.json'));
  const legality = readJson<FindingRecord[]>(path.join(SENTINEL_ROOT, 'legality.json'));
  const coherence = readJson<FindingRecord[]>(path.join(SENTINEL_ROOT, 'coherence.json'));
  const roles = readJson<FindingRecord[]>(path.join(SENTINEL_ROOT, 'roles.json'));
  const fullTeam = readJson<FullTeamRecord[]>(path.join(SENTINEL_ROOT, 'full-team.json'));
  const matchups = readJson<MatchupRecord[]>(path.join(SENTINEL_ROOT, 'matchups.json'));
  const generations = readJson<{ entries: GenerationRecord[] }>(path.join(PACKAGE_ROOT, 'generations.json')).entries;
  const calibration = readJson<CalibrationBatch>(CALIBRATION_BATCH);
  return drafts.map(draft => {
    const generation = generations.find(entry => entry.pokemonId === draft.pokemonId);
    const legal = legality.find(entry => entry.setId === draft.setId);
    const coherent = coherence.find(entry => entry.setId === draft.setId);
    const role = roles.find(entry => entry.setId === draft.setId);
    const teams = fullTeam.filter(entry => entry.setId === draft.setId);
    const scenarios = matchups.filter(entry => entry.setId === draft.setId);
    const archetype = draft.targetArchetypes[0] ?? 'unknown';
    return {
      candidate: {
        candidateId: draft.setId,
        candidateDigest: draft.provenance.candidateDigest,
        pokemonId: draft.pokemonId,
        sourceType: 'generated',
        status: 'draft',
        humanReviewed: false,
        automaticPromotionAllowed: false,
        original: draft,
      },
      legal: legal?.legal === true,
      coherent: coherent?.coherent === true,
      rolesSupported: role?.rolesSupported === true,
      generationResolved: Boolean(generation?.speciesGeneration && generation.formGeneration),
      formResolved: Boolean(generation?.formGeneration),
      damageEvidence: false,
      speedEvidence: false,
      scenarioEvidenceCount: scenarios.length,
      favorableScenarioCount: scenarios.filter(scenario => scenario.outcome === 'supports-candidate').length,
      adverseScenarioCount: scenarios.filter(scenario => scenario.outcome === 'does-not-support-candidate').length,
      fullTeamEvidenceCount: teams.length,
      fullTeamLegal: teams.length === 5 && teams.every(team => team.legal),
      benchmarkEvidence: false,
      unsupportedMechanics: [],
      packageDigest: calibration.packageDigest,
      mechanicsDigest: calibration.mechanicsDigest,
      rosterDigest: calibration.rosterDigest,
      previousVerdict: 'agent-reviewed',
      archetype,
      isMega: draft.pokemonId.includes('-001') || draft.pokemonId.includes('-002'),
      isRegional: ['0026-001', '0038-001', '0059-001', '0080-002', '0157-001', '0199-001', '0503-001', '0571-001', '0618-001', '0706-001', '0713-001', '0724-001', '0745-001', '0745-002', '0902-001'].includes(draft.pokemonId),
      hasTrickRoom: archetype.toLowerCase().includes('trick'),
      hasTailwind: archetype.toLowerCase().includes('speed') || archetype.toLowerCase().includes('tailwind'),
      hasWeather: archetype.toLowerCase().includes('weather'),
      hasTerrain: archetype.toLowerCase().includes('terrain'),
    };
  });
}

export function loadStage4SourceArtifacts(): { sentinelRoot: string; packageRoot: string; calibrationBatch: CalibrationBatch } {
  return { sentinelRoot: SENTINEL_ROOT, packageRoot: PACKAGE_ROOT, calibrationBatch: readJson<CalibrationBatch>(CALIBRATION_BATCH) };
}
