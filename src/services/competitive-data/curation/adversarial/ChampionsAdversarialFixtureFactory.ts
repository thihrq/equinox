import fs from 'fs';
import path from 'path';
import { CurationSetDraft } from '../CompetitiveCurationTypes';
import { ChampionsAdversarialCase, ChampionsAdversarialCategory, ChampionsAdversarialExpectedVerdict } from './ChampionsAdversarialAuditTypes';

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function sourceRunDir(curationRunId: string): string { return path.resolve('artifacts/champions-curation/mb', curationRunId); }
export function loadPositiveCandidate(curationRunId: string): CurationSetDraft {
  const drafts = JSON.parse(fs.readFileSync(path.join(sourceRunDir(curationRunId), 'drafts.json'), 'utf8')) as CurationSetDraft[];
  const candidate = drafts[0];
  if (!candidate) throw new Error('CHAMPIONS_SENTINEL_ARTIFACTS_MISSING');
  return candidate;
}
const legalityCases: Array<[string, string, string]> = [
  ['01', 'Assault Vest com golpe de status', 'ASSAULT_VEST_STATUS_MOVE'], ['02', 'Choice Specs com Protect', 'CHOICE_PROTECT'], ['03', 'Move fora do learnset', 'MOVE_NOT_LEGAL'], ['04', 'Move inexistente', 'MOVE_CATALOG_MISSING'], ['05', 'Ability de outra forma', 'ABILITY_NOT_LEGAL'], ['06', 'Ability inexistente', 'ABILITY_CATALOG_MISSING'], ['07', 'Mega Stone incorreta', 'MEGA_STONE_INCOMPATIBLE'], ['08', 'Mega Stone de outra especie', 'MEGA_STONE_INCOMPATIBLE'], ['09', 'EV total acima de 510', 'EV_TOTAL_INVALID'], ['10', 'EV individual acima de 252', 'EV_VALUE_INVALID'], ['11', 'EV negativo', 'EV_VALUE_INVALID'], ['12', 'IV acima de 31', 'IV_VALUE_INVALID'], ['13', 'IV negativo', 'IV_VALUE_INVALID'], ['14', 'Natureza inexistente', 'NATURE_NOT_FOUND'], ['15', 'Cinco moves', 'MOVE_COUNT_INVALID'], ['16', 'Tres moves', 'MOVE_COUNT_INVALID'], ['17', 'Move duplicado', 'MOVE_DUPLICATE'], ['18', 'Pokemon provisional', 'POKEMON_PROVISIONAL'], ['19', 'Pokemon fora da elegibilidade', 'POKEMON_NOT_ELIGIBLE'], ['20', 'Forma invalida', 'FORM_NOT_LEGAL'],
];
const qualityCases: Array<[string, string, string, ChampionsAdversarialExpectedVerdict]> = [
  ['21', 'Natureza fisica com moves especiais', 'NATURE_ROLE_MISMATCH', 'human-review-required'], ['22', 'Natureza especial com moves fisicos', 'NATURE_ROLE_MISMATCH', 'human-review-required'], ['23', 'Light Clay sem screens', 'ITEM_ROLE_MISMATCH', 'human-review-required'], ['24', 'Focus Sash sem funcao defensavel', 'ITEM_ROLE_MISMATCH', 'human-review-required'], ['25', 'Role Trick Room sem Trick Room', 'ROLE_EVIDENCE_MISSING', 'human-review-required'], ['26', 'Role Tailwind sem Tailwind', 'ROLE_EVIDENCE_MISSING', 'human-review-required'], ['27', 'Role weather sem clima', 'ROLE_EVIDENCE_MISSING', 'human-review-required'], ['28', 'Role redirection sem move', 'ROLE_EVIDENCE_MISSING', 'human-review-required'], ['29', 'Moves redundantes', 'MOVE_PURPOSE_REDUNDANCY', 'human-review-required'], ['30', 'Zero Speed IV sem justificativa', 'IV_RATIONALE_MISSING', 'human-review-required'], ['31', 'Zero Attack IV em atacante fisico', 'IV_RATIONALE_MISSING', 'human-review-required'], ['32', 'Dependencia de parceiro unico', 'PARTNER_DEPENDENCY_UNPROVEN', 'human-review-required'], ['33', 'Item sem relacao com funcao', 'ITEM_ROLE_MISMATCH', 'human-review-required'], ['34', 'Cobertura sem alvo', 'COVERAGE_JUSTIFICATION_MISSING', 'human-review-required'], ['35', 'Calculo de dano indisponivel', 'DAMAGE_CALCULATION_UNAVAILABLE', 'human-review-required'],
];
export function createAdversarialFixtures(curationRunId: string): ChampionsAdversarialCase[] {
  const base = loadPositiveCandidate(curationRunId);
  const cases: ChampionsAdversarialCase[] = [];
  for (const [id, title, reason] of legalityCases) cases.push(makeCase(id, title, 'legality', reason, 'rejected', base));
  for (const [id, title, reason, verdict] of qualityCases) cases.push(makeCase(id, title, 'coherence', reason, verdict, base));
  for (let id = 36; id <= 39; id += 1) cases.push(makeCase(String(id), `Candidatos duplicados ${id}`, 'diversity', 'SET_CANDIDATES_NOT_MEANINGFULLY_DISTINCT', 'rejected', base));
  const teamReasons = ['ITEM_CLAUSE_VIOLATION', 'MEGA_CLAUSE_VIOLATION', 'FULL_TEAM_SIZE_INVALID', 'FULL_TEAM_SIZE_INVALID', 'DUPLICATE_SPECIES', 'POKEMON_PROVISIONAL', 'POKEMON_NOT_IN_ROSTER', 'MEGA_STONE_INCOMPATIBLE', 'BASE3_NOT_PRESERVED', 'BASE3_NOT_PRESERVED', 'RECOMMENDED_TRIO_ONLY'];
  for (let id = 40; id <= 50; id += 1) cases.push(makeCase(String(id), `Estrutura full-team ilegal ${id}`, 'team-legality', teamReasons[id - 40], 'rejected', base));
  const evidenceReasons = ['SOURCE_SNAPSHOT_DIGEST_MISSING', 'PACKAGE_DIGEST_MISSING', 'CANDIDATE_DIGEST_MISSING', 'MATCHUP_SCENARIOS_INSUFFICIENT', 'ADVERSE_SCENARIO_MISSING', 'FULL_TEAM_MINIMUM_STRUCTURES_NOT_MET', 'AGENT_VERSION_MISSING', 'POLICY_VERSION_MISSING', 'UNSUPPORTED_KO_CLAIM', 'INVENTED_PROBABILITY', 'SCENARIO_OUTCOME_JUSTIFICATION_MISSING', 'EVIDENCE_SOURCE_UNKNOWN', 'EVIDENCE_AUDIT_INCOMPLETE'];
  for (let id = 51; id <= 63; id += 1) cases.push(makeCase(String(id), `Evidencia incompleta ${id}`, 'evidence', evidenceReasons[id - 51], 'human-review-required', base));
  const promotionReasons = ['SOURCE_TYPE_FORBIDDEN', 'STATUS_FORBIDDEN', 'STATUS_FORBIDDEN', 'STATUS_FORBIDDEN', 'HUMAN_REVIEWED_FORBIDDEN', 'AUTOMATIC_PROMOTION_FORBIDDEN', 'PROMOTION_ATTEMPT_BLOCKED'];
  for (let id = 64; id <= 70; id += 1) cases.push(makeCase(String(id), `Promocao proibida ${id}`, 'promotion', promotionReasons[id - 64], 'rejected', base));
  for (let id = 71; id <= 74; id += 1) cases.push(makeCase(String(id), `Score nao vence blocker ${id}`, 'threshold', 'LEGALITY_BLOCKER_OVERRIDES_SCORE', 'rejected', base));
  cases.push(makeCase('75', 'Evidencia insuficiente vence score', 'threshold', 'EVIDENCE_AUDIT_INCOMPLETE', 'human-review-required', base));
  cases.push(makeCase('76', 'Controle positivo completo', 'evidence', 'CONTROL_POSITIVE', 'agent-reviewed', base));
  return cases;
}
function makeCase(id: string, title: string, category: ChampionsAdversarialCategory, reason: string, expectedVerdict: ChampionsAdversarialExpectedVerdict, base: CurationSetDraft): ChampionsAdversarialCase {
  const candidate = clone(base);
  return { caseId: `adversarial-${id}`, title, category, baseCandidateId: base.setId, candidate, mutation: reason, expectedVerdict, expectedReasonCodes: [reason], fixtureSource: 'adversarial-test-fixture', productionEligible: false };
}
