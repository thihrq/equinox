// src/scripts/validateLeadBuildPipeline.ts
// Teste end-to-end do pipeline Build-Around-Lead

declare var process: any;
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { buildAuditRuntimeReport, printAuditRuntimeReport, resolveDataMode } from '../equinox/data-audit/DataAuditRuntime';
import { LeadStrategyRecommendationService } from '../services/LeadStrategyRecommendationService';

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string): void {
    if (actual !== expected) {
      throw new Error(msg || `Esperado ${String(expected)}, recebido ${String(actual)}`);
    }
  },
  ok(value: unknown, msg?: string): void {
    if (!value) {
      throw new Error(msg || 'Condição esperada não foi atendida.');
    }
  },
  deepEqual(actual: unknown, expected: unknown, msg?: string): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(msg || `Esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
    }
  },
};

async function run() {
  console.log('🧪 Iniciando teste end-to-end do pipeline Build-Around-Lead...');
  if (resolveDataMode() === 'filesystem') {
    console.log('[Equinox] Build-Around-Lead DB check skipped because EQUINOX_DATA_MODE=filesystem.');
    printAuditRuntimeReport(buildAuditRuntimeReport());
    return;
  }
  await connectDatabase();
  console.log('📦 Conectado ao MongoDB.');

  const service = new LeadStrategyRecommendationService();

  try {
    const result = await service.execute({
      lead: [
        { name: 'Aggron-Mega' },
        { name: 'Sinistcha' },
      ],
      format: 'champions_reg_m_b_doubles',
      leadMode: 'fixed-lead',
      allowLegendaries: true,
      teamIdentity: 'balanced',
    });

    console.log('\n🔍 Validações gerais:');
    assert.ok(!('topTeams' in result), 'Endpoint de lead não deve retornar contrato legado topTeams');
    assert.deepEqual(result.lead, ['Aggron-Mega', 'Sinistcha'], 'Lead fixa deve ser preservada no contrato nativo');
    assert.ok(result.leadProfile, 'Contrato nativo deve incluir leadProfile');
    assert.ok(result.strategies.length > 0, 'Deveria gerar ao menos uma estratégia nativa');
    assert.ok(result.bestOverallTeam.length === 6, 'Contrato nativo deve expor o melhor time completo de 6');
    console.log(`  - Estratégias nativas geradas: ${result.strategies.length} (OK)`);

    const firstStrategy = result.strategies[0];
    const firstCompletion = firstStrategy.completions[0];
    assert.ok(firstCompletion, 'Primeira estratégia deve conter ao menos uma composição completa');
    const firstTeam = firstCompletion.fullTeam;
    assert.equal(firstTeam.length, 6, 'Time completo deve ter exatamente 6 Pokémon');
    console.log(`  - Time completo gerado: ${firstTeam.map((p: any) => p.name).join(', ')} (OK)`);

    // Validar se os 2 primeiros do completion são a lead
    assert.equal(firstTeam[0].name, 'Aggron-Mega');
    assert.ok(firstTeam[1].name.includes('Sinistcha'));
    console.log('  - Lead como os 2 primeiros membros do time: OK');

    // Validar que o playbook foi gerado com as transições/ações correspondentes no contrato nativo
    assert.ok(firstStrategy.quartets.length > 0, 'Quartetos/Playbooks gerados: OK');
    const firstQuartet = firstStrategy.quartets[0];
    assert.equal(firstQuartet.lead[0], 'Aggron-Mega');
    assert.ok(firstQuartet.lead[1].includes('Sinistcha'));
    console.log(`  - Playbook ativo para lead: ${firstQuartet.lead.join(' + ')} (OK)`);

    // Validar que golpes ausentes de setup não são citados na estratégia
    const nativeStrategyText = JSON.stringify(firstStrategy);
    assert.ok(!nativeStrategyText.includes('Iron Defense'), 'Não deve citar Iron Defense se o golpe estiver ausente no set');
    assert.ok(!nativeStrategyText.includes('Swords Dance'), 'Não deve citar Swords Dance se o golpe estiver ausente no set');
    console.log('  - Bloqueio de golpes ausentes em planSummary: OK');

    // Validar que a propriedade assessment está presente e estruturada
    assert.ok(firstQuartet.assessment, 'Propriedade assessment deve estar presente no quarteto');
    assert.ok(Array.isArray(firstQuartet.assessment.contractErrors), 'contractErrors deve ser um array');
    assert.ok(Array.isArray(firstQuartet.assessment.warnings), 'warnings deve ser um array');
    assert.ok(Array.isArray(firstQuartet.assessment.matchupRisks), 'matchupRisks deve ser um array');

    // Como o time de teste é válido, a validade mecânica deve ser maior que 0
    assert.ok(firstQuartet.contractValid, 'Quarteto principal deve ser mecanicamente válido');
    console.log('  - Estrutura de assessment e métricas de erro/alerta: OK');

    // Validar a consistencia absoluta dos sets no time completo nativo
    for (const member of firstTeam) {
      assert.ok(member.ability, `Habilidade deve estar presente para ${member.name}`);
      assert.ok(member.item, `Item deve estar presente para ${member.name}`);
      assert.ok(Array.isArray(member.moves) && member.moves.length === 4, `Moves devem conter exatamente 4 golpes para ${member.name}`);
      assert.ok(member.nature, `Natureza deve estar presente para ${member.name}`);
      assert.ok(!member.nature.includes('/'), `Natureza deve ser unica para ${member.name}`);
      assert.ok(member.role, `Funcao deve estar presente para ${member.name}`);
      assert.ok(member.competitiveSet, `competitiveSet deve estar presente para ${member.name}`);
      assert.equal(member.competitiveSet.moves.length, 4, `competitiveSet deve conter 4 golpes para ${member.name}`);
      assert.ok(member.competitiveSet.validation.legal, `competitiveSet deve estar legal para ${member.name}`);
      const evTotal = Object.values(member.competitiveSet.evs).reduce((sum: number, value: any) => sum + Number(value), 0);
      assert.ok(evTotal <= 510, `EVs devem totalizar no maximo 510 para ${member.name}`);
      assert.ok(Object.values(member.competitiveSet.evs).every((value: any) => Number(value) >= 0 && Number(value) <= 252), `EVs por atributo devem ficar entre 0 e 252 para ${member.name}`);
      assert.ok(Object.values(member.competitiveSet.ivs).every((value: any) => Number(value) >= 0 && Number(value) <= 31), `IVs devem ficar entre 0 e 31 para ${member.name}`);
    }
    console.log('  - Consistencia de propriedades de set (Grid vs FullTeam): OK');

    assert.ok(firstStrategy.teamEvaluation.teamLegality.legal, 'Time recomendado deve passar pela legalidade competitiva');
    assert.ok(firstStrategy.teamEvaluation.overallScore >= 60, 'Time recomendado deve ter score geral minimo 60');
    assert.ok(firstStrategy.teamEvaluation.roleCoverageScore >= 55, 'Time recomendado deve ter cobertura de funcoes minima 55');
    assert.ok(firstStrategy.teamEvaluation.offensiveBalanceScore >= 45, 'Time recomendado deve ter equilibrio ofensivo minimo 45');
    const items = firstTeam.map((member: any) => member.item).filter(Boolean);
    assert.equal(new Set(items).size, items.length, 'Item Clause deve ser respeitada no time recomendado');
    console.log('  - Legalidade, Item Clause e thresholds competitivos: OK');
    console.log('\n✅ Todos os testes do pipeline Build-Around-Lead passaram com sucesso!');
  } catch (err: any) {
    console.error('❌ Erro durante o teste de validação do pipeline de lead:', err);
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log('🔌 Desconectado do MongoDB.');
}

run();
