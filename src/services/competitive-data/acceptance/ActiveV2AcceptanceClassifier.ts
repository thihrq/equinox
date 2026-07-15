import type {
  ActiveV2ShadowReport,
  ActiveV2ShadowScenarioResult,
  ActiveV2ShadowPathResult,
} from '../../../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';
import {
  ACTIVE_V2_ACCEPTANCE_POLICY_V1,
  SET_QUALITY_RANK,
  CRITICAL_COMPARATORS,
  SetQualityCategory,
} from './ActiveV2AcceptancePolicy';
import type {
  CompetitiveClassification,
  AcceptanceReasonCode,
  ComparatorClassification,
  AcceptanceScenarioVerdict,
  ActiveV2AcceptanceReport,
} from './ActiveV2AcceptanceTypes';

export function parseSetAttributes(setId: string): { status?: string; sourceType?: string; sourceKind?: string } {
  if (setId.endsWith('-draft')) {
    return { status: 'active', sourceType: 'curated', sourceKind: 'mongo-active-staging' };
  }
  if (setId.endsWith('-verified')) {
    return { status: 'verified', sourceType: 'curated', sourceKind: 'mongo-active-staging' };
  }
  if (setId.endsWith('-reviewed')) {
    return { status: 'reviewed', sourceType: 'curated', sourceKind: 'mongo-active-staging' };
  }
  if (setId.endsWith('-fallback')) {
    return { status: 'fallback', sourceType: 'fallback', sourceKind: 'generic-fallback' };
  }
  if (setId.includes('-baseline')) {
    return { status: 'verified', sourceType: 'curated', sourceKind: 'controlled-snapshot' };
  }
  return {};
}

export function resolveSetQuality(
  status: string | undefined,
  sourceType: string | undefined,
  sourceKind: string | undefined,
  fallbackUsed: boolean,
): SetQualityCategory {
  if (fallbackUsed) {
    return 'generic-fallback';
  }
  if (sourceKind === 'local-pilot') {
    return 'local-pilot';
  }
  if (status === 'active') {
    return sourceType === 'curated' ? 'active-curated' : 'reviewed-generated';
  }
  if (status === 'verified') {
    return sourceType === 'curated' ? 'verified-curated' : 'verified-generated';
  }
  if (status === 'reviewed') {
    return sourceType === 'curated' ? 'reviewed-curated' : 'reviewed-generated';
  }
  if (status === 'fallback') {
    return 'generic-fallback';
  }
  if (!status && !sourceType && !sourceKind) {
    return 'missing';
  }
  return 'generic-fallback';
}

