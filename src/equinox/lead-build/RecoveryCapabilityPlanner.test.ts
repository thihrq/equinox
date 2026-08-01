import { deriveRecoveryCapabilityPlan } from './RecoveryCapabilityPlanner';
import { FinalistRejectionAggregate } from './FinalistRejectionAggregator';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testRecoveryCapabilityPlanner() {
  console.log('[Equinox Test] Testando o planejador de capacidades de recuperação...');

  // 1. Snapshot Charizard + Whimsicott (todos falharam por Gelo, elegível para recovery)
  const agg1: FinalistRejectionAggregate = {
    strategyId: 'sun_offense',
    evaluatedFinalists: 20,
    acceptedFinalists: 0,
    rejectedFinalists: 20,
    legalCompleteFinalists: 20,
    defensivelyValidFinalists: 0,
    offensivelyValidFinalists: 20,
    setCoherentFinalists: 20,
    failuresByGate: { DefensiveQuality: 20 },
    failuresByReason: [
      { reasonCode: 'UNANSWERED_REPEATED_WEAKNESS', count: 20, attackType: 'Ice', finalistKeys: [] },
    ],
    failuresByAttackType: { Ice: 20 },
    dominantFailureReasons: ['UNANSWERED_REPEATED_WEAKNESS:Ice'],
  };

  const plan1 = deriveRecoveryCapabilityPlan(agg1);

  assert(plan1.eligible === true, 'Caso com falha por Gelo deve ser elegível para recovery');
  assert(plan1.requests.some(r => r.capability === 'TYPE_RESISTANCE' && r.attackType === 'Ice'), 'Deve solicitar TYPE_RESISTANCE contra Ice');
  assert(plan1.requests.some(r => r.capability === 'SAFE_SWITCH_IN' && r.attackType === 'Ice'), 'Deve solicitar SAFE_SWITCH_IN contra Ice');
  assert(plan1.maximumPasses <= 2, 'maximumPasses deve ser <= 2');

  // 2. Busca primária teve sucesso -> NÃO elegível para recovery
  const agg2: FinalistRejectionAggregate = {
    ...agg1,
    acceptedFinalists: 1,
  };
  const plan2 = deriveRecoveryCapabilityPlan(agg2);
  assert(plan2.eligible === false, 'Estratégia aceita na busca primária deve tornar recovery elegível = false');
  assert(plan2.ineligibilityReasons.includes('PRIMARY_SEARCH_SUCCEEDED'), 'Deve conter razão PRIMARY_SEARCH_SUCCEEDED');

  // 3. Lead ilegal -> NÃO elegível para recovery
  const plan3 = deriveRecoveryCapabilityPlan(agg1, { hasIllegalLead: true });
  assert(plan3.eligible === false, 'Lead ilegal deve tornar recovery elegível = false');
  assert(plan3.ineligibilityReasons.includes('ILLEGAL_LEAD'), 'Deve conter razão ILLEGAL_LEAD');

  // 4. Caso 1 da autorização 087-F — invariante do plano vazio.
  //
  // Nenhuma inelegibilidade fatal (parityValid ok, lead legal, formato válido,
  // nenhum finalista aceito na busca primária) mas a única razão de rejeição
  // agregada é um `reasonCode` que `deriveRecoveryCapabilityPlan` não mapeia
  // para nenhuma capability request. Reproduz exatamente o achado real da
  // investigação 087-E (estratégia `sun_offense`): um plano que seria
  // "provisoriamente elegível" mas fica sem nenhuma request derivada.
  const agg4: FinalistRejectionAggregate = {
    ...agg1,
    failuresByReason: [
      { reasonCode: 'UNMAPPED_REASON_CODE_WITHOUT_CAPABILITY', count: 20, finalistKeys: [] },
    ],
    failuresByAttackType: {},
    dominantFailureReasons: ['UNMAPPED_REASON_CODE_WITHOUT_CAPABILITY'],
  };
  const plan4 = deriveRecoveryCapabilityPlan(agg4, { parityValid: true });

  assert(plan4.requests.length === 0, 'Caso 1: nenhuma capability request deveria ter sido derivada.');
  assert(plan4.eligible === false, 'Caso 1: eligible deve ser false quando requests está vazio — eligible => requests.length > 0.');
  assert(
    plan4.ineligibilityReasons.includes('NO_CAPABILITY_REQUESTS_DERIVED'),
    'Caso 1: ineligibilityReasons deve conter NO_CAPABILITY_REQUESTS_DERIVED.',
  );

  // 5. 088-D Fase 3 — INSUFFICIENT_ROLE_COVERAGE não carrega qual role faltou.
  //
  // A hipótese da 088-D era que o planner devolveria uma request identificável
  // pelo role ausente (`request.role === targetRole`). `RecoveryCapabilityRequest`
  // não tem NENHUM campo `role`/`kind` — o único branch para esse reasonCode
  // mapeia sempre para `capability: 'POSITIONING'`, satisfeita por qualquer
  // candidato com golpe de pivô (Parting Shot/U-turn/Volt Switch/Flip Turn/
  // Chilly Reception — CandidateCapabilityClassifier.ts), sem relação alguma
  // com QUAL role (`fast-sweeper`, `win-condition` etc.) estava faltando.
  // Prova: duas rejeições por roles totalmente diferentes produzem a MESMA
  // request. A hipótese fica descartada por esta rodada, conforme instruído.
  const aggMissingFastSweeper: FinalistRejectionAggregate = {
    ...agg1,
    failuresByReason: [
      { reasonCode: 'INSUFFICIENT_ROLE_COVERAGE', count: 20, finalistKeys: [] },
    ],
    failuresByAttackType: {},
    dominantFailureReasons: ['INSUFFICIENT_ROLE_COVERAGE'],
  };
  const aggMissingWinCondition: FinalistRejectionAggregate = {
    ...aggMissingFastSweeper,
    strategyId: 'defensive_core',
  };

  const planFastSweeper = deriveRecoveryCapabilityPlan(aggMissingFastSweeper, { parityValid: true });
  const planWinCondition = deriveRecoveryCapabilityPlan(aggMissingWinCondition, { parityValid: true });

  assert(planFastSweeper.eligible === true, '088-D: plano com role ausente deve ser elegível (POSITIONING é um capability real).');
  assert(
    planFastSweeper.requests.some(r => r.capability === 'POSITIONING'),
    '088-D: INSUFFICIENT_ROLE_COVERAGE deve mapear para capability POSITIONING.',
  );
  assert(
    !('role' in planFastSweeper.requests[0]) && !('kind' in planFastSweeper.requests[0]),
    '088-D: RecoveryCapabilityRequest não tem campo role/kind — confirma que a request não identifica QUAL role faltou.',
  );
  assert(
    JSON.stringify(planFastSweeper.requests) === JSON.stringify(planWinCondition.requests),
    '088-D: duas rejeições por roles DIFERENTES (fast-sweeper vs win-condition) produzem a MESMA request — a hipótese de role-especificidade está refutada.',
  );

  console.log('✅ Caso 088-D (INSUFFICIENT_ROLE_COVERAGE não é role-específico — hipótese refutada) PASS');

  console.log('✅ RecoveryCapabilityPlanner testado com sucesso!');
}

if (require.main === module) {
  testRecoveryCapabilityPlanner();
}
