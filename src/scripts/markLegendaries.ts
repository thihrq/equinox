// src/scripts/markLegendaries.ts
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database'; // Ajuste o caminho se necessário
import { Pokemon } from '../models/Pokemon';

const legendariesAndMythicals = [
  'Articuno', 'Zapdos', 'Moltres', 'Mewtwo', 'Mew',
  'Raikou', 'Entei', 'Suicune', 'Lugia', 'Ho-Oh', 'Celebi',
  'Regirock', 'Regice', 'Registeel', 'Latias', 'Latios', 'Kyogre', 'Groudon', 'Rayquaza', 'Jirachi', 'Deoxys',
  'Uxie', 'Mesprit', 'Azelf', 'Dialga', 'Palkia', 'Heatran', 'Regigigas', 'Giratina', 'Cresselia', 'Phione', 'Manaphy', 'Darkrai', 'Shaymin', 'Arceus',
  'Victini', 'Cobalion', 'Terrakion', 'Virizion', 'Tornadus', 'Thundurus', 'Reshiram', 'Zekrom', 'Landorus', 'Kyurem', 'Keldeo', 'Meloetta', 'Genesect',
  'Xerneas', 'Yveltal', 'Zygarde', 'Diancie', 'Hoopa', 'Volcanion',
  'Type: Null', 'Silvally', 'Tapu Koko', 'Tapu Lele', 'Tapu Bulu', 'Tapu Fini', 'Cosmog', 'Cosmoem', 'Solgaleo', 'Lunala', 'Nihilego', 'Buzzwole', 'Pheromosa', 'Xurkitree', 'Celesteela', 'Kartana', 'Guzzlord', 'Necrozma', 'Magearna', 'Marshadow', 'Poipole', 'Naganadel', 'Stakataka', 'Blacephalon', 'Zeraora', 'Meltan', 'Melmetal',
  'Zacian', 'Zamazenta', 'Eternatus', 'Kubfu', 'Urshifu', 'Zarude', 'Regieleki', 'Regidrago', 'Glastrier', 'Spectrier', 'Calyrex',
  'Wo-Chien', 'Chien-Pao', 'Ting-Lu', 'Chi-Yu', 'Roaring Moon', 'Iron Valiant', 'Koraidon', 'Miraidon', 'Walking Wake', 'Iron Leaves', 'Okidogi', 'Munkidori', 'Fezandipiti', 'Ogerpon', 'Terapagos'
];

async function runMigration() {
  try {
    await connectDatabase();
    console.log('🔄 Conectado ao banco. Iniciando marcação de Lendários...');

    // Cria uma lista de expressões regulares para pegar variações (Ex: "charizard" não pega, mas "mewtwo-mega-x" sim)
    const regexList = legendariesAndMythicals.map(name => new RegExp(`^${name}`, 'i'));

    // Atualiza todos os Pokémons que batem com a lista
    const result = await Pokemon.updateMany(
      { name: { $in: regexList } },
      { $set: { isLegendary: true } }
    );

    console.log(`✅ Sucesso! ${result.modifiedCount} Pokémons foram classificados como Lendários/Míticos.`);

  } catch (error) {
    console.error('🚨 Erro na migração:', error);
  } finally {
    mongoose.disconnect();
    console.log('👋 Conexão encerrada.');
  }
}

runMigration();