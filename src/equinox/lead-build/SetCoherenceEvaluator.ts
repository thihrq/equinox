import { SetCoherenceResult, SetCoherenceIssue, SetCoherenceReason } from './SetCoherenceTypes';

const NATURE_MINUS_ATTACK = new Set(['Timid', 'Modest', 'Bold', 'Calm']);
const NATURE_MINUS_SPATK = new Set(['Adamant', 'Jolly', 'Impish', 'Careful']);

const CHOICE_ITEMS = new Set(['choiceband', 'choicespecs', 'choicescarf']);
const LOCK_INCOMPATIBLE_MOVES = new Set([
  'protect', 'detect', 'wideguard', 'helpinghand', 'tailwind', 'spiky shield', 'baneful bunker', 'kings shield', 'substitute'
]);

const STATUS_MOVES = new Set([
  'protect', 'detect', 'wideguard', 'helpinghand', 'tailwind', 'willowisp', 'spore', 'taunt',
  'thunderwave', 'toxic', 'swordsdance', 'nastyplot', 'calmmind', 'trickroom', 'roost', 'recover',
  'partingshot', 'followme', 'ragepowder', 'yawn', 'haze', 'substitute', 'spikyshield'
]);

export function evaluateSetCoherence(
  build: any,
  context?: any,
): SetCoherenceResult {
  const criticalIssues: SetCoherenceIssue[] = [];
  const warnings: SetCoherenceIssue[] = [];
  const information: SetCoherenceIssue[] = [];

  const rawItem = String(build.item || build.competitiveSet?.item || '').toLowerCase().replace(/[\s-_]/g, '');
  const rawNature = String(build.nature || build.competitiveSet?.nature || '');
  const evs = build.evs || build.competitiveSet?.evs || {};
  const ivs = build.ivs || build.competitiveSet?.ivs || {};
  const moves: string[] = (build.moves || build.competitiveSet?.moves || []).map((m: any) => String(m));
  const normalizedMoves = moves.map(m => m.toLowerCase().replace(/[\s-_]/g, ''));

  const atkEv = Number(evs.atk || evs.atkEv || 0);
  const spaEv = Number(evs.spa || evs.spaEv || 0);
  const atkIv = Number(ivs.atk ?? ivs.atkIv ?? 31);
  const speIv = Number(ivs.spe ?? ivs.speIv ?? 31);

  // Classificação simplificada de movimentos físicos vs especiais
  let hasPhysicalDamageMove = false;
  let hasSpecialDamageMove = false;

  for (const m of normalizedMoves) {
    if (['doubleedge', 'flareblitz', 'earthquake', 'rockslide', 'uturn', 'knockoff', 'closecombat', 'headlongrush', 'bravebird', 'iciclespinner', 'liquidation'].includes(m)) {
      hasPhysicalDamageMove = true;
    }
    if (['thunderbolt', 'hypervoice', 'heatwave', 'overheat', 'earthpower', 'makeitrain', 'dracometeor', 'shadowball', 'dazzlinggleam', 'energyball', 'muddywater', 'surf', 'blizzard', 'icywind', 'snarl', 'bleakwindstorm'].includes(m)) {
      hasSpecialDamageMove = true;
    }
  }

  // 1. Nature vs Atributo Ofensivo
  if (NATURE_MINUS_ATTACK.has(rawNature) && hasPhysicalDamageMove && atkEv >= 84) {
    criticalIssues.push({
      reason: 'NATURE_OFFENSIVE_STAT_MISMATCH',
      severity: 'CRITICAL',
      message: `A Nature ${rawNature} reduz Attack, mas o set possui ${atkEv} EVs em Atk e movimentos físicos.`,
      evidence: { nature: rawNature, atkEv, moves },
    });
  }

  if (NATURE_MINUS_SPATK.has(rawNature) && hasSpecialDamageMove && spaEv >= 84) {
    criticalIssues.push({
      reason: 'NATURE_OFFENSIVE_STAT_MISMATCH',
      severity: 'CRITICAL',
      message: `A Nature ${rawNature} reduz Special Attack, mas o set possui ${spaEv} EVs em SpA e movimentos especiais.`,
      evidence: { nature: rawNature, spaEv, moves },
    });
  }

  // 2. Choice Item com Protect ou Status lock-incompatible
  if (CHOICE_ITEMS.has(rawItem)) {
    const hasLockIncompatible = normalizedMoves.some(m => LOCK_INCOMPATIBLE_MOVES.has(m));
    if (hasLockIncompatible) {
      criticalIssues.push({
        reason: 'CHOICE_ITEM_WITH_PROTECT',
        severity: 'CRITICAL',
        message: `Item Choice (${build.item}) é incompatível com movimentos de proteção ou suporte sob lock.`,
        evidence: { item: build.item, moves },
      });
    }
  }

  // 3. Assault Vest com movimento de Status
  if (rawItem === 'assaultvest') {
    const hasStatus = normalizedMoves.some(m => STATUS_MOVES.has(m));
    if (hasStatus) {
      criticalIssues.push({
        reason: 'ASSAULT_VEST_WITH_STATUS_MOVE',
        severity: 'CRITICAL',
        message: `Assault Vest impede a execução de movimentos de Status.`,
        evidence: { item: build.item, moves },
      });
    }
  }

  // 4. Zero IV em Attack com Atacante Físico Principal (exceto Body Press / Foul Play)
  if (atkIv === 0 && hasPhysicalDamageMove) {
    criticalIssues.push({
      reason: 'ZERO_IV_CONFLICT',
      severity: 'CRITICAL',
      message: `Set possui 0 IVs em Attack mas utiliza movimentos de dano físico primário.`,
      evidence: { atkIv, moves },
    });
  }

  const score = Math.max(0, 100 - (criticalIssues.length * 50 + warnings.length * 15));
  const valid = criticalIssues.length === 0;

  return {
    valid,
    score,
    criticalIssues,
    warnings,
    information,
  };
}
