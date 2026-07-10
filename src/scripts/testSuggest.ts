import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { TeamService } from '../services/TeamService';

async function run() {
  await connectDatabase();
  console.log('📦 Conectado ao MongoDB.');

  const res: any = await TeamService.suggestComplements(
    ['Charizard', 'Jolteon', 'Lapras'],
    'champions_reg_m_b_doubles',
    false,
    'balanced'
  );

  console.log('🔍 Total de times recomendados:', res.topTeams.length);

  for (let i = 0; i < res.topTeams.length; i++) {
    const t = res.topTeams[i];
    console.log(`\nTime ${i + 1}:`, t.suggestedPokemons.map((p: any) => p.name).join(', '));
    console.log('Full 6-Pokémon Showdown Format:');
    const showdownText = t.fullTeam
      ?.map((p: any) => {
        const itemSuffix = p.item && p.item !== 'Nenhum' ? ` @ ${p.item}` : '';
        const ability = p.ability && p.ability !== 'Nenhum' ? `Ability: ${p.ability}\n` : '';
        const nature = p.nature ? `${p.nature} Nature\n` : '';
        const moves = p.moves && p.moves.length > 0
          ? p.moves.map((m: any) => `- ${m}`).join('\n') + '\n'
          : '';
        return `${p.name}${itemSuffix}\n${ability}${nature}${moves}`;
      })
      .join('\n');
    console.log(showdownText);
  }

  await mongoose.disconnect();
  console.log('🔌 Desconectado do MongoDB.');
}

run().catch(console.error);
