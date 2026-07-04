// src/scripts/seed.ts
import mongoose from 'mongoose';
import axios from 'axios';
import { Pokemon } from '../models/Pokemon'; // Ajuste o caminho se necessário
import 'dotenv/config'; // Certifique-se de ter o dotenv instalado se usar .env

// Função para capitalizar (ex: 'fire' -> 'Fire') para casar com o nosso TYPE_CHART
const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

// Formata nomes compostos (ex: 'charizard-mega-x' -> 'Charizard-Mega-X')
const formatName = (name: string) => {
  return name.split('-').map(part => capitalize(part)).join('-');
};

const seedDatabase = async () => {
  try {
    // 1. Conecta ao Banco de Dados (substitua pela sua string de conexão se não usar .env)
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon-builder';
    await mongoose.connect(MONGO_URI);
    console.log('📦 Conectado ao MongoDB. Iniciando o download...');

    // 2. Busca a lista de Pokémons (limite 1500 pega todas as gerações + formas Mega/Gmax)
    const response = await axios.get('https://pokeapi.co/api/v2/pokemon?limit=1500');
    const pokemonList = response.data.results;

    console.log(`🔍 Encontrados ${pokemonList.length} registros. Baixando atributos e tipagens...`);

    let count = 0;

    // 3. Processa um por um para não sobrecarregar a API
    for (const item of pokemonList) {
      try {
        const detailRes = await axios.get(item.url);
        const p = detailRes.data;

        const name = formatName(p.name);
        const types = p.types.map((t: any) => capitalize(t.type.name));

        const baseStats = {
          hp: p.stats.find((s: any) => s.stat.name === 'hp').base_stat,
          atk: p.stats.find((s: any) => s.stat.name === 'attack').base_stat,
          def: p.stats.find((s: any) => s.stat.name === 'defense').base_stat,
          spa: p.stats.find((s: any) => s.stat.name === 'special-attack').base_stat,
          spd: p.stats.find((s: any) => s.stat.name === 'special-defense').base_stat,
          spe: p.stats.find((s: any) => s.stat.name === 'speed').base_stat,
        };

        // 4. Salva ou Atualiza no MongoDB
        await Pokemon.findOneAndUpdate(
          { name: name }, // Busca pelo nome
          {
            name: name,
            types: types,
            variants: [{
              formatId: 'vanilla',
              types: types,
              baseStats: baseStats
            }]
          },
          { upsert: true, new: true } // upsert cria se não existir, atualiza se existir
        );

        count++;
        if (count % 100 === 0) console.log(`✅ ${count} Pokémons processados e salvos...`);
        
        // Pequeno delay para sermos educados com o servidor da PokeAPI
        await new Promise(resolve => setTimeout(resolve, 20));

      } catch (err: any) {
        console.error(`❌ Erro ao salvar ${item.name}:`, err.message);
      }
    }

    console.log('🎉 Banco de dados populado com sucesso! Temos combustível!');
    process.exit(0);

  } catch (error) {
    console.error('🚨 Erro fatal no script de Seed:', error);
    process.exit(1);
  }
};

seedDatabase();