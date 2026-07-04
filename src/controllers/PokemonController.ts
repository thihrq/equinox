import { Request, Response } from 'express';
import { PokemonService } from '../services/PokemonService';

export class PokemonController {
  public static async show(req: Request, res: Response): Promise<any> {
    try {
      // Usamos o construtor String() para garantir o tipo em tempo de compilação e execução
      const name = String(req.params.name);
      const format = String(req.query.format || 'vanilla');
      
      const pokemon = await PokemonService.getPokemonByName(name, format);

      if (!pokemon) {
        return res.status(404).json({ error: 'Pokémon não encontrado.' });
      }
      
      return res.json(pokemon);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}