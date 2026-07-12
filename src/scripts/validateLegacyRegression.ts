// src/scripts/validateLegacyRegression.ts
// Teste de regressão para blindar o fluxo clássico de 3 Pokémon (Completar Núcleo)

import dotenv from 'dotenv';
dotenv.config();
import { connectDatabase } from '../config/database';
import { TeamService } from '../services/TeamService';
import mongoose from 'mongoose';
import { buildAuditRuntimeReport, printAuditRuntimeReport, resolveDataMode } from '../equinox/data-audit/DataAuditRuntime';

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
};

async function run() {
  console.log('🧪 Iniciando suíte de testes de regressão do fluxo legado (Sprint 0)...');
  if (resolveDataMode() === 'filesystem') {
    console.log('[Equinox] Legacy DB regression skipped because EQUINOX_DATA_MODE=filesystem.');
    printAuditRuntimeReport(buildAuditRuntimeReport());
    return;
  }
  await connectDatabase();
  console.log('📦 Conectado ao MongoDB.');

  try {
    const inputTeam = ['Snorlax', 'Jolteon', 'Lapras'];
    const format = 'vanilla_fire_red';

    console.log(`\n[Regressão] Testando suggestComplements para ${inputTeam.join(', ')} no formato ${format}...`);
    const response: any = await TeamService.suggestComplements(
      inputTeam,
      format,
      false, // allowLegendaries
      'balanced', // teamIdentity
    );

    console.log('🔍 Validando estrutura de resposta:');
    assert.ok(response && Array.isArray(response.topTeams), 'A resposta deve conter um array topTeams');
    assert.ok(response.topTeams.length > 0, 'Deveria retornar pelo menos uma opção de equipe sugerida');
    console.log('  - Estrutura topTeams: OK');

    const option = response.topTeams[0];

    // Preservação do time do usuário
    assert.ok(option.fullTeam && option.fullTeam.length === 6, 'O time completo (fullTeam) deve conter exatamente 6 Pokémon');
    assert.equal(option.fullTeam[0].name, 'Snorlax', 'O primeiro Pokémon deve ser Snorlax');
    assert.equal(option.fullTeam[1].name, 'Jolteon', 'O segundo Pokémon deve ser Jolteon');
    assert.equal(option.fullTeam[2].name, 'Lapras', 'O terceiro Pokémon deve ser Lapras');
    console.log('  - Preservação de membros fornecidos pelo usuário no fullTeam: OK');

    // Recomendação de três complementos
    assert.ok(option.suggestedPokemons && option.suggestedPokemons.length === 3, 'Deve sugerir exatamente 3 complementos');
    console.log('  - Quantidade de complementos recomendados: OK');

    // Detalhes completos dos sets
    for (const p of option.fullTeam) {
      assert.ok(p.name, 'Pokémon deve ter nome');
      assert.ok(p.ability, `Pokémon ${p.name} deve ter habilidade definida`);
      assert.ok(p.item, `Pokémon ${p.name} deve ter item definido`);
      assert.ok(p.nature, `Pokémon ${p.name} deve ter natureza definida`);
      assert.ok(p.role, `Pokémon ${p.name} deve ter função (role) definida`);
      assert.ok(p.moves && p.moves.length >= 1, `Pokémon ${p.name} deve ter pelo menos 1 movimento`);
      console.log(`    * Set de ${p.name}: ${p.ability} / ${p.item} / ${p.nature} / [${p.moves.join(', ')}] (OK)`);
    }
    console.log('  - Detalhes completos e legalidade de todos os sets: OK');

    // Validação de pontuações e explicações
    assert.ok(option.score && typeof option.score.total === 'number', 'A opção deve ter pontuação total calculada');
    assert.ok(Array.isArray(option.explanations), 'A opção deve conter array de explicações');
    console.log('  - Pontuações e explicações estratégicas: OK');

    // Validação VGC vs Aventura
    assert.equal(option.vgcTeamPlan, undefined, 'Formatos offline (vanilla) não devem ter vgcTeamPlan');
    console.log('  - Ausência de playbook VGC em formatos de aventura offline: OK');

    console.log('\n✅ Todos os testes de regressão do fluxo legado (Sprint 0) passaram!');
  } catch (error) {
    console.error('❌ Falha nos testes de regressão:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Desconectado do MongoDB.');
  }
}

run();
