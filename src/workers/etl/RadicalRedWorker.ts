import { Pokemon } from '../../models/Pokemon';

export class RadicalRedWorker {
  public static async run() {
    console.log('Iniciando injeção de dados (Formato: Radical Red)...');

    // Simulando dados extraídos de uma fonte externa do Radical Red
    // Meganium ganha tipo Fada, Arbok ganha tipo Sombrio, etc.
    const radicalRedData = [
      {
        name: 'Meganium',
        types: ['Grass', 'Fairy'], // Mudança de tipagem!
        abilities: { 0: 'Overgrow', H: 'Triage' }, // Triage é muito usado nela no RR
        baseStats: { hp: 80, atk: 82, def: 100, spa: 83, spd: 100, spe: 80 },
        tier: 'RR-OU'
      },
      {
        name: 'Arbok',
        types: ['Poison', 'Dark'], // Mudança de tipagem!
        abilities: { 0: 'Intimidate', 1: 'Shed Skin', H: 'Strong Jaw' }, // Strong Jaw adicionado
        baseStats: { hp: 60, atk: 95, def: 69, spa: 65, spd: 79, spe: 80 },
        tier: 'RR-UU'
      },
      {
        name: 'Charizard',
        types: ['Fire', 'Flying'],
        abilities: { 0: 'Blaze', H: 'Solar Power' },
        // Buff leve nos status base para acompanhar o power creep
        baseStats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
        tier: 'RR-OU'
      }
    ];

    const bulkOperations: any[] = [];

    for (const data of radicalRedData) {
      const rrVariant = {
        formatId: 'radical_red',
        types: data.types,
        abilities: data.abilities,
        baseStats: data.baseStats,
        tier: data.tier
      };

      // Operação 1: Remove a variante radical_red antiga, se houver
      bulkOperations.push({
        updateOne: {
          filter: { name: data.name },
          update: {
            $pull: { variants: { formatId: 'radical_red' } }
          }
        }
      });

      // Operação 2: Insere a nova variante radical_red
      bulkOperations.push({
        updateOne: {
          filter: { name: data.name },
          update: {
            $push: { variants: rrVariant }
          }
        }
      });
    }

    try {
      console.log(`Atualizando ${bulkOperations.length / 2} Pokémons com dados do Radical Red...`);
      await Pokemon.bulkWrite(bulkOperations);
      console.log('✅ Injeção Radical Red finalizada com sucesso!');
    } catch (error) {
      console.error('❌ Erro no processamento do BulkWrite:', error);
    }
  }
}