export function classifyComparator(
  compName: string,
  comparison: any,
  baselineResult: ActiveV2ShadowPathResult,
  activeV2Result: ActiveV2ShadowPathResult,
): ComparatorClassification {
  const diff = comparison[compName];
  const diffStatus: 'equal' | 'different' | 'error' = diff ? diff.status : 'error';

  if (diffStatus === 'error') {
    return {
      comparator: compName,
      diffStatus,
      classification: 'blocker',
      reasonCode: 'SHADOW_EVIDENCE_INVALID',
      explanation: `Critical comparison field for "${compName}" is missing or invalid.`,
    };
  }

  // Inicializadores padrão
  let classification: CompetitiveClassification = 'equivalent';
  let reasonCode: AcceptanceReasonCode = 'CRITICAL_COMPARATORS_EQUAL';
  let explanation = `Comparator ${compName} is equivalent.`;

  // 1. errorDiff
  if (compName === 'errorDiff') {
    const hasExecutionError =
      diffStatus === 'different' ||
      (baselineResult.errors && baselineResult.errors.length > 0) ||
      (activeV2Result.errors && activeV2Result.errors.length > 0);

    if (hasExecutionError) {
      classification = 'blocker';
      reasonCode = 'EXECUTION_ERROR_PRESENT';
      explanation = 'Execution errors detected in baseline or active V2 paths.';
    }
    return {
      comparator: compName,
      diffStatus,
      classification,
      reasonCode,
      explanation,
      baselineValue: baselineResult.errors,
      activeV2Value: activeV2Result.errors,
    };
  }

  // 2. fallbackDiff
  if (compName === 'fallbackDiff') {
    if (diffStatus === 'different' && activeV2Result.fallbackUsed === true) {
      classification = 'blocker';
      reasonCode = 'ACTIVE_V2_FALLBACK_INTRODUCED';
      explanation = 'Active V2 path introduced a fallback execution not present in baseline.';
    }
    return {
      comparator: compName,
      diffStatus,
      classification,
      reasonCode,
      explanation,
      baselineValue: baselineResult.fallbackUsed,
      activeV2Value: activeV2Result.fallbackUsed,
    };
  }

  // 3. selectedLeadStrategyDiff
  if (compName === 'selectedLeadStrategyDiff') {
    if (diffStatus === 'different') {
      classification = 'human-review-needed';
      reasonCode = 'CENTRAL_STRATEGY_CHANGED';
      explanation = `Central lead strategy changed from "${baselineResult.selectedLeadStrategy}" to "${activeV2Result.selectedLeadStrategy}".`;
    }
    return {
      comparator: compName,
      diffStatus,
      classification,
      reasonCode,
      explanation,
      baselineValue: baselineResult.selectedLeadStrategy,
      activeV2Value: activeV2Result.selectedLeadStrategy,
    };
  }

  // 4. setDiff
  if (compName === 'setDiff') {
    if (diffStatus === 'different') {
      // Comparar qualidades
      const baselineSets = baselineResult.setsConsumed || [];
      const activeSets = activeV2Result.setsConsumed || [];

      let hasRegression = false;
      let hasImprovement = false;

      const maxLen = Math.max(baselineSets.length, activeSets.length);
      for (let i = 0; i < maxLen; i++) {
        const baseSetId = baselineSets[i];
        const activeSetId = activeSets[i];

        const baseAttr = baseSetId ? parseSetAttributes(baseSetId) : {};
        const activeAttr = activeSetId ? parseSetAttributes(activeSetId) : {};

        const baseQuality = resolveSetQuality(baseAttr.status, baseAttr.sourceType, baseAttr.sourceKind, baselineResult.fallbackUsed);
        const activeQuality = resolveSetQuality(activeAttr.status, activeAttr.sourceType, activeAttr.sourceKind, activeV2Result.fallbackUsed);

        const baseRank = SET_QUALITY_RANK[baseQuality] ?? 0;
        const activeRank = SET_QUALITY_RANK[activeQuality] ?? 0;

        if (activeRank < baseRank) {
          hasRegression = true;
        } else if (activeRank > baseRank) {
          hasImprovement = true;
        }
      }

      if (hasRegression) {
        classification = 'regression';
        reasonCode = 'SET_QUALITY_REGRESSION';
        explanation = 'Active V2 consumed lower quality sets than baseline.';
      } else if (hasImprovement) {
        classification = 'improvement';
        reasonCode = 'SCORE_IMPROVEMENT';
        explanation = 'Active V2 consumed higher quality/curated sets compared to baseline.';
      } else {
        classification = 'acceptable-divergence';
        reasonCode = 'TACTICAL_VARIATION_ACCEPTABLE';
        explanation = 'Sets differ but quality ranks are equivalent.';
      }
    }
    return {
      comparator: compName,
      diffStatus,
      classification,
      reasonCode,
      explanation,
      baselineValue: baselineResult.setsConsumed,
      activeV2Value: activeV2Result.setsConsumed,
    };
  }

  // 5. scoreDiff
  if (compName === 'scoreDiff') {
    const baseScore = baselineResult.score;
    const activeScore = activeV2Result.score;
    const delta = activeScore - baseScore;
    const pct = baseScore === 0 ? null : (delta / Math.abs(baseScore)) * 100;

    if (delta < -10) {
      classification = 'regression';
      reasonCode = 'SCORE_MAJOR_REGRESSION';
      explanation = `Major score regression: delta is ${delta} points (${pct !== null ? pct.toFixed(1) + '%' : 'N/A'}).`;
    } else if (delta >= -10 && delta < -5) {
      classification = 'human-review-needed';
      reasonCode = 'SCORE_REVIEW_RANGE';
      explanation = `Score is in review range: delta is ${delta} points.`;
    } else if (delta >= -5 && delta <= 5) {
      if (diffStatus === 'equal') {
        classification = 'equivalent';
        reasonCode = 'CRITICAL_COMPARATORS_EQUAL';
        explanation = 'Scores are equal.';
      } else {
        classification = 'acceptable-divergence';
        reasonCode = 'TACTICAL_VARIATION_ACCEPTABLE';
        explanation = `Score variation is within acceptable bounds: delta is ${delta} points.`;
      }
    } else {
      // delta > 5
      classification = 'improvement';
      reasonCode = 'SCORE_IMPROVEMENT';
      explanation = `Score improved: delta is +${delta} points.`;
    }

    return {
      comparator: compName,
      diffStatus,
      classification,
      reasonCode,
      explanation,
      baselineValue: baseScore,
      activeV2Value: activeScore,
      scoreDeltaAbsolute: delta,
      scoreDeltaPercent: pct,
    };
  }

  // 6. Geral para outros comparadores
  if (diffStatus === 'different') {
    // Por padrão, se diferir nos comparadores críticos de dados táticos, necessita de revisão humana
    classification = 'human-review-needed';
    reasonCode = 'CENTRAL_STRATEGY_CHANGED';
    explanation = `Tactical values differ in ${compName}.`;
  }

  return {
    comparator: compName,
    diffStatus,
    classification,
    reasonCode,
    explanation,
    baselineValue: (baselineResult as any)[compName.replace('Diff', 'Used')] || (baselineResult as any)[compName.replace('Diff', 'Value')],
    activeV2Value: (activeV2Result as any)[compName.replace('Diff', 'Used')] || (activeV2Result as any)[compName.replace('Diff', 'Value')],
  };
}

