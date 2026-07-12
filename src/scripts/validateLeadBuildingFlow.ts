// src/scripts/validateLeadBuildingFlow.ts
declare var process: any;
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { TeamService } from '../services/TeamService';
import { buildAuditRuntimeReport, printAuditRuntimeReport, resolveDataMode } from '../equinox/data-audit/DataAuditRuntime';

async function run() {
  console.log('🧪 Iniciando teste de validação do novo fluxo de lead VGC...');
  if (resolveDataMode() === 'filesystem') {
    console.log('[Equinox] Lead building flow skipped because EQUINOX_DATA_MODE=filesystem.');
    printAuditRuntimeReport(buildAuditRuntimeReport());
    return;
  }
  await connectDatabase();
  console.log('📦 Conectado ao MongoDB.');

  const format = 'champions_reg_m_b_doubles';
  const leadInput = ['Pelipper', 'Aggron-Mega'];

  try {
    const res: any = await TeamService.suggestComplements(
      leadInput,
      format,
      true, // allowLegendaries
      'balanced'
    );

    console.log(`\n🔍 Total de times sugeridos pelo Equinox: ${res.topTeams.length}`);
    const firstTeam = res.topTeams[0];
    if (!firstTeam) {
      throw new Error('Nenhum time sugerido foi retornado pelo motor.');
    }

    console.log(`\nTime Sugerido Completo: ${firstTeam.suggestedPokemons.map((p: any) => p.name).join(', ')}`);
    
    // 1. Validar tamanho do time completo
    if (firstTeam.suggestedPokemons.length !== 3) {
      throw new Error(`Sugeridos deveria ter tamanho 3, mas tem ${firstTeam.suggestedPokemons.length}`);
    }
    const fullNames = firstTeam.fullTeam.map((p: any) => p.name);
    if (fullNames.length !== 6) {
      throw new Error(`Time completo deveria ter tamanho 6, mas tem ${fullNames.length}`);
    }

    // 2. Validar presença dos membros da lead
    if (!fullNames.includes('Pelipper') || !fullNames.some((name: string) => name.includes('Aggron'))) {
      throw new Error('O time gerado não preservou a lead inicial escolhida pelo usuário.');
    }

    // 3. Validar vgcTeamPlan e as métricas de lead
    const plan = firstTeam.vgcTeamPlan;
    if (!plan) {
      throw new Error('O plano de jogo vgcTeamPlan não foi gerado.');
    }

    console.log('\n======================================================');
    console.log('📊 NOVAS MÉTRICAS DE LEAD COMPETITIVA (VGC)');
    console.log('======================================================');
    console.log(`  Validade Mecânica: ${plan.leadMetrics?.mechanicalValidity}/100`);
    console.log(`  Execução no Turno Inicial: ${plan.leadMetrics?.initialTurnExecution}/100`);
    console.log(`  Resistência a Interrupções: ${plan.leadMetrics?.disruptionResistance}/100`);
    console.log(`  Conversão Ofensiva: ${plan.leadMetrics?.offensiveConversion}/100`);
    console.log(`  Índice Estratégico: ${plan.leadMetrics?.strategicIndex}/100`);

    if (!plan.leadMetrics || typeof plan.leadMetrics.strategicIndex !== 'number') {
      throw new Error('Métricas da lead ausentes ou com tipo inválido.');
    }

    console.log('\n======================================================');
    console.log('📖 RESUMO DO PLAYBOOK E QUARTETOS');
    console.log('======================================================');
    console.log(plan.planSummary);

    // 4. Validar se a lead está travada em todos os modos viáveis
    const modes = plan.modeAnalysis.viableModes;
    console.log(`\n  Total de modos viáveis gerados: ${modes.length}`);
    for (const mode of modes) {
      const isLeadLocked = mode.lead.includes('Pelipper') && mode.lead.some((name: string) => name.includes('Aggron'));
      console.log(`    Modo: "${mode.tacticalInsights[0]?.type ?? 'Geral'}" | Lead fixa preservada? ${isLeadLocked ? 'SIM' : 'NÃO'} | Banco: ${mode.selectedFour.filter((n: string) => n !== 'Pelipper' && !n.includes('Aggron')).join(' / ')}`);
      if (!isLeadLocked) {
        throw new Error('A lead de abertura não foi fixada no quarteto de 4 Pokémon.');
      }
    }

    console.log('\n✅ Todos os testes de validação do novo fluxo de lead competitiva VGC passaram com sucesso!');
  } catch (err: any) {
    console.error('❌ Erro durante o teste de validação do fluxo de lead:', err);
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log('🔌 Desconectado do MongoDB.');
}

run();
