import { Dex } from '@pkmn/dex';
import { Pokemon } from '../../models/Pokemon';

export class SmogonWorker {
  private static isLegendarySpecies(tags: string[]): boolean {
    return tags.some(tag => /legendary|mythical/i.test(tag));
  }

  public static async run() {
    console.log('Iniciando extração de dados (Formato: Vanilla)...');
    
    const allSpecies = Array.from(Dex.species.all());
    const bulkOperations: any[] = [];

    for (const species of allSpecies) {
      if (species.num <= 0) continue;

      const vanillaVariant = {
        formatId: 'vanilla',
        types: species.types,
        abilities: {
          0: species.abilities['0'],
          ...(species.abilities['1'] && { 1: species.abilities['1'] }),
          ...(species.abilities['H'] && { H: species.abilities['H'] })
        },
        baseStats: species.baseStats,
        tier: species.tier || 'Untiered'
      };

      bulkOperations.push({
        updateOne: {
          filter: { name: species.name },
          update: {
            $set: {
              dexNumber: species.num,
              name: species.name,
              baseForme: species.baseForme || species.name,
              isLegendary: SmogonWorker.isLegendarySpecies(species.tags ?? []),
            },
            $pull: { variants: { formatId: 'vanilla' } } 
          },
          upsert: true
        }
      });

      bulkOperations.push({
        updateOne: {
          filter: { name: species.name },
          update: {
            $push: { variants: vanillaVariant }
          }
        }
      });
    }

    try {
      console.log(`Preparando inserção de ${bulkOperations.length / 2} Pokémons no MongoDB...`);
      await Pokemon.bulkWrite(bulkOperations);
      console.log('✅ ETL Vanilla finalizado com sucesso!');
    } catch (error) {
      console.error('❌ Erro no processamento do BulkWrite:', error);
    }
  }
}