export function classifyScenarioVerdict(
  scenario: ActiveV2ShadowScenarioResult,
): AcceptanceScenarioVerdict {
  const comparatorClassifications: ComparatorClassification[] = [];

  CRITICAL_COMPARATORS.forEach(comp => {
    const classification = classifyComparator(
      comp,
      scenario.comparison,
      scenario.baselineResult,
      scenario.activeV2Result
    );
    comparatorClassifications.push(classification);
  });

  // Determinar severidade agregada do cenário com base na precedência estrita
  const severities: CompetitiveClassification[] = [
    'blocker',
    'regression',
    'human-review-needed',
    'improvement',
    'acceptable-divergence',
    'equivalent',
  ];

  let scenarioClassification: CompetitiveClassification = 'equivalent';

  for (const sev of severities) {
    if (comparatorClassifications.some(c => c.classification === sev)) {
      scenarioClassification = sev;
      break;
    }
  }

  // Ajustes de integridade de melhorias / aceitação
  const scoreClass = comparatorClassifications.find(c => c.comparator === 'scoreDiff');
  const scoreDelta = scoreClass?.scoreDeltaAbsolute ?? 0;
  const roleClass = comparatorClassifications.find(c => c.comparator === 'roleDiff');
  const strategyClass = comparatorClassifications.find(c => c.comparator === 'leadStrategyDiff');
  const selStrategyClass = comparatorClassifications.find(c => c.comparator === 'selectedLeadStrategyDiff');
  const fallbackClass = comparatorClassifications.find(c => c.comparator === 'fallbackDiff');
  const errorClass = comparatorClassifications.find(c => c.comparator === 'errorDiff');
  const exportClass = comparatorClassifications.find(c => c.comparator === 'exportDiff');
  const setClass = comparatorClassifications.find(c => c.comparator === 'setDiff');
  const coverageClass = comparatorClassifications.find(c => c.comparator === 'teamDataCoverageDiff');
  const evaluationClass = comparatorClassifications.find(c => c.comparator === 'fullTeamEvaluationDiff');

  const canBeAcceptable =
    roleClass?.classification === 'equivalent' &&
    strategyClass?.classification === 'equivalent' &&
    selStrategyClass?.classification === 'equivalent' &&
    fallbackClass?.classification === 'equivalent' &&
    errorClass?.classification === 'equivalent' &&
    exportClass?.classification === 'equivalent' &&
    coverageClass?.classification === 'equivalent' &&
    evaluationClass?.classification === 'equivalent' &&
    setClass?.classification !== 'regression' &&
    scoreDelta >= -5 && scoreDelta <= 5;

  if (scenarioClassification === 'human-review-needed' && canBeAcceptable) {
    scenarioClassification = 'acceptable-divergence';
  }

  if (scenarioClassification === 'improvement') {
    // Melhorias não devem aprovar automaticamente se houver qualquer item crítico divergindo de forma inaceitável
    const hasUnapprovedDivergences = comparatorClassifications.some(c =>
      c.classification === 'blocker' ||
      c.classification === 'regression' ||
      c.classification === 'human-review-needed'
    );
    if (hasUnapprovedDivergences) {
      scenarioClassification = 'human-review-needed';
    }
  }

  const automaticApproval =
    scenarioClassification === 'equivalent' ||
    scenarioClassification === 'acceptable-divergence' ||
    scenarioClassification === 'improvement';

  const requiresHumanReview =
    scenarioClassification === 'human-review-needed' ||
    scenarioClassification === 'blocker' ||
    scenarioClassification === 'regression';

  return {
    scenarioId: scenario.scenarioId,
    comparatorClassifications,
    scenarioClassification,
    automaticApproval,
    requiresHumanReview,
  };
}

export function classifyActiveV2ShadowReport(
  evidence: ActiveV2ShadowReport,
): ActiveV2AcceptanceReport {
  const scenarioVerdicts = evidence.scenarios.map(scenario => classifyScenarioVerdict(scenario));

  const classificationCounts = {
    blocker: 0,
    regression: 0,
    'human-review-needed': 0,
    improvement: 0,
    'acceptable-divergence': 0,
    equivalent: 0,
  };

  scenarioVerdicts.forEach(v => {
    classificationCounts[v.scenarioClassification]++;
  });

  return {
    policyVersion: ACTIVE_V2_ACCEPTANCE_POLICY_V1.version,
    inputEvidenceDigest: '', // Preenchido no script principal a partir do buffer físico
    inputCommitSha: (evidence.aggregate as any).commitSha || '',
    inputActiveRunId: (evidence.aggregate as any).activeRunId || '',
    baselineSourceDigest: evidence.aggregate.baselineSourceDigest || '',
    activeV2DataDigest: evidence.aggregate.activeV2DataDigest || '',
    activeV2RecordCount: evidence.aggregate.activeV2RecordCount || 0,
    activeV2DataDigestAlgorithm: evidence.aggregate.activeV2DataDigestAlgorithm || '',
    evidenceValid: true,
    globalBlockers: [],
    classificationCounts,
    scenarioVerdicts,
    gateStatus: 'approved', // Será avaliado pelo ActiveV2AcceptanceGates
    automaticRolloutApproved: false,
    generatedAt: new Date().toISOString(),
  };
}
